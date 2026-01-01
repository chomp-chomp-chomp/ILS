-- Cleanup helper for authority control rollout
-- Ensures conflicting function signatures are removed before applying later enhancements

-- Drop any prior find_unauthorized_headings signatures so subsequent migrations can recreate
DROP FUNCTION IF EXISTS find_unauthorized_headings(VARCHAR);
DROP FUNCTION IF EXISTS find_unauthorized_headings();
