CREATE TABLE "attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"demand_id" integer,
	"public_work_id" integer,
	"uploaded_by_id" integer,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "attachments_single_owner" CHECK (("attachments"."demand_id" IS NOT NULL)::int + ("attachments"."public_work_id" IS NOT NULL)::int = 1),
	CONSTRAINT "attachments_size_positive" CHECK ("attachments"."size_bytes" > 0)
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_demand_id_demands_id_fk" FOREIGN KEY ("demand_id") REFERENCES "public"."demands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_public_work_id_public_works_id_fk" FOREIGN KEY ("public_work_id") REFERENCES "public"."public_works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachments_demand_id_idx" ON "attachments" USING btree ("demand_id");--> statement-breakpoint
CREATE INDEX "attachments_public_work_id_idx" ON "attachments" USING btree ("public_work_id");--> statement-breakpoint
CREATE INDEX "attachments_uploaded_by_created_idx" ON "attachments" USING btree ("uploaded_by_id","created_at");