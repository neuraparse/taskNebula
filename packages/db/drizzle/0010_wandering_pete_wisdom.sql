ALTER TABLE "organizations" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "stripe_price_id" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "stripe_current_period_end" timestamp;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_stripe_customer_idx" ON "organizations" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_stripe_subscription_idx" ON "organizations" USING btree ("stripe_subscription_id");