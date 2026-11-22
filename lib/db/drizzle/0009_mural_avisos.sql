CREATE TABLE IF NOT EXISTS "announcements" (
  "id" serial PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "scope" text DEFAULT 'municipal' NOT NULL,
  "department_id" integer REFERENCES "departments"("id") ON DELETE SET NULL,
  "neighborhood_id" integer REFERENCES "neighborhoods"("id") ON DELETE SET NULL,
  "category_id" integer REFERENCES "categories"("id") ON DELETE SET NULL,
  "image_url" text,
  "lat" real,
  "lng" real,
  "is_published" boolean DEFAULT true NOT NULL,
  "published_at" timestamp DEFAULT now() NOT NULL,
  "expires_at" timestamp,
  "created_by" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_announcements_active"
  ON "announcements" ("is_published", "expires_at");