-- Modify "cycle_steps" table
ALTER TABLE "public"."cycle_steps" ADD COLUMN "position" bigint NOT NULL DEFAULT 0;
UPDATE "public"."cycle_steps" SET "position" = CASE "step"
  WHEN 'applications' THEN 0 WHEN 'reviews' THEN 1 WHEN 'interviews' THEN 2
  WHEN 'decisions' THEN 3 WHEN 'feedback' THEN 4 END;
