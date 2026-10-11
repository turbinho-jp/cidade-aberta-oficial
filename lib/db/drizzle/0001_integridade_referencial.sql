-- Etapa 4: integridade referencial.
-- 1) Confere o que não dá para corrigir sozinho (aborta com mensagem clara).
-- 2) Remove duplicatas/órfãos que impediriam as constraints.
-- 3) Adiciona unicidade, chaves estrangeiras, checks e índices.
-- NÃO recalcula contadores: use `pnpm --filter @workspace/db run recount` (simulação por padrão).
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM "demands" d WHERE NOT EXISTS (SELECT 1 FROM "categories" c WHERE c."id" = d."category_id");
  IF n > 0 THEN RAISE EXCEPTION 'Migração abortada: % demanda(s) com category_id inexistente. Corrija esses registros e rode a migração novamente.', n; END IF;
  SELECT count(*) INTO n FROM "demands" d WHERE NOT EXISTS (SELECT 1 FROM "neighborhoods" b WHERE b."id" = d."neighborhood_id");
  IF n > 0 THEN RAISE EXCEPTION 'Migração abortada: % demanda(s) com neighborhood_id inexistente. Corrija esses registros e rode a migração novamente.', n; END IF;
  SELECT count(*) INTO n FROM "demands" d WHERE NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = d."author_id");
  IF n > 0 THEN RAISE EXCEPTION 'Migração abortada: % demanda(s) com author_id inexistente. Corrija esses registros e rode a migração novamente.', n; END IF;
  SELECT count(*) INTO n FROM "comments" c WHERE NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = c."author_id");
  IF n > 0 THEN RAISE EXCEPTION 'Migração abortada: % comentário(s) com author_id inexistente. Corrija esses registros e rode a migração novamente.', n; END IF;
  SELECT count(*) INTO n FROM "public_works" w WHERE NOT EXISTS (SELECT 1 FROM "neighborhoods" b WHERE b."id" = w."neighborhood_id");
  IF n > 0 THEN RAISE EXCEPTION 'Migração abortada: % obra(s) com neighborhood_id inexistente. Corrija esses registros e rode a migração novamente.', n; END IF;
