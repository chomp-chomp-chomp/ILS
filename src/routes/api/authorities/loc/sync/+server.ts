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

		// Provide bulk download references for operators who want offline sync
		const bulkDownloads = {
			names: 'https://id.loc.gov/static/data/lcnaf.madsrdf.nt.gz',
			subjects: 'https://id.loc.gov/static/data/authoritiessubjects.madsrdf.nt.gz'
		};

		return json({
			scheduled: true,
			job,
			bulkDownloads,
			message: run_now
				? 'Sync queued to run now. Monitor batch jobs for progress.'
				: `Sync scheduled (${frequency}).`
		});
	} catch (err: any) {
		console.error('Error scheduling LoC sync:', err);
		if (err.status) throw err;
		throw error(500, 'Failed to schedule Library of Congress sync');
	}
};
