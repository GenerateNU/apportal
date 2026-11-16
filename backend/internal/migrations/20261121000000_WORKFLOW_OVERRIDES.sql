-- Create "workflow_overrides" table
CREATE TABLE "public"."workflow_overrides" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "cycle_id" uuid NOT NULL,
  "role_id" uuid NULL,
  "step" text NOT NULL,
  "op" text NOT NULL,
  "level" text NOT NULL,
  "actor_nuid" text NOT NULL,
  "reason" text NOT NULL,
  "plan" jsonb NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_workflow_overrides_actor" FOREIGN KEY ("actor_nuid") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT "fk_workflow_overrides_cycle" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- Create index "idx_workflow_overrides_cycle" to table: "workflow_overrides"
CREATE INDEX "idx_workflow_overrides_cycle" ON "public"."workflow_overrides" ("cycle_id");
