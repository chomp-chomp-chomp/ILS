<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<div style="padding: 20px; font-family: monospace; background: #f5f5f5; min-height: 100vh;">
  <h1 style="color: #e73b42;">🔍 Branding Debug Page</h1>

  <p style="background: white; padding: 10px; border-radius: 4px;">
    <strong>Timestamp:</strong> {data.timestamp}
  </p>

  {#if data.error}
    <div style="background: #f8d7da; color: #721c24; padding: 15px; border-radius: 4px; margin: 20px 0;">
      <strong>❌ Error loading branding:</strong><br>
      {data.error}
    </div>
  {:else if !data.branding}
    <div style="background: #fff3cd; color: #856404; padding: 15px; border-radius: 4px; margin: 20px 0;">
      <strong>⚠️ No branding data found</strong><br>
      The database returned null/undefined
    </div>
  {:else}
    <div style="background: #d4edda; color: #155724; padding: 15px; border-radius: 4px; margin: 20px 0;">
      <strong>✅ Branding data loaded successfully</strong>
    </div>

    <h2 style="margin-top: 30px; color: #333;">Footer Settings</h2>
    <table style="width: 100%; background: white; border-collapse: collapse; margin: 10px 0;">
      <tr style="border-bottom: 1px solid #ddd;">
        <td style="padding: 10px; font-weight: bold; width: 200px;">footer_text:</td>
        <td style="padding: 10px; background: #f9f9f9;">"{data.branding.footer_text}"</td>
      </tr>
      <tr style="border-bottom: 1px solid #ddd;">
        <td style="padding: 10px; font-weight: bold;">show_powered_by:</td>
        <td style="padding: 10px; background: #f9f9f9;">{data.branding.show_powered_by}</td>
      </tr>
    </table>

    <h2 style="margin-top: 30px; color: #333;">Header Settings</h2>
    <table style="width: 100%; background: white; border-collapse: collapse; margin: 10px 0;">
      <tr style="border-bottom: 1px solid #ddd;">
        <td style="padding: 10px; font-weight: bold; width: 200px;">show_header:</td>
        <td style="padding: 10px; background: #f9f9f9;">{data.branding.show_header}</td>
      </tr>
      <tr style="border-bottom: 1px solid #ddd;">
        <td style="padding: 10px; font-weight: bold;">header_links count:</td>
        <td style="padding: 10px; background: #f9f9f9;">{data.branding.header_links?.length || 0}</td>
      </tr>
    </table>

    {#if data.branding.header_links && data.branding.header_links.length > 0}
      <h3 style="margin-top: 20px; color: #666;">Header Links:</h3>
      <ul style="background: white; padding: 20px; margin: 10px 0;">
        {#each data.branding.header_links as link}
          <li style="margin: 5px 0;">
            <strong>{link.order}.</strong> {link.title} → {link.url}
          </li>
        {/each}
      </ul>
    {/if}

    <h2 style="margin-top: 30px; color: #333;">All Branding Data (Raw JSON)</h2>
    <pre style="background: white; padding: 15px; border-radius: 4px; overflow-x: auto; font-size: 12px;">
{JSON.stringify(data.branding, null, 2)}
    </pre>
  {/if}

  <div style="margin-top: 30px; padding: 15px; background: #e7f3ff; border-radius: 4px;">
    <p><strong>📱 Mobile-Friendly Debug Page</strong></p>
    <p>This page shows exactly what branding data is being loaded from the database.</p>
    <p>Visit <a href="/" style="color: #e73b42;">homepage</a> or <a href="/catalog/search?q=test" style="color: #e73b42;">search page</a> to see if it matches what's displayed.</p>
  </div>
</div>
