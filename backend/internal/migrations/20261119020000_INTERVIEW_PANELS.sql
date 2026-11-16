ALTER TABLE "public"."interview_groups" RENAME TO "interview_panels";
ALTER TABLE "public"."interview_panels" DROP COLUMN "meeting_slot";
ALTER TABLE "public"."interview_panels" RENAME CONSTRAINT "interview_groups_pkey" TO "interview_panels_pkey";
ALTER TABLE "public"."interview_panels" RENAME CONSTRAINT "fk_interview_groups_creator" TO "fk_interview_panels_creator";
ALTER TABLE "public"."interview_panels" RENAME CONSTRAINT "fk_interview_groups_cycle" TO "fk_interview_panels_cycle";
ALTER INDEX "public"."interview_groups_cycle_id_name_key" RENAME TO "interview_panels_cycle_id_name_key";
ALTER TRIGGER "trg_interview_groups_updated_at" ON "public"."interview_panels" RENAME TO "trg_interview_panels_updated_at";
ALTER TABLE "public"."interview_group_members" RENAME TO "interview_panel_members";
ALTER TABLE "public"."interview_panel_members" RENAME COLUMN "group_id" TO "panel_id";
ALTER TABLE "public"."interview_panel_members" RENAME COLUMN "member_nuid" TO "user_nuid";
ALTER TABLE "public"."interview_panel_members" RENAME CONSTRAINT "interview_group_members_pkey" TO "interview_panel_members_pkey";
ALTER TABLE "public"."interview_panel_members" RENAME CONSTRAINT "fk_interview_group_members_group" TO "fk_interview_panel_members_panel";
ALTER TABLE "public"."interview_panel_members" RENAME CONSTRAINT "fk_interview_group_members_member" TO "fk_interview_panel_members_user";
DROP INDEX "public"."idx_interview_group_members_member";
ALTER TABLE "public"."interview_panel_members" ADD COLUMN "cycle_id" uuid NULL;
UPDATE "public"."interview_panel_members" AS m SET "cycle_id" = p.cycle_id FROM "public"."interview_panels" p WHERE p.id = m.panel_id;
-- Nothing enforced one panel per person before, so keep each person's earliest
DELETE FROM "public"."interview_panel_members" AS m
USING "public"."interview_panel_members" AS keep
WHERE keep.cycle_id = m.cycle_id AND keep.user_nuid = m.user_nuid
  AND (keep.added_at, keep.panel_id) < (m.added_at, m.panel_id);
ALTER TABLE "public"."interview_panel_members" ALTER COLUMN "cycle_id" SET NOT NULL;
CREATE UNIQUE INDEX "interview_panel_members_cycle_id_user_nuid_key" ON "public"."interview_panel_members" ("cycle_id", "user_nuid");
