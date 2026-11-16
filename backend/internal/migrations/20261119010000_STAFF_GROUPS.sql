CREATE TABLE "public"."staff_groups" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "cycle_id" uuid NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_staff_groups_cycle" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
CREATE UNIQUE INDEX "staff_groups_cycle_id_name_key" ON "public"."staff_groups" ("cycle_id", "name");
CREATE TABLE "public"."staff_group_members" (
  "group_id" uuid NOT NULL,
  "user_nuid" text NOT NULL,
  "added_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("group_id", "user_nuid"),
  CONSTRAINT "fk_staff_group_members_group" FOREIGN KEY ("group_id") REFERENCES "public"."staff_groups" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_staff_group_members_user" FOREIGN KEY ("user_nuid") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE CASCADE
);
CREATE INDEX "idx_staff_group_members_user" ON "public"."staff_group_members" ("user_nuid");
CREATE TABLE "public"."opening_teams" (
  "cycle_id" uuid NOT NULL,
  "role_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "group_id" uuid NOT NULL,
  PRIMARY KEY ("cycle_id", "role_id", "kind", "group_id"),
  CONSTRAINT "fk_opening_teams_cycle" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_opening_teams_group" FOREIGN KEY ("group_id") REFERENCES "public"."staff_groups" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_opening_teams_role" FOREIGN KEY ("role_id") REFERENCES "public"."roles" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "opening_teams_kind_check" CHECK (kind = ANY (ARRAY['reviewer'::text, 'interviewer'::text, 'recording_reviewer'::text]))
);
CREATE INDEX "idx_opening_teams_group" ON "public"."opening_teams" ("group_id");
