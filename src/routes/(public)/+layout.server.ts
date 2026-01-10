import { loadUnifiedSiteSettings } from '$lib/server/unifiedSiteSettings';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { safeGetSession, supabase }, cookies }) => {
  const { session } = await safeGetSession();

  // Load unified site settings (includes branding, header, footer, hero - all in one)
  const unified = await loadUnifiedSiteSettings(supabase);

  // Transform flat structure to nested structure that layout expects
  const siteSettings = {
    header: {
      links: unified.header_links || []
    },
    footer: {
      text: unified.footer_text || '',
      link: unified.footer_link || '',
      links: [], // Legacy field
      backgroundColor: '#2c3e50',
      textColor: 'rgba(255, 255, 255, 0.9)',
      linkColor: 'rgba(255, 255, 255, 0.9)',
      linkHoverColor: '#e73b42',
      padding: '2rem 0'
    },
    hero: {
      title: unified.hero_title || '',
      subhead: unified.hero_subhead || '',
      imageUrl: unified.hero_image_url || '',
      minHeight: '250px',
      mobileMinHeight: '200px'
    },
    typography: {
      h1Size: '2.5rem',
      h2Size: '2rem',
      h3Size: '1.75rem',
      h4Size: '1.5rem',
      h5Size: '1.25rem',
      h6Size: '1rem',
      pSize: '1rem',
      smallSize: '0.875rem',
      lineHeight: '1.6'
    }
  };

  // Pass branding as flat structure (as expected by layout)
  const branding = {
    library_name: unified.library_name,
    library_tagline: unified.library_tagline,
    logo_url: unified.logo_url,
    homepage_logo_url: unified.homepage_logo_url,
    favicon_url: unified.favicon_url,
    primary_color: unified.primary_color,
    secondary_color: unified.secondary_color,
    accent_color: unified.accent_color,
    background_color: unified.background_color,
    text_color: unified.text_color,
    font_family: unified.font_family,
    heading_font: unified.heading_font,
    custom_css: unified.custom_css,
    custom_head_html: unified.custom_head_html,
    contact_email: unified.contact_email,
    contact_phone: unified.contact_phone,
    contact_address: unified.contact_address,
    facebook_url: unified.facebook_url,
    twitter_url: unified.twitter_url,
    instagram_url: unified.instagram_url,
    show_covers: unified.show_covers,
    show_facets: unified.show_facets,
    items_per_page: unified.items_per_page,
    // Typography fields
    font_size_h1: '2.5rem',
    font_size_h2: '2rem',
    font_size_h3: '1.5rem',
    font_size_h4: '1.25rem',
    font_size_p: '1rem',
    font_size_small: '0.875rem',
    // Footer styling
    footer_background_color: '#2c3e50',
    footer_text_color: '#ffffff',
    footer_link_color: '#ff6b72',
    footer_padding: '2rem 0',
    footer_content: null
  };

  return {
    session,
    cookies: cookies.getAll(),
    siteSettings,  // Nested structure for layout
    branding,      // Flat structure with all branding fields
    settings: unified  // Original unified settings
  };
};
