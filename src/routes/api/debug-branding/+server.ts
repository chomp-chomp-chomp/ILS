import { loadActiveBranding } from '$lib/server/branding';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals: { supabase } }) => {
  const { branding, error } = await loadActiveBranding(supabase);

  return json({
    success: !error,
    error: error?.message || null,
    timestamp: new Date().toISOString(),
    branding: branding || null,
    key_values: branding ? {
      footer_text: branding.footer_text,
      show_powered_by: branding.show_powered_by,
      show_header: branding.show_header,
      header_links_count: branding.header_links?.length || 0,
      header_links: branding.header_links
    } : null
  }, {
    headers: {
      'cache-control': 'no-cache, no-store, must-revalidate'
    }
  });
};
