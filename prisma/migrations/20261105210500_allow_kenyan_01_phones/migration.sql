ALTER TABLE "Member"
DROP CONSTRAINT "Member_phone_format",
ADD CONSTRAINT "Member_phone_format"
CHECK ("phone" ~ '^254[17][0-9]{8}$');

ALTER TABLE "Member"
DROP CONSTRAINT "Member_emergency_phone_format",
ADD CONSTRAINT "Member_emergency_phone_format"
CHECK ("emergencyContactPhone" = '' OR "emergencyContactPhone" ~ '^254[17][0-9]{8}$');
