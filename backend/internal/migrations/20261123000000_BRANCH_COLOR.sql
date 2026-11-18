ALTER TABLE "public"."branches" ADD COLUMN "color" text NULL;
UPDATE "public"."branches" b SET "color" = (ARRAY['yellow', 'green', 'coral', 'purple'])[(r.n % 4) + 1]
FROM (SELECT "id", row_number() OVER (ORDER BY "name") - 1 AS n FROM "public"."branches") r
WHERE b."id" = r."id" AND b."color" IS NULL;
