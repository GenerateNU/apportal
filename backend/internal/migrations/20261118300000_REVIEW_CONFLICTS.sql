-- Create "review_conflicts" table
CREATE TABLE "public"."review_conflicts" (
  "cycle_id" uuid NOT NULL,
  "lead_nuid" text NOT NULL,
  "applicant_nuid" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("cycle_id", "lead_nuid", "applicant_nuid"),
  CONSTRAINT "fk_review_conflicts_applicant" FOREIGN KEY ("applicant_nuid") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_review_conflicts_cycle" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_review_conflicts_lead" FOREIGN KEY ("lead_nuid") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE CASCADE
);
