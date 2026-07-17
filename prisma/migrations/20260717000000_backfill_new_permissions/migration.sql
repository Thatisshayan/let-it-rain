-- Update existing users to include VIEW_AUDIT_LOG and MANAGE_SETTINGS permissions
UPDATE "User" 
SET "permissions" = "permissions" || ARRAY['VIEW_AUDIT_LOG', 'MANAGE_SETTINGS']::TEXT[]
WHERE NOT ('VIEW_AUDIT_LOG' = ANY("permissions")) OR NOT ('MANAGE_SETTINGS' = ANY("permissions"));