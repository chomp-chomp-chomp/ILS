import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { mergeSiteConfig } from '$lib/types/site-config';
import type { SiteConfiguration } from '$lib/types/site-config';

/**
 * GET /api/site-config
 * Returns the active site configuration, falling back to defaults if missing
 */
export const GET: RequestHandler = async ({ locals: { supabase } }) => {
  try {
    // Try to fetch active configuration
    const { data, error: dbError } = await supabase
      .from('site_configuration')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    if (dbError) {
      console.warn('[Site Config API] Database error, returning defaults:', dbError.message);
      // Return defaults if table doesn't exist or other DB error
      return json({ success: true, config: mergeSiteConfig(null) });
    }

    // Merge with defaults to ensure all fields are present
    const config = mergeSiteConfig(data);

    return json({ success: true, config });
  } catch (err) {
    console.error('[Site Config API] Exception in GET:', err);
    // Return defaults on any error - never crash
    return json({ success: true, config: mergeSiteConfig(null) });
  }
};

/**
 * PUT /api/site-config
 * Updates the active site configuration (requires authentication)
 */
export const PUT: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
  try {
    // Check authentication
    const { session } = await safeGetSession();
    if (!session) {
      throw error(401, 'Unauthorized - Authentication required');
    }

    const body = await request.json() as Partial<SiteConfiguration>;
    
    console.log('[Site Config API] Received update from user:', session.user.id);

    // Build update payload
    const updatePayload = {
      header_enabled: body.header_enabled ?? false,
      header_logo_url: body.header_logo_url || null,
      header_links: body.header_links || [],
      footer_enabled: body.footer_enabled ?? false,
      footer_text: body.footer_text || '',
      footer_links: body.footer_links || [],
      homepage_info_enabled: body.homepage_info_enabled ?? false,
      homepage_info_title: body.homepage_info_title || '',
      homepage_info_content: body.homepage_info_content || '',
      homepage_info_links: body.homepage_info_links || [],
      theme_mode: body.theme_mode || 'system',
      theme_light: body.theme_light || {},
      theme_dark: body.theme_dark || {},
      page_themes: body.page_themes || {},
      updated_by: session.user.id
    };

    // Check if an active configuration exists
    const { data: existing, error: existingError } = await supabase
      .from('site_configuration')
      .select('id')
      .eq('is_active', true)
      .maybeSingle();

    if (existingError && existingError.code !== 'PGRST116') {
      console.error('[Site Config API] Error checking existing config:', existingError);
      throw error(500, `Database error: ${existingError.message}`);
    }

    let result;

    if (existing) {
      // Update existing configuration
      console.log('[Site Config API] Updating existing configuration:', existing.id);
      
      const { data, error: updateError } = await supabase
        .from('site_configuration')
        .update(updatePayload)
        .eq('id', existing.id)
        .select()
        .single();

      if (updateError) {
        console.error('[Site Config API] Error updating:', updateError);
        throw error(500, `Failed to update configuration: ${updateError.message}`);
      }

      result = data;
    } else {
      // Create new configuration
      console.log('[Site Config API] Creating new configuration');
      
      const { data, error: insertError } = await supabase
        .from('site_configuration')
        .insert({
          ...updatePayload,
          is_active: true
        })
        .select()
        .single();

      if (insertError) {
        console.error('[Site Config API] Error inserting:', insertError);
        throw error(500, `Failed to create configuration: ${insertError.message}`);
      }

      result = data;
    }

    console.log('[Site Config API] Operation completed successfully');
    
    // Merge result with defaults before returning
    const mergedResult = mergeSiteConfig(result);
    
    return json({ success: true, config: mergedResult });
  } catch (err) {
    console.error('[Site Config API] Exception in PUT:', err);
    
    if (err instanceof Error && 'status' in err) {
      throw err;
    }
    
    throw error(500, 'Internal server error');
  }
};
