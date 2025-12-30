import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	// Get overall statistics
	const [borrowingStats, lendingStats, partnersData, recentRequests] = await Promise.all([
		// Borrowing statistics
		supabase.from('ill_requests').select('status', { count: 'exact' }).eq('request_type', 'borrowing'),

		// Lending statistics
		supabase.from('ill_requests').select('status', { count: 'exact' }).eq('request_type', 'lending'),

		// Active partners count
		supabase.from('ill_partners').select('*', { count: 'exact' }).eq('is_active', true),

		// Recent requests (last 10)
		supabase
			.from('ill_requests')
			.select(
				`
				*,
				patron:patrons(id, name, email),
				partner:ill_partners(id, library_name)
			`
			)
			.order('created_at', { ascending: false })
			.limit(10)
	]);

	// Count by status for borrowing
	const { data: borrowingByStatus } = await supabase
		.from('ill_requests')
		.select('status')
		.eq('request_type', 'borrowing');

	const borrowingStatusCounts: Record<string, number> = {};
	borrowingByStatus?.forEach((req) => {
		borrowingStatusCounts[req.status] = (borrowingStatusCounts[req.status] || 0) + 1;
	});

	// Count by status for lending
	const { data: lendingByStatus } = await supabase
		.from('ill_requests')
		.select('status')
		.eq('request_type', 'lending');

	const lendingStatusCounts: Record<string, number> = {};
	lendingByStatus?.forEach((req) => {
		lendingStatusCounts[req.status] = (lendingStatusCounts[req.status] || 0) + 1;
	});

	// Get pending requests that need attention
	const { data: pendingBorrowing } = await supabase
		.from('ill_requests')
		.select('*', { count: 'exact' })
		.eq('request_type', 'borrowing')
		.in('status', ['pending', 'approved']);

	const { data: pendingLending } = await supabase
		.from('ill_requests')
		.select('*', { count: 'exact' })
		.eq('request_type', 'lending')
		.eq('status', 'pending');

	return {
		stats: {
			totalBorrowing: borrowingStats.count || 0,
			totalLending: lendingStats.count || 0,
			activePartners: partnersData.count || 0,
			pendingBorrowing: pendingBorrowing?.length || 0,
			pendingLending: pendingLending?.length || 0,
			borrowingByStatus: borrowingStatusCounts,
			lendingByStatus: lendingStatusCounts
		},
		recentRequests: recentRequests.data || []
	};
};
