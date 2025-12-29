import type { PageServerLoad } from './$types';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface DashboardStats {
	totalRecords: number;
	activeSerials: number;
	totalHoldings: number;
	totalPatrons: number;
	activeCheckouts: number;
	overdueItems: number;
}

export interface CirculationTrend {
	date: string;
	checkouts: number;
	checkins: number;
}

export interface CollectionGrowth {
	month: string;
	records: number;
	cumulative: number;
}

export interface TopItem {
	id: number;
	title: string;
	author: string;
	checkoutCount: number;
}

export interface PatronActivity {
	patron_type: string;
	count: number;
	activeCount: number;
}

export interface BudgetAllocation {
	budget_name: string;
	allocated: number;
	spent: number;
	remaining: number;
}

export const load: PageServerLoad = async ({ locals }) => {
	const supabase = locals.supabase as SupabaseClient;

	try {
		// Load all dashboard data in parallel
		const [stats, circulationTrends, collectionGrowth, topItems, patronActivity, budgetData] =
			await Promise.all([
				loadDashboardStats(supabase),
				loadCirculationTrends(supabase),
				loadCollectionGrowth(supabase),
				loadTopItems(supabase),
				loadPatronActivity(supabase),
				loadBudgetData(supabase)
			]);

		return {
			stats,
			circulationTrends,
			collectionGrowth,
			topItems,
			patronActivity,
			budgetData
		};
	} catch (error) {
		console.error('Dashboard loading error:', error);
		return {
			stats: {
				totalRecords: 0,
				activeSerials: 0,
				totalHoldings: 0,
				totalPatrons: 0,
				activeCheckouts: 0,
				overdueItems: 0
			},
			circulationTrends: [],
			collectionGrowth: [],
			topItems: [],
			patronActivity: [],
			budgetData: []
		};
	}
};

async function loadDashboardStats(supabase: SupabaseClient): Promise<DashboardStats> {
	const [recordsResult, serialsResult, holdingsResult, patronsResult, checkoutsResult] =
		await Promise.all([
			supabase.from('marc_records').select('id', { count: 'exact', head: true }),
			supabase
				.from('serials')
				.select('id', { count: 'exact', head: true })
				.eq('status', 'active'),
			supabase.from('items').select('id', { count: 'exact', head: true }),
			supabase.from('patrons').select('id', { count: 'exact', head: true }),
			supabase.from('checkouts').select('*')
		]);

	const checkouts = checkoutsResult.data || [];
	const now = new Date();

	const activeCheckouts = checkouts.filter((c) => !c.checked_in_at).length;
	const overdueItems = checkouts.filter((c) => {
		if (c.checked_in_at) return false;
		const dueDate = new Date(c.due_date);
		return dueDate < now;
	}).length;

	return {
		totalRecords: recordsResult.count || 0,
		activeSerials: serialsResult.count || 0,
		totalHoldings: holdingsResult.count || 0,
		totalPatrons: patronsResult.count || 0,
		activeCheckouts,
		overdueItems
	};
}

async function loadCirculationTrends(
	supabase: SupabaseClient
): Promise<CirculationTrend[]> {
	// Get last 30 days of circulation data
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

	const { data: checkouts } = await supabase
		.from('checkouts')
		.select('checked_out_at, checked_in_at')
		.gte('checked_out_at', thirtyDaysAgo.toISOString())
		.order('checked_out_at', { ascending: true });

	if (!checkouts || checkouts.length === 0) return [];

	// Group by date
	const trendMap = new Map<string, { checkouts: number; checkins: number }>();

	checkouts.forEach((checkout) => {
		// Count checkout
		const checkoutDate = checkout.checked_out_at.split('T')[0];
		if (!trendMap.has(checkoutDate)) {
			trendMap.set(checkoutDate, { checkouts: 0, checkins: 0 });
		}
		trendMap.get(checkoutDate)!.checkouts++;

		// Count checkin if exists
		if (checkout.checked_in_at) {
			const checkinDate = checkout.checked_in_at.split('T')[0];
			if (!trendMap.has(checkinDate)) {
				trendMap.set(checkinDate, { checkouts: 0, checkins: 0 });
			}
			trendMap.get(checkinDate)!.checkins++;
		}
	});

	return Array.from(trendMap.entries())
		.map(([date, counts]) => ({
			date,
			checkouts: counts.checkouts,
			checkins: counts.checkins
		}))
		.sort((a, b) => a.date.localeCompare(b.date));
}

