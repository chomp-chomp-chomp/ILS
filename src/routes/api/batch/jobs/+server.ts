import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// GET - List batch jobs
export const GET: RequestHandler = async ({ url, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Unauthorized');
	}

	try {
		const status = url.searchParams.get('status');
		const jobType = url.searchParams.get('type');
		const limit = parseInt(url.searchParams.get('limit') || '50');

		let query = supabase
			.from('batch_jobs')
			.select('*')
			.eq('created_by', session.user.id)
			.order('created_at', { ascending: false })
			.limit(limit);

		if (status) {
			query = query.eq('status', status);
		}

		if (jobType) {
			query = query.eq('job_type', jobType);
		}

		const { data, error: queryError } = await query;
		if (queryError) throw queryError;

		return json({ success: true, jobs: data || [] });

	} catch (err) {
		console.error('Error fetching jobs:', err);
		throw error(500, err instanceof Error ? err.message : 'Failed to fetch jobs');
	}
};

// POST - Cancel a batch job
export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Unauthorized');
	}

	try {
		const { jobId } = await request.json();

		if (!jobId) {
			throw error(400, 'Job ID required');
		}

		const { data, error: updateError } = await supabase
			.from('batch_jobs')
			.update({
				cancel_requested: true,
				status: 'cancelled',
				completed_at: new Date().toISOString()
			})
			.eq('id', jobId)
			.eq('created_by', session.user.id)
			.select()
			.single();

		if (updateError) throw updateError;

		return json({ success: true, job: data });

	} catch (err) {
		console.error('Error cancelling job:', err);
		throw error(500, err instanceof Error ? err.message : 'Failed to cancel job');
	}
};

// DELETE - Delete a batch job
export const DELETE: RequestHandler = async ({ url, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Unauthorized');
	}

	try {
		const jobId = url.searchParams.get('id');

		if (!jobId) {
			throw error(400, 'Job ID required');
		}

		const { error: deleteError } = await supabase
			.from('batch_jobs')
			.delete()
			.eq('id', jobId)
			.eq('created_by', session.user.id);

		if (deleteError) throw deleteError;

		return json({ success: true });

	} catch (err) {
		console.error('Error deleting job:', err);
		throw error(500, err instanceof Error ? err.message : 'Failed to delete job');
	}
};
