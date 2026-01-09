# Merge Conflict Resolution Guide

## Understanding the Conflicts

This PR restructures the entire route directory using SvelteKit route groups. We moved **162 files** from their old locations to new locations:

**Old Structure:**
```
src/routes/
├── admin/
│   ├── +layout.svelte
│   ├── cataloging/
│   ├── circulation/
│   └── ...
├── catalog/
├── my-account/
└── +page.svelte
```

**New Structure:**
```
src/routes/
├── (public)/           # NEW: Route group for public pages
│   ├── +layout.svelte  # NEW: Public layout
│   ├── +page.svelte    # Moved from root
│   ├── catalog/        # Moved from root
│   └── my-account/     # Moved from root
├── (admin)/            # NEW: Route group for admin
│   └── admin/          # All admin routes moved here
│       ├── +layout.svelte
│       ├── cataloging/
│       └── ...
└── +layout.svelte      # Simplified root layout
```

**Why This Causes Conflicts:**
If the main branch has ANY changes to files in the old locations since we branched, Git doesn't know whether to:
- Apply the changes to the old location (which we deleted)
- Apply the changes to the new location (which is the moved file)

---

## Resolution Strategy

### Option 1: Rebase (Recommended - Cleanest History)

This replays our commits on top of the latest main branch.

```bash
# 1. Fetch latest main
git fetch origin main

# 2. Start rebase
git rebase origin/main

# 3. For each conflict, Git will pause. You'll see:
#    - CONFLICT (rename/delete): File was deleted in our branch
#    - CONFLICT (content): File has conflicting changes

# 4. For RENAME conflicts:
#    The file was moved. Accept the new location with latest content:
git checkout --ours path/to/new/location/file
git add path/to/new/location/file

# 5. For DELETE conflicts (old location):
#    We intentionally deleted these - they're now in new location:
git rm path/to/old/location/file

# 6. Continue rebase
git rebase --continue

# 7. Repeat steps 4-6 until rebase completes

# 8. Force push (rebase rewrites history)
git push --force-with-lease origin copilot/restructure-routes-sveltekit
```

### Option 2: Merge (Easier, Messier History)

This merges main into our branch.

```bash
# 1. Fetch latest main
git fetch origin main

# 2. Merge main into our branch
git merge origin/main

# 3. Git should auto-detect most renames, but review conflicts

# 4. For each conflict file:
#    - Check if it's in old location (deleted) or new location (moved)
#    - If moved: Accept version with latest changes
#    - If deleted: Confirm it exists in new location

# 5. Commit the merge
git commit -m "Merge main into route groups restructure"

# 6. Push normally
git push origin copilot/restructure-routes-sveltekit
```

---

## Handling Specific Conflict Types

### Type 1: File Moved + Content Changed in Main

**Example:** `src/routes/admin/cataloging/+page.svelte` was:
- Moved to `src/routes/(admin)/admin/cataloging/+page.svelte` (our change)
- Modified with new features (main branch change)

**Resolution:**
```bash
# Accept the new location with main's changes
cp .git/merge-backup/src/routes/admin/cataloging/+page.svelte \
   src/routes/(admin)/admin/cataloging/+page.svelte

# OR manually merge changes
git add src/routes/(admin)/admin/cataloging/+page.svelte
git rm src/routes/admin/cataloging/+page.svelte
```

### Type 2: File Moved + Deleted in Main

**Example:** File was moved in our branch but deleted in main.

**Resolution:**
```bash
# If deletion was intentional in main:
git rm src/routes/(admin)/admin/path/to/file

# If we want to keep the moved file:
git add src/routes/(admin)/admin/path/to/file
```

### Type 3: New Files Added in Main to Old Location

**Example:** Main added `src/routes/admin/new-feature/+page.svelte`

**Resolution:**
```bash
# Move the new file to the new location
git mv src/routes/admin/new-feature \
       src/routes/(admin)/admin/new-feature
git add src/routes/(admin)/admin/new-feature
```

---

## Automated Conflict Resolution Script

For the common case where files were just moved, you can use this script:

```bash
#!/bin/bash
# resolve-route-moves.sh

# List all conflicts
git status --short | grep '^[ADU]' | while read status file; do
  echo "Processing: $status $file"
  
  # Check if file was moved from admin/ to (admin)/admin/
  if [[ $file == src/routes/admin/* ]]; then
    new_location="${file/src\/routes\/admin/src\/routes\/(admin)\/admin}"
    if [ -f "$new_location" ]; then
      echo "  Moved to: $new_location"
      git rm "$file"
      git add "$new_location"
    fi
  fi
  
  # Check if file was moved from root to (public)/
  if [[ $file == src/routes/catalog/* ]] || [[ $file == src/routes/my-account/* ]]; then
    new_location="${file/src\/routes/src\/routes\/(public)}"
    if [ -f "$new_location" ]; then
      echo "  Moved to: $new_location"
      git rm "$file"
      git add "$new_location"
    fi
  fi
done
```

**Usage:**
```bash
chmod +x resolve-route-moves.sh
./resolve-route-moves.sh
git rebase --continue
```

---

## Verification After Resolution

After resolving conflicts, verify the structure:

```bash
# Check that old structure is gone
ls src/routes/admin/  # Should not exist
ls src/routes/catalog/  # Should not exist (now in (public)/)

# Check that new structure exists
ls src/routes/(admin)/admin/
ls src/routes/(public)/catalog/

# Verify URLs still work (route groups don't affect URLs)
# /admin/cataloging should still map to (admin)/admin/cataloging
# /catalog/search should still map to (public)/catalog/search
```

---

## If You Get Stuck

If conflict resolution becomes too complex:

**Option 3: Cherry-pick Approach**

1. Create a new branch from latest main
2. Manually move files to new structure
3. Apply only the code changes (not file moves) from this PR
4. Test everything works
5. Create new PR

```bash
git checkout -b restructure-v2 origin/main
# Manually create route groups and move files
# Copy code changes from this PR (not file moves)
git commit -am "Restructure routes with route groups"
```

---

## Need Help?

If you encounter specific conflicts you're unsure about:

1. Run `git status` to see conflicted files
2. Check if file exists in new location: `find src/routes -name "filename"`
3. Compare old and new: `git show HEAD:old/path` vs `cat new/path`
4. Ask for help with specific files

---

## Expected Conflict Count

Based on our changes:
- **~162 file moves** (routes restructure)
- **~5-10 content changes** (layout simplification, facets fix)

If main branch modified files in old locations, expect:
- **High:** 100+ conflicts (if main had extensive route file changes)
- **Medium:** 20-50 conflicts (if main had some route updates)
- **Low:** 5-10 conflicts (if main had minimal route changes)

Most conflicts are mechanical (file moves) and can be batch-resolved with the script above.
