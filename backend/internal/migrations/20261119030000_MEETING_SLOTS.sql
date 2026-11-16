ALTER TABLE "public"."cycles" ADD COLUMN "match_by_slot" boolean NOT NULL DEFAULT false;
CREATE TABLE "public"."meeting_slots" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "cycle_id" uuid NOT NULL,
  "label" text NOT NULL,
  "position" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_meeting_slots_cycle" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
CREATE UNIQUE INDEX "meeting_slots_cycle_id_label_key" ON "public"."meeting_slots" ("cycle_id", "label");
CREATE TABLE "public"."staff_slots" (
  "cycle_id" uuid NOT NULL,
  "user_nuid" text NOT NULL,
  "slot_id" uuid NOT NULL,
  PRIMARY KEY ("cycle_id", "user_nuid"),
  CONSTRAINT "fk_staff_slots_cycle" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_staff_slots_slot" FOREIGN KEY ("slot_id") REFERENCES "public"."meeting_slots" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_staff_slots_user" FOREIGN KEY ("user_nuid") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE CASCADE
);
CREATE INDEX "idx_staff_slots_slot" ON "public"."staff_slots" ("slot_id");
CREATE TABLE "public"."application_slots" (
  "application_id" uuid NOT NULL,
  "slot_id" uuid NOT NULL,
  PRIMARY KEY ("application_id", "slot_id"),
  CONSTRAINT "fk_application_slots_application" FOREIGN KEY ("application_id") REFERENCES "public"."applications" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_application_slots_slot" FOREIGN KEY ("slot_id") REFERENCES "public"."meeting_slots" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
CREATE INDEX "idx_application_slots_slot" ON "public"."application_slots" ("slot_id");
