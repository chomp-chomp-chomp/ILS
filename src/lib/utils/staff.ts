import type { SupabaseClient } from '@supabase/supabase-js';

const STAFF_ROLES = ['staff', 'faculty', 'librarian', 'admin'];

export async function getStaffContext(supabase: SupabaseClient) {
	const {
		data: { session }
	} = await supabase.auth.getSession();

	if (!session) {
		return { session: null, isStaff: false };
	}

	const { data, error } = await supabase
		.from('patrons')
		.select('patron_type:patron_types(name)')
		.eq('user_id', session.user.id)
		.maybeSingle();

	if (error) {
		console.error('Failed to fetch patron type', error);
	}

	const patronType = Array.isArray(data?.patron_type)
		? data?.patron_type[0]?.name
		: (data as any)?.patron_type?.name;
	const role = patronType?.toLowerCase?.();
	const isStaff = role ? STAFF_ROLES.includes(role) : false;

	return { session, isStaff };
}
