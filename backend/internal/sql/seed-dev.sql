-- Fake data for local development, covering every table. Run with
-- `make seed-dev` after `make migrate-dev`; it skips itself if already seeded.
-- All seeded people have NUIDs starting 9000 and seed.* emails.

DO $$
DECLARE
  software uuid;
  design uuid;
  -- Roles belong to one cycle each.
  swe uuid;
  sd uuid;
  past_swe uuid;
  past_sd uuid;
  tech_lead uuid;
  ux uuid;
  -- The frontend's DEFAULT_CYCLE_ID, so pages land on the seeded cycle.
  cur uuid := '94dde9fe-a069-4178-90db-282b611e2904';
  past uuid := '5eed0000-0000-4000-8000-000000000002';
  leads_cycle uuid := '5eed0000-0000-4000-8000-000000000003';
  design_cycle uuid := '5eed0000-0000-4000-8000-000000000004';
  chief1 text := '900000001';
  chief2 text := '900000002';
  leads text[] := ARRAY['900000011', '900000012', '900000013', '900000014', '900000015', '900000016'];
  firsts text[] := ARRAY['Ava', 'Ben', 'Chloe', 'Dev', 'Ella', 'Finn', 'Grace', 'Hiro', 'Isla', 'Jai',
                         'Kira', 'Leo', 'Maya', 'Nico', 'Omar', 'Priya', 'Quinn', 'Rosa', 'Sam', 'Tara'];
  lasts text[] := ARRAY['Nguyen', 'Patel', 'Garcia', 'Kim', 'Okafor', 'Rossi', 'Cohen', 'Silva', 'Tanaka', 'Murphy',
                        'Haddad', 'Larsen', 'Mensah', 'Novak', 'Ortiz', 'Park', 'Reyes', 'Shah', 'Walsh', 'Zhou'];
  majors text[] := ARRAY['Computer Science', 'Data Science', 'Computer Engineering', 'Design', 'CS & Design', 'Mathematics'];
  -- Stages for applicants 1..40 in the current cycle.
  stages application_stage[] := ARRAY[
    'draft', 'draft',
    'submitted', 'submitted', 'submitted', 'submitted',
    'lead_review', 'lead_review', 'lead_review', 'lead_review', 'lead_review', 'lead_review',
    'chief_review', 'chief_review', 'chief_review', 'chief_review', 'chief_review',
    'interview', 'interview',
    'interview_scheduled', 'interview_scheduled', 'interview_scheduled',
    'interview_conducted', 'interview_conducted', 'interview_conducted',
    'interview_review', 'interview_review', 'interview_review',
    'selection', 'selection', 'selection', 'selection', 'selection', 'selection',
    'accepted', 'accepted',
    'rejected', 'rejected', 'rejected',
    'withdrawn']::application_stage[];
  -- How far each applicant got, which decides what rows they have
  -- (0 draft, 2 lead review, 3 chief review, 4..7 interview, 8 selection, 9 accepted).
  depths int[] := ARRAY[0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 5, 5, 5, 6, 6, 6,
                        7, 7, 7, 8, 8, 8, 8, 8, 8, 9, 9, 7, 3, 3, 2];
  pl uuid[];
  d uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM cycles WHERE id = cur) THEN
    RAISE NOTICE 'seed-dev: already seeded, skipping';
    RETURN;
  END IF;

  -- Branches & cycles
  INSERT INTO branches (name) VALUES ('Software') ON CONFLICT (name) DO NOTHING;
  INSERT INTO branches (name) VALUES ('Design') ON CONFLICT (name) DO NOTHING;
  SELECT id INTO software FROM branches WHERE name = 'Software';
  SELECT id INTO design FROM branches WHERE name = 'Design';

  INSERT INTO cycles (id, branch_id, name, status, application_type, opens_at, closes_at, created_at) VALUES
    (past, software, 'Fall 2025', 'closed', 'member', now() - interval '400 days', now() - interval '370 days', now() - interval '420 days'),
    (cur, software, 'Spring 2027', 'open', 'member', now() - interval '30 days', now() + interval '14 days', now() - interval '45 days'),
    (leads_cycle, software, 'Spring 2027 Leads', 'draft', 'lead', NULL, NULL, now() - interval '5 days'),
    (design_cycle, design, 'Spring 2027', 'draft', 'member', NULL, NULL, now() - interval '3 days');

  -- Offset created_at so each cycle's roles keep this order.
  INSERT INTO roles (cycle_id, name, created_at) VALUES
    (cur, 'Software Engineer', now()), (cur, 'Software Designer', now() + interval '1 microsecond'),
    (past, 'Software Engineer', now()), (past, 'Software Designer', now() + interval '1 microsecond'),
    (leads_cycle, 'Tech Lead', now()),
    (design_cycle, 'UX Designer', now()), (design_cycle, 'Visual Designer', now() + interval '1 microsecond');
  SELECT id INTO swe FROM roles WHERE cycle_id = cur AND name = 'Software Engineer';
  SELECT id INTO sd FROM roles WHERE cycle_id = cur AND name = 'Software Designer';
  SELECT id INTO past_swe FROM roles WHERE cycle_id = past AND name = 'Software Engineer';
  SELECT id INTO past_sd FROM roles WHERE cycle_id = past AND name = 'Software Designer';
  SELECT id INTO tech_lead FROM roles WHERE cycle_id = leads_cycle;
  SELECT id INTO ux FROM roles WHERE cycle_id = design_cycle AND name = 'UX Designer';

  -- Users
  INSERT INTO users (nuid, email, full_name, roles, graduation_year, major, github_username) VALUES
    (chief1, 'seed.chief1@northeastern.edu', 'Morgan Chief', '{chief,member}', 2027, 'Computer Science', 'seed-morgan'),
    (chief2, 'seed.chief2@northeastern.edu', 'Riley Chief', '{chief,member}', 2027, 'Design', 'seed-riley');
  INSERT INTO users (nuid, email, full_name, roles, graduation_year, major, github_username, returner)
  SELECT leads[i], 'seed.lead' || i || '@northeastern.edu', firsts[i + 10] || ' ' || lasts[i + 4] || ' (Lead)',
         '{lead,member}', 2027 + i % 2, majors[1 + i % 6], 'seed-lead-' || i, true
  FROM generate_series(1, 6) i;
  INSERT INTO users (nuid, email, full_name, roles, graduation_year, major, returner)
  SELECT '90000002' || i, 'seed.member' || i || '@northeastern.edu', firsts[i + 2] || ' ' || lasts[i + 12],
         '{member}', 2028, majors[i], true
  FROM generate_series(1, 2) i;
  INSERT INTO users (nuid, email, full_name, roles, graduation_year, major, github_username, returner)
  SELECT '9000010' || lpad(i::text, 2, '0'), 'seed.applicant' || i || '@northeastern.edu',
         firsts[1 + (i - 1) % 20] || ' ' || lasts[1 + (i * 7) % 20],
         '{applicant}', 2027 + i % 3, majors[1 + i % 6], 'seed-applicant-' || i, i % 9 = 0
  FROM generate_series(1, 40) i;

  -- Current cycle setup
  INSERT INTO application_templates (cycle_id, role_id, title, description, instructions, opens_at, closes_at, status, review_status, review_closes_at) VALUES
    (cur, swe, 'Software Engineer — Spring 2027', 'Build full-stack products for Boston nonprofits and startups.',
     'Answer every question and finish the code challenge before the deadline.', now() - interval '30 days', now() + interval '14 days', 'open', 'open', now() + interval '21 days'),
    (cur, sd, 'Software Designer — Spring 2027', 'Design end-to-end product experiences with our engineering teams.',
     'Share a portfolio and answer every question.', now() - interval '30 days', now() + interval '14 days', 'open', 'open', now() + interval '21 days');

  INSERT INTO cycle_stages (cycle_id, stage, display_order, required_assignments, label) VALUES
    (cur, 'submitted', 1, 0, 'Submitted'),
    (cur, 'lead_review', 2, 3, 'Lead Review'),
    (cur, 'chief_review', 3, 0, 'Chief Review'),
    (cur, 'interview', 4, 0, 'Interview'),
    (cur, 'selection', 5, 0, 'Selection');

  INSERT INTO questions (cycle_id, role_id, question_text, question_type, is_required, display_order, options, page_title) VALUES
    (cur, NULL, 'Why do you want to join Generate?', 'long_answer', true, 1, NULL, 'About you'),
    (cur, NULL, 'Meeting Availability for the Spring Semester', 'checkbox', true, 2,
     '["Monday 6:00-7:30 PM", "Tuesday 6:00-7:30 PM", "Wednesday 6:00-7:30 PM", "Thursday 6:00-7:30 PM"]', 'About you'),
    (cur, NULL, 'How did you hear about us?', 'dropdown', false, 3, '["Friend", "Club fair", "Instagram", "Other"]', 'About you'),
    (cur, swe, 'Tell us about a technical project you are proud of.', 'long_answer', true, 4, NULL, 'Experience'),
    (cur, swe, 'Link to your GitHub or a project repo', 'url', true, 5, NULL, 'Experience'),
    (cur, swe, 'Which part of the stack do you prefer?', 'multiple_choice', true, 6, '["Frontend", "Backend", "Both"]', 'Experience'),
    (cur, sd, 'Link to your portfolio', 'url', true, 4, NULL, 'Experience'),
    (cur, sd, 'Walk us through a design decision you had to defend.', 'long_answer', true, 5, NULL, 'Experience'),
    (cur, sd, 'Which tools do you use?', 'checkbox', false, 6, '["Figma", "Framer", "Illustrator", "Protopie"]', 'Experience');

  INSERT INTO review_questions (cycle_id, role_id, question_text, question_type, is_required, display_order, description) VALUES
    (cur, NULL, 'Motivation', 'score', true, 1, 'How clearly do they explain why Generate?'),
    (cur, NULL, 'Communication', 'score', true, 2, 'Clarity and structure of their writing.'),
    (cur, swe, 'Technical depth', 'score', true, 3, 'Depth of the project they describe.'),
    (cur, sd, 'Design craft', 'score', true, 3, 'Quality of process and portfolio.'),
    (cur, NULL, 'Overall', 'score', true, 4, 'Your overall score.'),
    (cur, NULL, 'Notes', 'long_answer', false, 5, 'Anything the chiefs should know.');

  INSERT INTO code_challenges (cycle_id, role_id, name, challenge_url, instructions, due_at) VALUES
    (cur, swe, 'Gate Scheduler', 'https://github.com/example/seed-gate-scheduler', 'Fork the repo and make the tests pass.', now() + interval '14 days'),
    (cur, sd, 'Onboarding Redesign', 'https://www.figma.com/community/file/seed', 'Redesign the onboarding flow in Figma.', now() + interval '14 days');

  INSERT INTO interview_script (cycle_id, role_id, intro_speech, recording_reminder, questions, closing_note, challenge_intro, challenge_tracks, post_interview_checklist, updated_by)
  SELECT cur, r, 'Hi! Thanks for making time today. This is a conversational interview, about 30 minutes.',
         'Remember to ask for consent and start the recording.',
         '[{"prompt": "Tell me about yourself.", "followUps": ["What are you hoping to learn this semester?"]},
           {"prompt": "Walk me through a project you are proud of.", "followUps": ["What would you change?", "How did you split the work?"]},
           {"prompt": "Tell me about a time you disagreed with a teammate."}]'::jsonb,
         'That is all from me. Do you have any questions for us?',
         'Let us talk through your challenge submission.',
         '{"backend": {"label": "Backend", "followUps": ["How did you handle contention?", "What would you test next?"]},
           "frontend": {"label": "Frontend", "followUps": ["How did you structure state?", "What about accessibility?"]}}'::jsonb,
         '["Stop the recording", "Upload the recording link", "Submit your writeup within 24 hours"]'::jsonb,
         chief1
  FROM unnest(ARRAY[swe, sd]) r;

  INSERT INTO decision_templates (cycle_id, role_id, kind, subject, body, updated_by)
  SELECT cur, r, k, 'Generate Software Branch — {{cycle}} {{role}} Application Update',
         CASE k WHEN 'rejection_post_interview'
           THEN E'Dear {{applicant_name}},\n\nThank you for interviewing for the {{role}} position for {{cycle}}. We have decided to move forward with other candidates.\n\n{{feedback}} That being said, we loved talking to you about {{compliments}}\n\nThanking You,\n\nThe Generate Chiefs'
           ELSE E'Dear {{applicant_name}},\n\nThank you for applying for the {{role}} position for {{cycle}}. After careful review, we have decided to move forward with other candidates.\n\nThanking You,\n\nThe Generate Chiefs'
         END, chief1
  FROM unnest(ARRAY[swe, sd]) r,
       unnest(ARRAY['rejection_post_interview', 'rejection_generic']::decision_kind[]) k;

  INSERT INTO preference_list_deadlines (cycle_id, role_id, closes_at, updated_by) VALUES
    (cur, swe, now() + interval '10 days', chief1),
    (cur, sd, now() + interval '10 days', chief1);

  INSERT INTO review_releases (cycle_id, role_id, review_kind, released_by) VALUES
    (cur, swe, 'written', chief1);

  -- Current cycle applications: one row per applicant, with the leads who
  -- review, interview, and watch the recording picked round-robin.
  CREATE TEMP TABLE s_app ON COMMIT DROP AS
  SELECT i,
         gen_random_uuid() AS id,
         '9000010' || lpad(i::text, 2, '0') AS nuid,
         (CASE WHEN i % 5 IN (0, 3) THEN sd ELSE swe END) AS role,
         stages[i] AS stage,
         depths[i] AS depth,
         leads[1 + i % 6] AS lead_a,
         leads[1 + (i + 1) % 6] AS lead_b,
         leads[1 + (i + 2) % 6] AS lead_c
  FROM generate_series(1, 40) i;

  INSERT INTO applications (id, cycle_id, user_nuid, role_id, stage, availability, submitted_at)
  SELECT id, cur, nuid, role, stage,
         jsonb_build_object('monday', i % 2 = 0, 'tuesday', i % 3 = 0, 'wednesday', true, 'thursday', i % 4 <> 0),
         CASE WHEN depth > 0 THEN now() - make_interval(days => 45 - i) END
  FROM s_app;

  -- Drafts only have their first answer filled in.
  INSERT INTO written_answers (application_id, question_id, answer_text, answer_options)
  SELECT a.id, q.id,
         CASE q.question_type
           WHEN 'long_answer' THEN 'Seeded answer from applicant ' || a.i || ': I care about building things that help people, and I want to learn from a team that ships.'
           WHEN 'url' THEN 'https://example.com/seed-applicant-' || a.i
         END,
         CASE q.question_type
           WHEN 'checkbox' THEN (SELECT jsonb_agg(o) FROM jsonb_array_elements(q.options) WITH ORDINALITY e(o, n) WHERE (n + a.i) % 2 = 0 OR n = 1)
           WHEN 'multiple_choice' THEN jsonb_build_array(q.options -> (a.i % 3))
           WHEN 'dropdown' THEN jsonb_build_array(q.options -> (a.i % 4))
         END
  FROM s_app a
  JOIN questions q ON q.cycle_id = cur AND (q.role_id IS NULL OR q.role_id = a.role)
  WHERE a.depth > 0 OR q.display_order = 1;

  INSERT INTO code_submissions (application_id, challenge_id, submission_url, raw_score, score_details, score_updated_at)
  SELECT a.id, c.id, 'https://github.com/seed-applicant-' || a.i || '/challenge',
         CASE WHEN a.depth >= 3 THEN 55 + (a.i * 7) % 45 END,
         CASE WHEN a.depth >= 3 THEN jsonb_build_object('tests_passed', 10 + a.i % 11, 'tests_total', 20) END,
         CASE WHEN a.depth >= 3 THEN now() - interval '7 days' END
  FROM s_app a JOIN code_challenges c ON c.cycle_id = cur AND c.role_id = a.role
  WHERE a.depth > 0;

  INSERT INTO lead_assignments (application_id, lead_nuid, assigned_by)
  SELECT a.id, l, chief1
  FROM s_app a, unnest(ARRAY[a.lead_a, a.lead_b, a.lead_c]) l
  WHERE a.depth >= 2;

  -- Past lead review every review is submitted; in lead review the first lead
  -- has submitted, the second has a draft, and the third hasn't started.
  INSERT INTO written_reviews (application_id, reviewer_nuid, submitted_at)
  SELECT a.id, r.nuid, CASE WHEN a.depth >= 3 OR r.n = 1 THEN now() - interval '10 days' END
  FROM s_app a, unnest(ARRAY[a.lead_a, a.lead_b, a.lead_c]) WITH ORDINALITY r(nuid, n)
  WHERE a.depth >= 3 OR (a.depth = 2 AND r.n <= 2);

  INSERT INTO written_review_answers (review_id, review_question_id, answer_text, score)
  SELECT w.id, rq.id,
         CASE WHEN rq.question_type = 'long_answer' THEN 'Seeded review note: solid writing, clear motivation.' END,
         CASE WHEN rq.question_type = 'score' THEN 3 + (a.i + length(w.reviewer_nuid) + rq.display_order * 3 + right(w.reviewer_nuid, 1)::int) % 8 END
  FROM written_reviews w
  JOIN s_app a ON a.id = w.application_id
  JOIN review_questions rq ON rq.cycle_id = cur AND (rq.role_id IS NULL OR rq.role_id = a.role);

  -- Chief review: both chiefs voted past it; only the first has voted on those in it.
  INSERT INTO chief_reviews (application_id, reviewer_nuid, vote, decided_at)
  SELECT a.id, c.nuid,
         CASE WHEN a.depth >= 4 THEN (ARRAY['strong_interview', 'interview'])[1 + (a.i + c.n) % 2]
              ELSE (ARRAY['strong_interview', 'interview', 'neutral', 'no_interview', 'strong_no_interview'])[1 + (a.i + c.n) % 5] END,
         now() - interval '6 days'
  FROM s_app a, unnest(ARRAY[chief1, chief2]) WITH ORDINALITY c(nuid, n)
  WHERE a.depth >= 4 OR (a.depth = 3 AND c.n = 1) OR (a.stage = 'rejected' AND a.depth = 3);

  INSERT INTO chief_review_comments (application_id, author_nuid, body)
  SELECT id, chief2, 'Strong writing — worth a closer look at their project.'
  FROM s_app WHERE depth >= 3 AND i % 2 = 0;

  -- Interviews
  INSERT INTO interviews (application_id, scheduled_at, conducted_at, recording_url, notes_url, rating, writeup, submitted_at)
  SELECT id,
         CASE WHEN depth = 5 THEN now() + make_interval(days => 1 + i % 5)
              WHEN depth >= 6 THEN now() - make_interval(days => 2 + i % 4) END,
         CASE WHEN depth >= 6 THEN now() - make_interval(days => 2 + i % 4) END,
         CASE WHEN depth >= 6 THEN 'https://www.loom.com/share/seed-' || i END,
         CASE WHEN depth >= 6 THEN 'https://notes.example.com/seed-' || i END,
         CASE WHEN depth >= 6 THEN (ARRAY['good', 'great', 'must_hire', 'neutral', 'do_not_hire'])[1 + i % 5]::interview_rating END,
         CASE WHEN depth >= 6 THEN 'Seeded writeup: thoughtful answers, walked through their challenge clearly.' END,
         CASE WHEN depth >= 6 THEN now() - interval '1 day' END
  FROM s_app WHERE depth BETWEEN 4 AND 9;

  INSERT INTO interviewers (interview_id, interviewer_nuid, assigned_by)
  SELECT iv.id, a.lead_a, chief1
  FROM s_app a JOIN interviews iv ON iv.application_id = a.id;

  INSERT INTO interview_reviewers (interview_id, reviewer_nuid, assigned_by, writeup, writeup_submitted_at)
  SELECT iv.id, r, chief1,
         CASE WHEN a.depth >= 7 THEN 'Seeded recording review: agree with the interviewer.' END,
         CASE WHEN a.depth >= 7 THEN now() - interval '12 hours' END
  FROM s_app a JOIN interviews iv ON iv.application_id = a.id, unnest(ARRAY[a.lead_b, a.lead_c]) r;

  INSERT INTO interview_comments (application_id, author_nuid, body)
  SELECT id, lead_b, 'Watched the recording — great energy on the challenge walkthrough.'
  FROM s_app WHERE depth >= 6;

  -- Selection
  INSERT INTO lead_selections (cycle_id, lead_nuid, application_id, note)
  SELECT cur, l, a.id, 'Would love them on my team.'
  FROM s_app a, unnest(ARRAY[a.lead_a, a.lead_b]) l
  WHERE a.depth >= 8;

  WITH ins AS (
    INSERT INTO preference_lists (cycle_id, name, status, created_by, submitted_at, meeting_day)
    VALUES (cur, 'Team Atlas', 'submitted', leads[1], now() - interval '2 days', 'monday'),
           (cur, 'Team Beacon', 'submitted', leads[3], now() - interval '1 day', 'wednesday'),
           (cur, 'Team Comet', 'draft', leads[5], NULL, 'thursday')
    RETURNING id, name
  )
  SELECT array_agg(id ORDER BY name) INTO pl FROM ins;

  INSERT INTO preference_list_members (preference_list_id, lead_nuid, added_by)
  SELECT pl[t], leads[(t - 1) * 2 + m], leads[(t - 1) * 2 + 1]
  FROM generate_series(1, 3) t, generate_series(1, 2) m;

  -- Each list ranks every selection-stage applicant, per role, in its own order.
  INSERT INTO preference_list_entries (preference_list_id, application_id, rank, reasoning, updated_by)
  SELECT pl[t], a.id,
         row_number() OVER (PARTITION BY t, a.role ORDER BY (a.i * (t + 2)) % 11, a.i),
         'Seeded reasoning: strong fit for this team.', leads[(t - 1) * 2 + 1]
  FROM s_app a, generate_series(1, 3) t
  WHERE a.depth >= 8;

  INSERT INTO preference_list_personal_entries (preference_list_id, owner_nuid, application_id, rank, reasoning)
  SELECT pl[t], leads[(t - 1) * 2 + 2], a.id,
         row_number() OVER (PARTITION BY t, a.role ORDER BY a.i DESC), 'My own pick.'
  FROM s_app a, generate_series(1, 3) t
  WHERE a.depth >= 8;

  INSERT INTO preference_list_comments (preference_list_id, application_id, author_nuid, body)
  SELECT pl[t], NULL, leads[(t - 1) * 2 + 1], 'Let us finalize this before Thursday.'
  FROM generate_series(1, 3) t
  UNION ALL
  SELECT pl[1], a.id, leads[2], 'Top pick for frontend work.'
  FROM s_app a WHERE a.depth = 8 AND a.i % 2 = 1;

  -- Drafts: every list is a team, and accepted applicants are already picked.
  FOR d IN
    INSERT INTO drafts (cycle_id, role_id, status, rounds, created_by)
    SELECT cur, r, 'active', 2, chief1
    FROM unnest(ARRAY[swe, sd]) r
    RETURNING id
  LOOP
    INSERT INTO draft_teams (draft_id, preference_list_id, position)
    SELECT d, pl[t], t FROM generate_series(1, 3) t;

    INSERT INTO draft_picks (draft_id, pick_number, draft_team_id, application_id, previous_stage, picked_by)
    SELECT d, p.rn, dt.id, p.id, 'selection', chief1
    FROM (
      SELECT a.id, row_number() OVER (ORDER BY a.i) AS rn
      FROM s_app a JOIN drafts dr ON dr.id = d AND dr.role_id = a.role
      WHERE a.stage = 'accepted'
    ) p
    JOIN draft_teams dt ON dt.draft_id = d AND dt.position = (p.rn - 1) % 3 + 1;
  END LOOP;

  -- Decisions: sent letters for the rejected, plus one unsent draft in chief review.
  INSERT INTO decision_drafts (application_id, kind, feedback, compliments, author_nuid, sent_at, sent_by, previous_stage)
  SELECT id,
         CASE WHEN depth >= 4 THEN 'rejection_post_interview' ELSE 'rejection_generic' END::decision_kind,
         CASE WHEN depth >= 4 THEN 'we were looking for a bit more depth on the technical walkthrough.' END,
         CASE WHEN depth >= 4 THEN 'your side project and how you approached it.' END,
         chief1, now() - interval '2 days', chief1,
         CASE WHEN depth >= 4 THEN 'interview_review' ELSE 'chief_review' END::application_stage
  FROM s_app WHERE stage = 'rejected';

  INSERT INTO decision_drafts (application_id, kind, author_nuid)
  SELECT id, 'rejection_generic', chief2 FROM s_app WHERE i = 17;

  -- Past cycle: a finished cycle with a handful of outcomes.
  INSERT INTO application_templates (cycle_id, role_id, title, status, review_status, closes_at)
  VALUES (past, past_swe, 'Software Engineer — Fall 2025', 'closed', 'closed', now() - interval '370 days'),
         (past, past_sd, 'Software Designer — Fall 2025', 'closed', 'closed', now() - interval '370 days');
  INSERT INTO questions (cycle_id, question_text, question_type, display_order)
  VALUES (past, 'Why do you want to join Generate?', 'long_answer', 1);
  INSERT INTO applications (cycle_id, user_nuid, role_id, stage, submitted_at)
  SELECT past, '9000010' || lpad(i::text, 2, '0'),
         (CASE WHEN i % 2 = 0 THEN past_sd ELSE past_swe END),
         (CASE WHEN i <= 3 THEN 'accepted' ELSE 'rejected' END)::application_stage,
         now() - interval '380 days'
  FROM generate_series(1, 6) i;
  INSERT INTO written_answers (application_id, question_id, answer_text)
  SELECT a.id, q.id, 'Seeded answer from last year.'
  FROM applications a JOIN questions q ON q.cycle_id = past
  WHERE a.cycle_id = past;

  -- Lead cycle and the Design branch's first cycle, both still drafts.
  INSERT INTO application_templates (cycle_id, role_id, title, status)
  VALUES (leads_cycle, tech_lead, 'Tech Lead — Spring 2027', 'draft'),
         (design_cycle, ux, 'Designer — Spring 2027', 'draft');
  INSERT INTO questions (cycle_id, question_text, question_type, display_order)
  VALUES (leads_cycle, 'How would you run your team''s first week?', 'long_answer', 1),
         (design_cycle, 'Link to your portfolio', 'url', 1);
  INSERT INTO applications (cycle_id, user_nuid, role_id, stage, submitted_at)
  VALUES (leads_cycle, '900000021', tech_lead, 'submitted', now() - interval '1 day');

  RAISE NOTICE 'seed-dev: seeded';
END
$$;
