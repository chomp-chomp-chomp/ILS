# Branding Configuration Fix - Testing Guide

## Overview
This document provides step-by-step instructions to test the branding configuration persistence fix.

## Prerequisites
1. Access to Supabase SQL Editor
2. Admin access to the ILS application (`/admin/branding`)
3. Browser developer console open to view logs

## Test Steps

### Step 1: Check Database Schema

**Run the diagnostic SQL script in Supabase:**

1. Open Supabase SQL Editor
2. Run the script: `DIAGNOSE_BRANDING_PERSISTENCE.sql`
3. Review the output, specifically:
   - Section 6: "Missing Columns Check" - All columns should show "✅ EXISTS"
   - If any show "❌ MISSING", you need to run migration `024_header_homepage_info.sql`

**Expected Missing Columns (if migration not applied):**
- `show_header`
- `header_links`
- `show_homepage_info`
- `homepage_info_title`
- `homepage_info_content`
- `homepage_info_links`

**To Apply Migration:**
```sql
-- Run in Supabase SQL Editor
-- File: migrations/024_header_homepage_info.sql
-- Copy and paste the entire contents and execute
```

### Step 2: Test Footer Settings Update

1. **Navigate to admin branding page:**
   - Go to `/admin/branding`
   - Open browser developer console (F12)

2. **Modify footer settings:**
   - Change "Footer Text" to: `"Test Footer Text $(Date.now())"`
   - Toggle "Show 'Powered by' footer" checkbox
   - Click "Save Changes"

3. **Check console logs:**
   - Look for `[Branding UI]` logs showing the save operation
   - Look for `[Branding API]` logs showing the update
   - Verify no errors appear

4. **Expected console output:**
   ```
   [Branding UI] Starting save operation...
   [Branding UI] Current branding state: { ... show_powered_by: true, footer_text: "Test Footer Text 1234567890" ... }
   [Branding UI] Validation passed
   [Branding UI] Authenticated, making API request...
   [Branding API] User authenticated: <user-id>
   [Branding API] Received update payload: { ... }
   [Branding API] Checking for existing active configuration...
   [Branding API] Existing configuration: Found (ID: <uuid>)
   [Branding API] Updating existing configuration ID: <uuid>
   [Branding API] Update payload keys: [...includes show_powered_by, footer_text...]
   [Branding API] show_powered_by value: true
   [Branding API] footer_text value: "Test Footer Text 1234567890"
   [Branding API] Update successful. Returned data: { ... }
   [Branding API] Operation completed successfully
   [Branding UI] API response status: 200
   [Branding UI] API success response: { success: true, branding: {...} }
   ```

5. **Verify in database:**
   ```sql
   -- Run in Supabase SQL Editor
   SELECT 
     show_powered_by, 
     footer_text, 
     updated_at 
   FROM branding_configuration 
   WHERE is_active = true;
   ```
   - Should show your new values
   - `updated_at` should be recent

### Step 3: Test Header Settings Update

1. **Modify header settings:**
   - Toggle "Show header navigation on all pages" checkbox ON
   - Add a header link:
     - Title: "Test Link"
     - URL: "/test"
   - Click "Save Changes"

2. **Check console logs:**
   - Verify `show_header` is in the update payload
   - Verify `header_links` array is included

3. **Verify in database:**
   ```sql
   SELECT 
     show_header, 
     header_links::text,
     updated_at 
   FROM branding_configuration 
   WHERE is_active = true;
   ```

### Step 4: Test Homepage Info Settings

1. **Modify homepage info:**
   - Toggle "Show info section on homepage" ON
   - Change "Section Title" to "Library Resources"
   - Add content: `<p>Welcome to our test library!</p>`
   - Add a quick link:
     - Title: "Hours"
     - URL: "/pages/hours"
   - Click "Save Changes"

2. **Verify in database:**
   ```sql
   SELECT 
     show_homepage_info,
     homepage_info_title,
     homepage_info_content,
     homepage_info_links::text,
     updated_at 
   FROM branding_configuration 
   WHERE is_active = true;
   ```

### Step 5: Verify Changes Reflect on Public Pages

1. **Check footer on homepage:**
   - Navigate to `/` (homepage)
   - Check if footer text appears as configured
   - Verify "Show powered by" setting is respected

2. **Check header (if enabled):**
   - Verify header navigation appears
   - Verify links are present

3. **Check homepage info section (if enabled):**
   - Verify info section appears below search
   - Verify title, content, and links are displayed

4. **Force reload to clear cache:**
   - Press Ctrl+Shift+R (or Cmd+Shift+R on Mac)
   - Check again

## Troubleshooting

### Issue: "Failed to update branding" error

**Possible causes:**
1. Missing database columns → Run migration 024
2. RLS policy blocking update → Check authentication
3. Invalid data → Check validation errors in console

**Debug steps:**
1. Check full error message in console
2. Run diagnostic SQL script
3. Check Supabase logs in dashboard
4. Verify user is authenticated

### Issue: Updates save but don't show on public pages

**Possible causes:**
1. Browser cache
2. Vercel edge cache (production only)

**Debug steps:**
1. Hard refresh (Ctrl+Shift+R)
2. Check browser dev tools → Network tab → Disable cache
3. Open incognito window
4. For Vercel: Wait 60 seconds for cache to clear

### Issue: Some fields update but not others (e.g., footer_text)

**Possible causes:**
1. Database columns missing
2. RLS policy too restrictive
3. Validation error

**Debug steps:**
1. Run diagnostic SQL: `DIAGNOSE_BRANDING_PERSISTENCE.sql`
2. Check "Missing Columns" section
3. Apply migration 024 if needed
4. Check console for validation errors

## Success Criteria

✅ All database columns exist (from diagnostic script)
✅ Footer settings update and persist
✅ Header settings update and persist
✅ Homepage info settings update and persist
✅ Changes reflect on public pages after refresh
✅ No errors in console logs
✅ Database shows updated values with recent `updated_at` timestamp

## Logging Reference

### UI Log Messages
- `[Branding UI] Starting save operation...` - Save initiated
- `[Branding UI] Current branding state:` - Shows what's being saved
- `[Branding UI] Validation passed` - Client-side validation succeeded
- `[Branding UI] API response status:` - HTTP status code
- `[Branding UI] API success response:` - Server response on success

### API Log Messages
- `[Branding API] User authenticated:` - User ID verified
- `[Branding API] Received update payload:` - Full request body
- `[Branding API] Existing configuration:` - Found/Not found + ID
- `[Branding API] Updating existing configuration ID:` - Update operation
- `[Branding API] Update payload keys:` - Fields being updated
- `[Branding API] show_powered_by value:` - Specific field value
- `[Branding API] Update successful. Returned data:` - Success response
- `[Branding API] Operation completed successfully` - Final success

### Error Log Messages
- `[Branding API] Unauthorized access attempt` - Not authenticated
- `[Branding API] Validation failed:` - Validation errors array
- `[Branding API] Error updating branding:` - Supabase error
- `[Branding UI] Validation errors:` - Client-side validation failures
- `[Branding UI] API error response:` - Server returned error

## Next Steps After Testing

If tests pass:
1. Document any issues found
2. Verify in production environment (if applicable)
3. Close the GitHub issue

If tests fail:
1. Capture console logs
2. Capture database query results
3. Note which specific fields are not persisting
4. Report findings in the GitHub issue
