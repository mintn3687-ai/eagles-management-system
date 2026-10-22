ALTER TABLE "Member" ADD CONSTRAINT "Member_phone_format" CHECK ("phone" ~ '^2547[0-9]{8}$');
ALTER TABLE "Member" ADD CONSTRAINT "Member_emergency_phone_format" CHECK ("emergencyContactPhone" = '' OR "emergencyContactPhone" ~ '^2547[0-9]{8}$');
ALTER TABLE "FeeSetting" ADD CONSTRAINT "FeeSetting_nonnegative_amount" CHECK ("amount" >= 0);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_nonnegative_amount" CHECK ("amount" >= 0);
ALTER TABLE "FeeSetting" ADD CONSTRAINT "FeeSetting_billing_period" CHECK (
  ("type" = 'REGISTRATION' AND "billingPeriod" IS NULL) OR
  ("type" = 'SUBSCRIPTION' AND "billingPeriod" IS NOT NULL)
);
ALTER TABLE "User" ADD CONSTRAINT "User_email_normalized" CHECK ("email" = lower(trim("email")));
ALTER TABLE "Member" ADD CONSTRAINT "Member_email_normalized" CHECK ("email" = lower(trim("email")));
CREATE FUNCTION prevent_fee_history_changes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Fee history is append-only. Create a new fee setting.';
END;
$$;
CREATE TRIGGER "FeeSetting_append_only" BEFORE UPDATE OR DELETE ON "FeeSetting"
FOR EACH ROW EXECUTE FUNCTION prevent_fee_history_changes();
