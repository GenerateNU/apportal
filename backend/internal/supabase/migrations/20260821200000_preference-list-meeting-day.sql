-- A preference list's members plan a real meeting to go through it together;
-- meeting_day records which weekly slot they've settled on so the list shows
-- it and the "add a member" picker can flag who's actually free then, using
-- the same day-of-week set the application's "Meeting Availability" question
-- already offers (see frontend/src/app/(portal)/reviewer/applications/
-- components/meetingAvailability.ts). NULL means no meeting day chosen yet.
ALTER TABLE preference_lists
  ADD COLUMN meeting_day TEXT
  CHECK (meeting_day IN ('monday', 'tuesday', 'wednesday', 'thursday'));
