import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Schedule or trigger Library of Congress authority file synchronizations.
 * Uses batch_jobs to track requested syncs (weekly/monthly).
 */
export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Unauthorized');
	}

	const { frequency = 'weekly', scope = 'both', run_now = false } = await request.json();

	if (!['weekly', 'monthly'].includes(frequency)) {
		throw error(400, 'Frequency must be weekly or monthly');
	}

	if (!['names', 'subjects', 'both'].includes(scope)) {
		throw error(400, 'Scope must be names, subjects, or both');
	}

	try {
		const { data: job, error: jobError } = await supabase
			.from('batch_jobs')
			.insert({
				job_type: 'authority_control',
				job_name: `LoC authority sync (${frequency})`,
				description: run_now
					? 'Immediate Library of Congress authority sync'
					: 'Scheduled Library of Congress authority sync',
				parameters: { frequency, scope, run_now },
				status: run_now ? 'running' : 'pending',
				created_by: session.user.id,
				started_at: run_now ? new Date().toISOString() : null
			})
			.select()
			.single();

		if (jobError) throw jobError;

		let pullSummary: any = null;

		if (run_now) {
			try {
				pullSummary = await performLocPull(scope, supabase, session.user.id);

				await supabase
					.from('batch_jobs')
					.update({
						status: 'completed',
						completed_at: new Date().toISOString(),
						processed_records: pullSummary.total,
						successful_records: pullSummary.total,
						result_summary: pullSummary
					})
					.eq('id', job.id);
			} catch (syncErr: any) {
				await supabase
					.from('batch_jobs')
					.update({
						status: 'failed',
						completed_at: new Date().toISOString(),
						error_log: [syncErr?.message || 'LoC sync failed']
					})
					.eq('id', job.id);
				throw syncErr;
			}
		}

		// Provide bulk download references for operators who want offline sync
		const bulkDownloads = {
			names: 'https://id.loc.gov/static/data/lcnaf.madsrdf.nt.gz',
			subjects: 'https://id.loc.gov/static/data/authoritiessubjects.madsrdf.nt.gz'
		};

		return json({
			scheduled: true,
			job,
			bulkDownloads,
			pullSummary,
			message: run_now
				? 'Sync finished. See summary below.'
				: `Sync scheduled (${frequency}).`
		});
	} catch (err: any) {
		console.error('Error scheduling LoC sync:', err);
		if (err.status) throw err;
		throw error(500, 'Failed to schedule Library of Congress sync');
	}
};

type LocScope = 'names' | 'subjects';

async function performLocPull(
	scope: 'names' | 'subjects' | 'both',
	supabase: any,
	userId: string
) {
	const scopes: LocScope[] =
		scope === 'both' ? ['names', 'subjects'] : scope === 'names' ? ['names'] : ['subjects'];

	const now = new Date().toISOString();
	let inserted = 0;
	let updated = 0;
	const processed: any[] = [];

	for (const s of scopes) {
		const authorities = await fetchLocAuthorities(s);

		for (const auth of authorities) {
			const payload = {
				heading: auth.label,
				type: s === 'subjects' ? 'topical_subject' : 'personal_name',
				source: s === 'subjects' ? 'lcsh' : 'lcnaf',
				lccn: auth.lccn,
				variant_forms: auth.variants || [],
				marc_authority: {
					uri: auth.uri,
					broader: auth.broader,
					narrower: auth.narrower,
					related: auth.related
				},
				last_sync_at: now,
				updated_by: userId,
				created_by: userId
			};

			const { data, error: upsertError } = await supabase
				.from('authorities')
				.upsert(payload, { onConflict: 'heading,type,source' })
				.select()
				.single();

			if (upsertError) throw upsertError;

			if (data?.created_at === data?.updated_at) {
				inserted++;
			} else {
				updated++;
			}

			processed.push({ heading: payload.heading, lccn: payload.lccn, source: payload.source });
		}
	}

	await supabase.from('authority_update_log').insert({
		action: 'synced_from_loc',
		new_value: { processed },
		performed_by: userId,
		records_affected: processed.length,
		note: 'Automated LoC sync pull'
	});

	return { inserted, updated, total: processed.length, scopes };
}

async function fetchLocAuthorities(type: LocScope, limit = 20) {
	// Use a simple seed query to fetch a representative slice
	const response = await fetch(
		`https://id.loc.gov/authorities/${type}/suggest2/?q=a&count=${limit}`
	);

	if (!response.ok) {
		throw new Error(`LoC fetch failed (${type}): ${response.statusText}`);
	}

	const data = await response.json();
	const hits = data.hits || [];

	const authorities = await Promise.all(
		hits.slice(0, limit).map(async (hit: any) => {
			const uri = hit.uri;
			try {
				const detailResp = await fetch(`${uri}.json`);
				if (!detailResp.ok) {
					throw new Error(`Detail fetch failed: ${detailResp.statusText}`);
				}
				const detail = await detailResp.json();
				const main = Array.isArray(detail) ? detail[0] : detail;

				const variants = main['skos:altLabel']
					? (Array.isArray(main['skos:altLabel'])
							? main['skos:altLabel']
							: [main['skos:altLabel']]
					  ).map((v: any) => v['@value'] || v)
					: [];

				const broader = toIdArray(main['skos:broader']);
				const narrower = toIdArray(main['skos:narrower']);
				const related = toIdArray(main['skos:related']);

				const label = extractLabel(main);
				return {
					uri,
					label,
					lccn: extractLccn(uri),
					variants,
					broader,
					narrower,
					related
				};
			} catch (err) {
				console.error('Failed to fetch LoC detail', err);
				return {
					uri,
					label: hit.suggestLabel || hit.aLabel || 'Unknown',
					lccn: extractLccn(uri),
					variants: []
				};
			}
		})
	);

	return authorities.filter(Boolean);
}

function toIdArray(entry: any): string[] {
	if (!entry) return [];
	if (Array.isArray(entry)) {
		return entry.map((e) => e['@id'] || e).filter(Boolean);
	}
	return [entry['@id'] || entry].filter(Boolean);
}

function extractLabel(resource: any): string {
	if (resource['skos:prefLabel']) {
		const label = Array.isArray(resource['skos:prefLabel'])
			? resource['skos:prefLabel'][0]
			: resource['skos:prefLabel'];
		return label['@value'] || label;
	}

	if (resource['rdfs:label']) {
		const label = Array.isArray(resource['rdfs:label'])
			? resource['rdfs:label'][0]
			: resource['rdfs:label'];
		return label['@value'] || label;
	}

	if (resource['@id']) {
		return resource['@id'].split('/').pop() || 'Unknown';
	}

	return 'Unknown';
}

function extractLccn(uri: string): string {
	const parts = uri.split('/');
	return parts[parts.length - 1];
}