END $$;
--> statement-breakpoint
DELETE FROM "confirmations" a USING "confirmations" b WHERE a."demand_id" = b."demand_id" AND a."user_id" = b."user_id" AND a."id" > b."id";
--> statement-breakpoint
DELETE FROM "confirmations" WHERE "demand_id" NOT IN (SELECT "id" FROM "demands") OR "user_id" NOT IN (SELECT "id" FROM "users");
--> statement-breakpoint
DELETE FROM "comments" WHERE "demand_id" NOT IN (SELECT "id" FROM "demands");
--> statement-breakpoint
DELETE FROM "timeline_events" WHERE "demand_id" NOT IN (SELECT "id" FROM "demands");
--> statement-breakpoint
DELETE FROM "service_orders" WHERE "demand_id" NOT IN (SELECT "id" FROM "demands");
--> statement-breakpoint
UPDATE "demands" SET "department_id" = NULL WHERE "department_id" IS NOT NULL AND "department_id" NOT IN (SELECT "id" FROM "departments");
--> statement-breakpoint
UPDATE "public_works" SET "department_id" = NULL WHERE "department_id" IS NOT NULL AND "department_id" NOT IN (SELECT "id" FROM "departments");
--> statement-breakpoint
UPDATE "service_orders" SET "team_id" = NULL WHERE "team_id" IS NOT NULL AND "team_id" NOT IN (SELECT "id" FROM "teams");
--> statement-breakpoint
UPDATE "activity_log" SET "demand_id" = NULL WHERE "demand_id" IS NOT NULL AND "demand_id" NOT IN (SELECT "id" FROM "demands");
--> statement-breakpoint
UPDATE "public_works" SET "progress_percent" = LEAST(GREATEST("progress_percent", 0), 100) WHERE "progress_percent" < 0 OR "progress_percent" > 100;
--> statement-breakpoint
UPDATE "categories" SET "demands_count" = 0 WHERE "demands_count" < 0;
--> statement-breakpoint
UPDATE "demands" SET "confirmations_count" = 0 WHERE "confirmations_count" < 0;
--> statement-breakpoint
UPDATE "demands" SET "comments_count" = 0 WHERE "comments_count" < 0;
--> statement-breakpoint
UPDATE "departments" SET "demands_count" = 0 WHERE "demands_count" < 0;
--> statement-breakpoint
UPDATE "departments" SET "resolved_count" = 0 WHERE "resolved_count" < 0;
--> statement-breakpoint
UPDATE "neighborhoods" SET "demands_count" = 0 WHERE "demands_count" < 0;
--> statement-breakpoint
UPDATE "neighborhoods" SET "resolved_count" = 0 WHERE "resolved_count" < 0;
--> statement-breakpoint
UPDATE "teams" SET "active_orders_count" = 0 WHERE "active_orders_count" < 0;
--> statement-breakpoint
UPDATE "teams" SET "completed_orders_count" = 0 WHERE "completed_orders_count" < 0;
--> statement-breakpoint
ALTER TABLE "confirmations" ADD CONSTRAINT "confirmations_demand_user_unique" UNIQUE("demand_id","user_id");
--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_demand_id_demands_id_fk" FOREIGN KEY ("demand_id") REFERENCES "public"."demands"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_demand_id_demands_id_fk" FOREIGN KEY ("demand_id") REFERENCES "public"."demands"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "confirmations" ADD CONSTRAINT "confirmations_demand_id_demands_id_fk" FOREIGN KEY ("demand_id") REFERENCES "public"."demands"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "confirmations" ADD CONSTRAINT "confirmations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "demands" ADD CONSTRAINT "demands_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "demands" ADD CONSTRAINT "demands_neighborhood_id_neighborhoods_id_fk" FOREIGN KEY ("neighborhood_id") REFERENCES "public"."neighborhoods"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "demands" ADD CONSTRAINT "demands_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "demands" ADD CONSTRAINT "demands_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "public_works" ADD CONSTRAINT "public_works_neighborhood_id_neighborhoods_id_fk" FOREIGN KEY ("neighborhood_id") REFERENCES "public"."neighborhoods"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "public_works" ADD CONSTRAINT "public_works_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_demand_id_demands_id_fk" FOREIGN KEY ("demand_id") REFERENCES "public"."demands"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_demand_id_demands_id_fk" FOREIGN KEY ("demand_id") REFERENCES "public"."demands"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_demands_count_nonneg" CHECK ("categories"."demands_count" >= 0);
--> statement-breakpoint
ALTER TABLE "demands" ADD CONSTRAINT "demands_confirmations_count_nonneg" CHECK ("demands"."confirmations_count" >= 0);
--> statement-breakpoint
ALTER TABLE "demands" ADD CONSTRAINT "demands_comments_count_nonneg" CHECK ("demands"."comments_count" >= 0);
--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_demands_count_nonneg" CHECK ("departments"."demands_count" >= 0);
--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_resolved_count_nonneg" CHECK ("departments"."resolved_count" >= 0);
--> statement-breakpoint
ALTER TABLE "neighborhoods" ADD CONSTRAINT "neighborhoods_demands_count_nonneg" CHECK ("neighborhoods"."demands_count" >= 0);
--> statement-breakpoint
ALTER TABLE "neighborhoods" ADD CONSTRAINT "neighborhoods_resolved_count_nonneg" CHECK ("neighborhoods"."resolved_count" >= 0);
--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_active_orders_count_nonneg" CHECK ("teams"."active_orders_count" >= 0);
--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_completed_orders_count_nonneg" CHECK ("teams"."completed_orders_count" >= 0);
--> statement-breakpoint
ALTER TABLE "public_works" ADD CONSTRAINT "public_works_progress_percent_range" CHECK ("public_works"."progress_percent" >= 0 AND "public_works"."progress_percent" <= 100);
--> statement-breakpoint
CREATE INDEX "activity_log_created_at_idx" ON "activity_log" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "activity_log_demand_id_idx" ON "activity_log" USING btree ("demand_id");
--> statement-breakpoint
CREATE INDEX "comments_demand_id_idx" ON "comments" USING btree ("demand_id");
--> statement-breakpoint
CREATE INDEX "comments_author_id_idx" ON "comments" USING btree ("author_id");
--> statement-breakpoint
CREATE INDEX "confirmations_user_id_idx" ON "confirmations" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "demands_status_idx" ON "demands" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "demands_category_id_idx" ON "demands" USING btree ("category_id");
--> statement-breakpoint
CREATE INDEX "demands_neighborhood_id_idx" ON "demands" USING btree ("neighborhood_id");
--> statement-breakpoint
CREATE INDEX "demands_department_id_idx" ON "demands" USING btree ("department_id");
--> statement-breakpoint
CREATE INDEX "demands_author_id_idx" ON "demands" USING btree ("author_id");
--> statement-breakpoint
CREATE INDEX "demands_created_at_idx" ON "demands" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "public_works_neighborhood_id_idx" ON "public_works" USING btree ("neighborhood_id");
--> statement-breakpoint
CREATE INDEX "public_works_department_id_idx" ON "public_works" USING btree ("department_id");
--> statement-breakpoint
CREATE INDEX "service_orders_demand_id_idx" ON "service_orders" USING btree ("demand_id");
--> statement-breakpoint
CREATE INDEX "service_orders_team_id_idx" ON "service_orders" USING btree ("team_id");
--> statement-breakpoint
CREATE INDEX "service_orders_status_idx" ON "service_orders" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "timeline_events_demand_id_idx" ON "timeline_events" USING btree ("demand_id");
