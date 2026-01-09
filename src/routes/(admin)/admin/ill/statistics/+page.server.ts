import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	// Get overall statistics
	const [borrowingData, lendingData, partnersData, shipmentsData] = await Promise.all([
		supabase.from('ill_requests').select('*').eq('request_type', 'borrowing'),
		supabase.from('ill_requests').select('*').eq('request_type', 'lending'),
		supabase
			.from('ill_partners')
			.select('id, library_name, total_borrowed, total_lent, is_active')
			.order('total_borrowed', { ascending: false })
			.limit(10),
		supabase.from('ill_shipments').select('*')
	]);

	// Calculate borrowing statistics by status
	const borrowingByStatus: Record<string, number> = {};
	borrowingData.data?.forEach((req) => {
		borrowingByStatus[req.status] = (borrowingByStatus[req.status] || 0) + 1;
	});

	// Calculate lending statistics by status
	const lendingByStatus: Record<string, number> = {};
	lendingData.data?.forEach((req) => {
		lendingByStatus[req.status] = (lendingByStatus[req.status] || 0) + 1;
	});

	// Calculate monthly statistics (last 12 months)
	const monthlyStats: Array<{ month: string; borrowed: number; lent: number }> = [];
	const now = new Date();

	for (let i = 11; i >= 0; i--) {
		const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
		const monthKey = date.toISOString().slice(0, 7); // YYYY-MM format
		const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

		const borrowed =
			borrowingData.data?.filter(
				(r) => r.created_at && r.created_at.startsWith(monthKey)
			).length || 0;
		const lent =
			lendingData.data?.filter((r) => r.created_at && r.created_at.startsWith(monthKey)).length ||
			0;

		monthlyStats.push({
			month: monthName,
			borrowed,
			lent
		});
	}

	// Calculate average turnaround time (days from created to completed)
	const completedBorrowing = borrowingData.data?.filter((r) => r.status === 'completed') || [];
	const avgBorrowingTime =
		completedBorrowing.length > 0
			? completedBorrowing.reduce((sum, req) => {
					const created = new Date(req.created_at);
					const completed = new Date(req.completed_date || req.updated_at);
					return sum + (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
				}, 0) / completedBorrowing.length
			: 0;

	const completedLending = lendingData.data?.filter((r) => r.status === 'completed') || [];
	const avgLendingTime =
		completedLending.length > 0
			? completedLending.reduce((sum, req) => {
					const created = new Date(req.created_at);
					const completed = new Date(req.completed_date || req.updated_at);
					return sum + (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
				}, 0) / completedLending.length
			: 0;

	return {
		stats: {
			totalBorrowing: borrowingData.data?.length || 0,
			totalLending: lendingData.data?.length || 0,
			totalPartners: partnersData.data?.length || 0,
			totalShipments: shipmentsData.data?.length || 0,
			borrowingByStatus,
			lendingByStatus,
			avgBorrowingTime: Math.round(avgBorrowingTime),
			avgLendingTime: Math.round(avgLendingTime),
			completedBorrowing: completedBorrowing.length,
			completedLending: completedLending.length
		},
		monthlyStats,
		topPartners: partnersData.data || []
	};
};
