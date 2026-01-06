import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { createClient, type SupabaseClient, type PostgrestError } from '@supabase/supabase-js';

let serviceClient: SupabaseClient | null = null;

function getBrandingClient(fallback: SupabaseClient) {
	// Prefer the service role key when available so branding can be read without anon permissions
	const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

	if (serviceRoleKey) {
		if (!serviceClient) {
			serviceClient = createClient(PUBLIC_SUPABASE_URL, serviceRoleKey, {
				auth: {
					autoRefreshToken: false,
					persistSession: false
				}
			});
		}
		return serviceClient;
	}

	return fallback;
}

export async function loadActiveBranding(
	supabase: SupabaseClient
): Promise<{ branding: Record<string, any> | null; error: PostgrestError | null }> {
	const client = getBrandingClient(supabase);

	const { data, error } = await client
		.from('branding_configuration')
		.select('*')
		.eq('is_active', true)
		.order('updated_at', { ascending: false })
		.limit(1)
		.maybeSingle();
		.single();

	if (error) {
		console.error('Error loading branding configuration:', error);
	}

	return {
		branding: data || null,
		error
	};
}