async function loadCollectionGrowth(
	supabase: SupabaseClient
): Promise<CollectionGrowth[]> {
	// Get all records with creation dates
	const { data: records } = await supabase
		.from('marc_records')
		.select('created_at')
		.order('created_at', { ascending: true });

	if (!records || records.length === 0) return [];

	// Group by month
	const monthMap = new Map<string, number>();

	records.forEach((record) => {
		const date = new Date(record.created_at);
		const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
		monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + 1);
	});

	// Convert to cumulative growth
	let cumulative = 0;
	return Array.from(monthMap.entries())
		.sort((a, b) => a[0].localeCompare(b[0]))
		.map(([month, count]) => {
			cumulative += count;
			return {
				month,
				records: count,
				cumulative
			};
		});
}

async function loadTopItems(supabase: SupabaseClient): Promise<TopItem[]> {
	// Get checkout counts per item
	const { data: checkouts } = await supabase
		.from('checkouts')
		.select(
			`
			item_id,
			items:item_id (
				marc_record_id,
				marc_records:marc_record_id (
					id,
					title_statement,
					main_entry_personal_name
				)
			)
		`
		)
		.not('items', 'is', null);

	if (!checkouts || checkouts.length === 0) return [];

	// Count checkouts per record
	const countMap = new Map<
		number,
		{ title: string; author: string; count: number }
	>();

	checkouts.forEach((checkout: any) => {
		if (!checkout.items?.marc_records) return;

		const record = checkout.items.marc_records;
		const id = record.id;

		if (!countMap.has(id)) {
			countMap.set(id, {
				title: record.title_statement?.a || 'Unknown',
				author: record.main_entry_personal_name?.a || 'Unknown',
				count: 0
			});
		}

		countMap.get(id)!.count++;
	});

	// Sort by count and take top 10
	return Array.from(countMap.entries())
		.map(([id, data]) => ({
			id,
			title: data.title,
			author: data.author,
			checkoutCount: data.count
		}))
		.sort((a, b) => b.checkoutCount - a.checkoutCount)
		.slice(0, 10);
}

async function loadPatronActivity(
	supabase: SupabaseClient
): Promise<PatronActivity[]> {
	const { data: patrons } = await supabase.from('patrons').select(
		`
		patron_type,
		id,
		checkouts:checkouts(id, checked_in_at)
	`
	);

	if (!patrons || patrons.length === 0) return [];

	// Group by patron type
	const activityMap = new Map<string, { count: number; activeCount: number }>();

	patrons.forEach((patron: any) => {
		const type = patron.patron_type || 'unknown';

		if (!activityMap.has(type)) {
			activityMap.set(type, { count: 0, activeCount: 0 });
		}

		const activity = activityMap.get(type)!;
		activity.count++;

		// Check if patron has active checkouts
		const hasActiveCheckouts = patron.checkouts?.some((c: any) => !c.checked_in_at);
		if (hasActiveCheckouts) {
			activity.activeCount++;
		}
	});

	return Array.from(activityMap.entries()).map(([patron_type, data]) => ({
		patron_type,
		count: data.count,
		activeCount: data.activeCount
	}));
}

async function loadBudgetData(supabase: SupabaseClient): Promise<BudgetAllocation[]> {
	const { data: budgets } = await supabase.from('budgets').select(
		`
		name,
		allocated_amount,
		invoices:invoices(amount)
	`
	);

	if (!budgets || budgets.length === 0) return [];

	return budgets.map((budget: any) => {
		const allocated = budget.allocated_amount || 0;
		const spent =
			budget.invoices?.reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0) || 0;
		const remaining = allocated - spent;

		return {
			budget_name: budget.name,
			allocated,
			spent,
			remaining: Math.max(0, remaining)
		};
	});
}
