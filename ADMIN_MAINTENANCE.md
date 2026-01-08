# Admin Maintenance Panel

## Overview

The Admin Maintenance Panel provides system administrators with tools to monitor system health, manage caches, perform database maintenance, and access quick links to important administrative functions.

**Location**: `/admin/maintenance`

## Features

### 1. System Health Dashboard

Real-time health monitoring with visual indicators:

- **Healthy** (✓): All systems operating normally
- **Warning** (⚠): Potential issues detected, action recommended
- **Error** (✗): Critical issues requiring immediate attention

#### Health Checks Include:

1. **Catalog Records** - Validates catalog database has records
2. **Facet Configuration** - Checks for active facet configurations
3. **Site Configuration** - Verifies active site configuration exists
4. **Facet Cache** - Monitors cache size and recommends clearing if over 1000 items

### 2. Database Statistics

Visual dashboard with color-coded cards showing:

- **Catalog Records**: Total bibliographic records in database
- **Physical Items**: Total physical/electronic items
- **Patrons**: Total registered patrons
- **Active Checkouts**: Currently checked out items
- **Facet Cache**: Cached facet values count
- **Active Facets**: Enabled facet configurations

### 3. Maintenance Actions

#### Clear Facet Cache
- **Purpose**: Remove all cached facet values to free up memory
- **When to Use**: 
  - Facet cache grows too large (>1000 items)
  - After bulk catalog updates
  - When facet display appears stale
- **Effect**: Facets will be recalculated on next search
- **API Endpoint**: `POST /api/facet-config/refresh-cache`

#### Reindex Search Vectors
- **Purpose**: Rebuild full-text search indexes for all catalog records
- **When to Use**:
  - After bulk imports
  - When search results seem incomplete
  - After database schema changes affecting search
- **Effect**: Updates PostgreSQL tsvector search indexes
- **Note**: Automatic reindexing occurs when records are updated individually

#### Analyze Database
- **Purpose**: Collect statistics to optimize PostgreSQL query performance
- **When to Use**:
  - After large data imports
  - Periodically (weekly/monthly for large catalogs)
  - When queries seem slow
- **Effect**: Updates PostgreSQL query planner statistics
- **Note**: Requires database administrator privileges for full ANALYZE

### 4. Recent Catalog Activity

Displays the 5 most recently added catalog records with:
- Title (linked to edit page)
- Timestamp of creation

### 5. Quick Links

Direct access to commonly used admin functions:

- **Search Configuration**: Configure search fields and behavior
- **Display Configuration**: Configure field display settings
- **Site Configuration**: Manage site branding and theme
- **MARC Import**: Import bibliographic records
- **MARC Export**: Export bibliographic records

## Access Control

- **Authentication Required**: Must be logged in as admin user
- **Route Protection**: Enforced by `/admin/+layout.server.ts`
- **Session Validation**: Uses Supabase authentication

## Database Queries

The maintenance panel executes the following queries on load:

```sql
-- Total records count
SELECT COUNT(*) FROM marc_records;

-- Total items count
SELECT COUNT(*) FROM items;

-- Total patrons count
SELECT COUNT(*) FROM patrons;

-- Active checkouts count
SELECT COUNT(*) FROM checkouts WHERE returned_at IS NULL;

-- Facet cache count
SELECT COUNT(*) FROM facet_values_cache;

-- Active facet configs count
SELECT COUNT(*) FROM facet_configuration WHERE is_enabled = true;

-- Recent records
SELECT id, title_statement, created_at 
FROM marc_records 
ORDER BY created_at DESC 
LIMIT 5;

-- Active site config
SELECT id, updated_at, updated_by 
FROM site_configuration 
WHERE is_active = true;
```

## Performance Considerations

- **Lightweight Queries**: All count queries use PostgreSQL's efficient count operations
- **Limited Results**: Recent activity limited to 5 records
- **Cached Data**: Consider implementing Redis caching for stats if catalog is very large (>100K records)
- **Background Jobs**: For large catalogs, consider moving maintenance tasks to background job queue

## Best Practices

### Regular Maintenance Schedule

**Daily**:
- Check system health dashboard
- Review recent activity

**Weekly**:
- Clear facet cache if needed
- Review database statistics

**Monthly**:
- Run database analysis
- Review and optimize slow queries
- Check for orphaned cache entries

**After Bulk Operations**:
- Clear facet cache
- Reindex search vectors
- Run database analysis

### Performance Optimization

1. **Facet Cache Management**
   - Clear cache after bulk catalog updates
   - Monitor cache size growth
   - Consider scheduled cache clearing for very active catalogs

2. **Search Index Maintenance**
   - Reindex after significant catalog changes
   - Monitor search performance
   - Consider periodic reindexing schedule

3. **Database Health**
   - Run ANALYZE after large imports (>1000 records)
   - Monitor query performance
   - Use database connection pooling

## Troubleshooting

### Common Issues

**Issue**: System health shows warnings
- **Solution**: Click on specific warning to see details and recommended actions

**Issue**: Facet cache very large
- **Solution**: Click "Clear Cache" and confirm. Facets will regenerate on next search.

**Issue**: Search results incomplete
- **Solution**: Try "Reindex Search Vectors" to rebuild search index

**Issue**: Slow query performance
- **Solution**: Run "Analyze Database" to update query statistics

### Error Messages

**"Failed to clear cache"**
- Check Supabase connection
- Verify API endpoint is accessible
- Check browser console for details

**"Unauthorized"**
- User session expired - re-login required
- User lacks admin privileges

**"Error loading maintenance data"**
- Database connection issue
- Check Supabase status
- Verify RLS policies allow read access

## API Endpoints Used

### GET `/admin/maintenance` (Server Load)
Loads all maintenance data including stats, recent records, and system health checks.

### POST `/api/facet-config/refresh-cache`
Clears the facet cache and returns success message.

**Response**:
```json
{
  "success": true,
  "message": "Facet cache cleared successfully"
}
```

## Future Enhancements

Planned features for future versions:

1. **Automated Maintenance Jobs**
   - Scheduled cache clearing
   - Automatic vacuum and analyze
   - Email notifications for warnings

2. **Enhanced Monitoring**
   - Query performance metrics
   - Cache hit/miss ratios
   - API response times

3. **Database Backups**
   - On-demand backup creation
   - Backup restoration
   - Backup schedule management

4. **System Logs**
   - Error log viewer
   - Activity audit trail
   - Performance log analysis

5. **Advanced Diagnostics**
   - Slow query analyzer
   - Index usage statistics
   - Table bloat detection

## Related Documentation

- [Site Configuration System](./SITE_CONFIGURATION.md)
- [Faceted Search Configuration](./migrations/018_faceted_search_configuration.sql)
- [MARC Import/Export](./CATALOGING_FEATURES.md)
- [Database Schema](./DATABASE_SCHEMA.md)

## Support

For issues or questions:
1. Check system health dashboard for warnings
2. Review error messages in browser console
3. Check Supabase logs for database errors
4. Consult related documentation above
