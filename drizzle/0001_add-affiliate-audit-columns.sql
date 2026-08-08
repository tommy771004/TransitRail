ALTER TABLE "TN_AUDIT_LOG" ADD COLUMN IF NOT EXISTS "target" text;
--> statement-breakpoint
ALTER TABLE "TN_AUDIT_LOG" ADD COLUMN IF NOT EXISTS "metadata" jsonb;
