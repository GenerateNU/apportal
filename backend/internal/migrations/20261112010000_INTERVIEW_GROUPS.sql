CREATE TABLE "public"."interview_groups" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "cycle_id" uuid NOT NULL,
  "name" text NOT NULL,
  "meeting_slot" timestamptz NULL,
  "created_by" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_interview_groups_creator" FOREIGN KEY ("created_by") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT "fk_interview_groups_cycle" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);

CREATE UNIQUE INDEX "interview_groups_cycle_id_name_key" ON "public"."interview_groups" ("cycle_id", "name");

CREATE TRIGGER "trg_interview_groups_updated_at" BEFORE UPDATE ON "public"."interview_groups" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE TABLE "public"."interview_group_members" (
  "group_id" uuid NOT NULL,
  "member_nuid" text NOT NULL,
  "added_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("group_id", "member_nuid"),
  CONSTRAINT "fk_interview_group_members_group" FOREIGN KEY ("group_id") REFERENCES "public"."interview_groups" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_interview_group_members_member" FOREIGN KEY ("member_nuid") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE INDEX "idx_interview_group_members_member" ON "public"."interview_group_members" ("member_nuid");
