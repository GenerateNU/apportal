CREATE FUNCTION pg_temp.qa_cycle(cyc uuid, branch uuid, cycle_name text, st int, chiefs text[], leads text[], fakes text[])
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  n timestamptz := now();
  cur int := (ARRAY[1, 1, 2, 2, 2, 3, 3, 4, 4, 5])[st + 1];
  pool text[] := chiefs || leads;
  ra uuid;
  rb uuid;
  roles uuid[];
  team_a uuid;
  team_b uuid;
  d uuid;
  r uuid;
BEGIN
  INSERT INTO cycles (id, branch_id, name, status, application_type, opens_at, closes_at, created_at)
  VALUES (cyc, branch, cycle_name, 'open', 'member',
          CASE WHEN st >= 1 THEN n - CASE WHEN st = 1 THEN interval '7 days' ELSE interval '60 days' END END,
          CASE WHEN st = 1 THEN n + interval '14 days' WHEN st > 1 THEN n - interval '40 days' END,
          n - interval '70 days');

  INSERT INTO cycle_steps (cycle_id, step, enabled, position, completed_at)
  SELECT cyc, s, true, p - 1, CASE WHEN p < cur THEN n - make_interval(days => (ARRAY[40, 30, 20, 10])[p]) END
  FROM unnest(ARRAY['applications', 'reviews', 'interviews', 'decisions', 'feedback']) WITH ORDINALITY AS t(s, p);

  INSERT INTO step_assignments (cycle_id, step, kind, per_applicant) VALUES
    (cyc, 'reviews', 'reviewer', 3), (cyc, 'interviews', 'interviewer', 2), (cyc, 'interviews', 'recording_reviewer', 1);

  INSERT INTO roles (cycle_id, name, created_at) VALUES (cyc, 'Software Designer', n) RETURNING id INTO ra;
  INSERT INTO roles (cycle_id, name, created_at) VALUES (cyc, 'Software Engineer', n + interval '1 microsecond') RETURNING id INTO rb;
  roles := ARRAY[ra, rb];

  INSERT INTO cycle_staff (cycle_id, user_nuid, role)
  SELECT cyc, s, 'chief'::cycle_staff_role FROM unnest(chiefs) s
  UNION ALL
  SELECT cyc, s, 'lead' FROM unnest(leads) s;

  INSERT INTO application_templates (cycle_id, role_id, title, description, instructions)
  SELECT cyc, x, nm || ', ' || cycle_name, 'Join a Generate software team for the semester.',
         'Answer every question before the deadline.'
  FROM unnest(roles, ARRAY['Software Designer', 'Software Engineer']) AS t(x, nm);

  INSERT INTO questions (cycle_id, role_id, question_text, question_type, is_required, display_order, options, page_title) VALUES
    (cyc, NULL, 'Why do you want to join Generate?', 'long_answer', true, 1, NULL, 'About you'),
    (cyc, NULL, 'Meeting availability for the semester', 'checkbox', true, 2,
     '["Monday 6:00-7:30 PM", "Tuesday 6:00-7:30 PM", "Wednesday 6:00-7:30 PM", "Thursday 6:00-7:30 PM"]', 'About you'),
    (cyc, NULL, 'How did you hear about us?', 'dropdown', false, 3, '["Friend", "Club fair", "Instagram", "Other"]', 'About you'),
    (cyc, ra, 'Link to your portfolio', 'url', true, 4, NULL, 'Experience'),
    (cyc, ra, 'Walk us through a design decision you had to defend.', 'long_answer', true, 5, NULL, 'Experience'),
    (cyc, ra, 'Which tools do you use?', 'checkbox', false, 6, '["Figma", "Framer", "Illustrator", "Protopie"]', 'Experience'),
    (cyc, rb, 'Tell us about a technical project you are proud of.', 'long_answer', true, 4, NULL, 'Experience'),
    (cyc, rb, 'Link to your GitHub or a project repo', 'url', true, 5, NULL, 'Experience'),
    (cyc, rb, 'Which part of the stack do you prefer?', 'multiple_choice', true, 6, '["Frontend", "Backend", "Both"]', 'Experience');

  INSERT INTO review_questions (cycle_id, role_id, question_text, question_type, is_required, display_order, description, score_min, score_max) VALUES
    (cyc, NULL, 'Motivation', 'score', true, 1, 'How clearly do they explain why Generate?', 1, 10),
    (cyc, NULL, 'Communication', 'score', true, 2, 'Clarity and structure of their writing.', 1, 10),
    (cyc, ra, 'Design craft', 'score', true, 3, 'Quality of their process and portfolio.', 1, 10),
    (cyc, rb, 'Technical depth', 'score', true, 3, 'Depth of the project they describe.', 1, 10),
    (cyc, NULL, 'Overall', 'score', true, 4, 'Your overall score.', 1, 10),
    (cyc, NULL, 'Notes', 'long_answer', false, 5, 'Anything the chiefs should know.', NULL, NULL);

  INSERT INTO interview_script (cycle_id, role_id, intro_speech, recording_reminder, questions, closing_note, challenge_intro, challenge_tracks, post_interview_checklist, updated_by)
  SELECT cyc, x,
         'Hi! Thanks for making time today. This is a conversational interview, about 30 minutes.',
         'Remember to ask for consent and start the recording.',
         '[{"prompt": "Tell me about yourself.", "followUps": ["What are you hoping to learn this semester?"]},
           {"prompt": "Walk me through a project you are proud of.", "followUps": ["What would you change?", "How did you split the work?"]},
           {"prompt": "Tell me about a time you disagreed with a teammate."}]'::jsonb,
         'That is all from me. Do you have any questions for us?',
         'Let us talk through your project.',
         '{}'::jsonb,
         '["Stop the recording", "Upload the recording link", "Submit your writeup within 24 hours"]'::jsonb,
         chiefs[1]
  FROM unnest(roles) x;

  IF st = 0 THEN
    RETURN;
  END IF;

  INSERT INTO opening_steps (cycle_id, role_id, step, released_at, released_by)
  SELECT cyc, x, s.step, s.at, chiefs[1]
  FROM unnest(roles) x,
       (VALUES ('applications', 1, n - CASE WHEN st = 1 THEN interval '7 days' ELSE interval '60 days' END),
               ('reviews', 3, n - CASE WHEN st = 3 THEN interval '2 days' WHEN st = 4 THEN interval '10 days' ELSE interval '39 days' END),
               ('interviews', 6, n - CASE WHEN st = 6 THEN interval '3 days' ELSE interval '29 days' END),
               ('feedback', 9, n - interval '5 days')) AS s(step, from_st, at)
  WHERE st >= s.from_st;

  INSERT INTO opening_deadlines (cycle_id, role_id, step, kind, due_at, hard)
  SELECT cyc, x, s.step, s.kind, s.due, s.hard
  FROM unnest(roles) WITH ORDINALITY AS o(x, k),
       LATERAL (VALUES
         ('applications', 'applicant', 1, true, n + CASE WHEN st = 1 THEN interval '14 days' ELSE interval '-40 days' END),
         ('reviews', 'reviewer', 3, false, n + CASE WHEN st = 3 THEN interval '7 days' WHEN st = 4 THEN interval '-1 day' ELSE interval '-30 days' END),
         ('interviews', 'interviewer', 6, true, n + CASE WHEN st = 6 THEN interval '7 days' ELSE interval '-20 days' END),
         ('interviews', 'recording_reviewer', 6, true, n + CASE WHEN st = 6 THEN interval '10 days' ELSE interval '-18 days' END),
         ('decisions', 'preference_list', 8, true, n + CASE WHEN st = 8 THEN interval '-1 day' ELSE interval '-10 days' END)
       ) AS s(step, kind, from_st, hard, due)
  WHERE st >= s.from_st;

  DROP TABLE IF EXISTS qa_app;
  CREATE TEMP TABLE qa_app ON COMMIT DROP AS
  SELECT i, gen_random_uuid() AS id, fakes[i] AS nuid, roles[2 - i % 2] AS role, i % 15 AS b, (i / 15) % 4 AS q,
         CASE
           WHEN st = 1 THEN CASE WHEN i % 5 = 0 THEN 0 ELSE 1 END
           WHEN i % 15 <= 9 OR st <= 4 THEN 2
           WHEN i % 15 <= 11 OR st <= 6 THEN 3
           ELSE 4
         END AS reach,
         pool[1 + i % cardinality(pool)] AS s1, pool[1 + (i + 1) % cardinality(pool)] AS s2,
         pool[1 + (i + 2) % cardinality(pool)] AS s3
  FROM generate_series(1, array_length(fakes, 1)) i;

  ALTER TABLE qa_app ADD COLUMN stage application_stage;
  UPDATE qa_app SET stage = CASE
    WHEN st = 1 THEN CASE WHEN reach = 0 THEN 'draft' ELSE 'submitted' END
    WHEN reach = 2 THEN CASE WHEN st <= 4 THEN 'lead_review' ELSE 'rejected' END
    WHEN reach = 3 THEN CASE
      WHEN st = 5 THEN 'interview'
      WHEN st = 6 THEN (ARRAY['interview', 'interview_scheduled', 'interview_conducted', 'interview_review'])[q + 1]
      ELSE 'rejected' END
    WHEN st <= 8 THEN 'selection'
    WHEN b <= 13 THEN 'accepted'
    ELSE 'rejected'
  END::application_stage;

  INSERT INTO applications (id, cycle_id, user_nuid, role_id, stage, availability, submitted_at)
  SELECT id, cyc, nuid, role, stage,
         jsonb_build_object('monday', i % 2 = 0, 'tuesday', i % 3 = 0, 'wednesday', true, 'thursday', i % 4 <> 0),
         CASE WHEN reach > 0 THEN n - make_interval(days => CASE WHEN st = 1 THEN 1 + i % 6 ELSE 41 + i % 18 END, mins => i) END
  FROM qa_app;

  INSERT INTO written_answers (application_id, question_id, answer_text, answer_options)
  SELECT a.id, q.id,
         CASE q.question_type
           WHEN 'long_answer' THEN 'QA answer from applicant ' || a.i || ': I like building things that help people and want to learn from a team that ships.'
           WHEN 'url' THEN 'https://example.com/qa-applicant-' || a.i
         END,
         CASE q.question_type
           WHEN 'checkbox' THEN (SELECT jsonb_agg(o) FROM jsonb_array_elements(q.options) WITH ORDINALITY e(o, k) WHERE (k + a.i) % 2 = 0 OR k = 1)
           WHEN 'multiple_choice' THEN jsonb_build_array(q.options -> (a.i % jsonb_array_length(q.options)))
           WHEN 'dropdown' THEN jsonb_build_array(q.options -> (a.i % jsonb_array_length(q.options)))
         END
  FROM qa_app a
  JOIN questions q ON q.cycle_id = cyc AND (q.role_id IS NULL OR q.role_id = a.role)
  WHERE a.reach > 0 OR q.display_order = 1;

  IF st = 1 THEN
    RETURN;
  END IF;

  d := gen_random_uuid();
  INSERT INTO application_moves (batch_id, application_id, from_stage, to_stage, moved_by, moved_at)
  SELECT d, id, 'submitted', 'lead_review', chiefs[1], n - interval '40 days'
  FROM qa_app ORDER BY i;

  IF st = 2 THEN
    RETURN;
  END IF;

  INSERT INTO lead_assignments (application_id, lead_nuid, assigned_by, assigned_at)
  SELECT a.id, l, chiefs[1], n - interval '40 days'
  FROM qa_app a, unnest(ARRAY[a.s1, a.s2, a.s3]) l
  WHERE a.reach >= 2;

  INSERT INTO written_reviews (application_id, reviewer_nuid, submitted_at)
  SELECT a.id, l.nuid,
         CASE WHEN st >= 4 OR a.b % 2 = 0 OR l.k = 1 THEN n - make_interval(days => CASE WHEN st = 3 THEN 1 ELSE 31 END, mins => a.i) END
  FROM qa_app a, unnest(ARRAY[a.s1, a.s2, a.s3]) WITH ORDINALITY AS l(nuid, k)
  WHERE a.reach >= 2 AND (st >= 4 OR a.b % 2 = 0 OR l.k <= 2);

  INSERT INTO written_review_answers (review_id, review_question_id, answer_text, score)
  SELECT w.id, rq.id,
         CASE WHEN rq.question_type = 'long_answer' THEN 'QA review note: clear motivation, solid project.' END,
         CASE WHEN rq.question_type = 'score' THEN 1 + (a.i * 7 + rq.display_order * 3 + right(w.reviewer_nuid, 1)::int) % 10 END
  FROM written_reviews w
  JOIN qa_app a ON a.id = w.application_id
  JOIN review_questions rq ON rq.cycle_id = cyc AND (rq.role_id IS NULL OR rq.role_id = a.role)
  WHERE w.submitted_at IS NOT NULL;

  IF st = 3 THEN
    RETURN;
  END IF;

  INSERT INTO chief_reviews (application_id, reviewer_nuid, vote, decided_at)
  SELECT a.id, c, CASE WHEN a.b >= 10 THEN 'interview' ELSE 'no_interview' END, n - interval '30 days'
  FROM qa_app a, unnest(chiefs[1:2]) c
  WHERE a.reach >= 2 AND (st >= 5 OR a.i % 2 = 0);

  IF st = 4 THEN
    RETURN;
  END IF;

  d := gen_random_uuid();
  INSERT INTO application_moves (batch_id, application_id, from_stage, to_stage, moved_by, moved_at)
  SELECT d, id, 'lead_review', CASE WHEN reach = 2 THEN 'rejected' ELSE 'interview' END::application_stage, chiefs[1], n - interval '30 days'
  FROM qa_app WHERE reach >= 2 ORDER BY i;

  IF st = 5 THEN
    RETURN;
  END IF;

  INSERT INTO interviews (application_id, scheduled_at, conducted_at, recording_url, notes_url, rating, writeup, submitted_at)
  SELECT id,
         CASE WHEN st > 6 THEN n - make_interval(days => 22 + i % 4)
              WHEN q = 0 THEN NULL
              WHEN q = 1 THEN n + make_interval(days => 1 + i % 5)
              ELSE n - make_interval(days => 1 + i % 2) END,
         CASE WHEN st > 6 THEN n - make_interval(days => 22 + i % 4)
              WHEN q >= 2 THEN n - make_interval(days => 1 + i % 2) END,
         CASE WHEN st > 6 OR q >= 2 THEN 'https://example.com/recording/qa-' || i END,
         CASE WHEN st > 6 OR q >= 2 THEN 'https://example.com/notes/qa-' || i END,
         CASE WHEN st > 6 OR q = 3 THEN
           (CASE WHEN reach >= 4 THEN ARRAY['great', 'must_hire', 'good'] ELSE ARRAY['neutral', 'do_not_hire', 'good'] END)[1 + i % 3]::interview_rating END,
         CASE WHEN st > 6 OR q = 3 THEN 'QA writeup: thoughtful answers and a clear walkthrough of their project.' END,
         CASE WHEN st > 6 THEN n - interval '21 days' WHEN q = 3 THEN n - interval '12 hours' END
  FROM qa_app WHERE reach >= 3;

  INSERT INTO interviewers (interview_id, interviewer_nuid, assigned_by, assigned_at)
  SELECT iv.id, l, chiefs[1], n - interval '29 days'
  FROM qa_app a JOIN interviews iv ON iv.application_id = a.id, unnest(ARRAY[a.s1, a.s2]) l;

  INSERT INTO interview_reviewers (interview_id, reviewer_nuid, assigned_by, assigned_at, writeup, writeup_submitted_at)
  SELECT iv.id, a.s3, chiefs[1], n - interval '29 days',
         CASE WHEN st > 6 OR (a.q = 3 AND a.i % 2 = 1) THEN 'QA recording review: agree with the interviewer.' END,
         CASE WHEN st > 6 THEN n - interval '19 days' WHEN a.q = 3 AND a.i % 2 = 1 THEN n - interval '6 hours' END
  FROM qa_app a JOIN interviews iv ON iv.application_id = a.id;

  IF st = 6 THEN
    RETURN;
  END IF;

  d := gen_random_uuid();
  INSERT INTO application_moves (batch_id, application_id, from_stage, to_stage, moved_by, moved_at)
  SELECT d, id, 'interview_review', CASE WHEN reach = 3 THEN 'rejected' ELSE 'selection' END::application_stage, chiefs[1], n - interval '20 days'
  FROM qa_app WHERE reach >= 3 ORDER BY i;

  IF st = 7 THEN
    RETURN;
  END IF;

  INSERT INTO preference_lists (cycle_id, name, status, created_by, submitted_at, meeting_day)
  VALUES (cyc, 'Team Alpha', 'submitted', chiefs[1], n - interval '12 days', 'monday') RETURNING id INTO team_a;
  INSERT INTO preference_lists (cycle_id, name, status, created_by, submitted_at, meeting_day)
  VALUES (cyc, 'Team Beta', 'submitted', chiefs[3], n - interval '11 days', 'wednesday') RETURNING id INTO team_b;

  INSERT INTO preference_list_members (preference_list_id, lead_nuid, added_by)
  SELECT team_a, s, chiefs[1] FROM unnest(chiefs[1:2]) s
  UNION ALL
  SELECT team_b, s, chiefs[3] FROM unnest(chiefs[3:] || leads) s;

  INSERT INTO preference_list_entries (preference_list_id, application_id, rank, reasoning, updated_by)
  SELECT t.list, a.id, row_number() OVER (PARTITION BY t.list, a.role ORDER BY (a.i * t.k) % 11, a.i),
         'QA reasoning: strong fit for this team.', t.owner
  FROM qa_app a, (VALUES (team_a, 3, chiefs[1]), (team_b, 7, chiefs[3])) AS t(list, k, owner)
  WHERE a.reach >= 4;

  IF st = 8 THEN
    RETURN;
  END IF;

  d := gen_random_uuid();
  INSERT INTO application_moves (batch_id, application_id, from_stage, to_stage, moved_by, moved_at)
  SELECT d, id, 'selection', stage, chiefs[1], n - interval '10 days'
  FROM qa_app WHERE reach >= 4 ORDER BY i;

  FOREACH r IN ARRAY roles LOOP
    INSERT INTO drafts (cycle_id, role_id, status, rounds, created_by) VALUES (cyc, r, 'complete', 5, chiefs[1]) RETURNING id INTO d;
    INSERT INTO draft_teams (draft_id, preference_list_id, position) VALUES (d, team_a, 0), (d, team_b, 1);
    INSERT INTO draft_picks (draft_id, pick_number, draft_team_id, application_id, previous_stage, picked_by, picked_at)
    SELECT d, p.k, dt.id, p.id, 'selection', chiefs[1], n - interval '10 days'
    FROM (SELECT id, row_number() OVER (ORDER BY i) AS k FROM qa_app WHERE role = r AND stage = 'accepted') p
    JOIN draft_teams dt ON dt.draft_id = d AND dt.position = (p.k - 1) % 2;
  END LOOP;

  INSERT INTO decision_drafts (application_id, kind, feedback, compliments, author_nuid, sent_at, sent_by)
  SELECT id,
         CASE WHEN reach >= 3 THEN 'rejection_post_interview' ELSE 'rejection_generic' END::decision_kind,
         CASE WHEN reach >= 3 THEN 'we were looking for a bit more depth in the project walkthrough.' END,
         CASE WHEN reach >= 3 THEN 'your side project and how you approached it.' END,
         chiefs[1],
         CASE WHEN i % 3 = 0 THEN n - interval '3 days' END,
         CASE WHEN i % 3 = 0 THEN chiefs[1] END
  FROM qa_app WHERE stage = 'rejected' AND i % 3 <> 2;
END
$$;

DO $$
DECLARE
  software uuid := '2a06a369-5c4d-4455-9311-34f34a3c0c41';
  chiefs text[] := ARRAY['002210268', '002217563', '002221589', '002239564', '002285124'];
  leads text[] := ARRAY[]::text[];
  names text[] := ARRAY[
    'Spring 2027 QA (Setup)', 'Fall 2027 QA (Applications)', 'Spring 2028 QA (Assign reviewers)',
    'Fall 2028 QA (Reviews)', 'Spring 2029 QA (Shortlist)', 'Fall 2029 QA (Assign interviewers)',
    'Spring 2030 QA (Interviews)', 'Fall 2030 QA (Preference lists)', 'Spring 2031 QA (Draft)', 'Fall 2031 QA (Feedback)'];
  firsts text[] := ARRAY['Ava', 'Ben', 'Chloe', 'Dev', 'Ella', 'Finn', 'Grace', 'Hiro', 'Isla', 'Jai', 'Kira', 'Leo', 'Maya', 'Nico', 'Omar',
                         'Priya', 'Quinn', 'Rosa', 'Sam', 'Tara', 'Uma', 'Vik', 'Wren', 'Xin', 'Yara'];
  lasts text[] := ARRAY['Nguyen', 'Patel', 'Garcia', 'Kim', 'Okafor', 'Rossi', 'Cohen', 'Silva', 'Tanaka', 'Murphy',
                        'Haddad', 'Larsen', 'Mensah', 'Novak', 'Ortiz', 'Park', 'Reyes', 'Shah', 'Walsh', 'Zhou'];
  fakes text[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM branches WHERE id = software) THEN
    RAISE EXCEPTION 'software branch not found';
  END IF;
  IF EXISTS (SELECT 1 FROM cycles WHERE id::text LIKE '0a000000-0000-4000-8000-%') THEN
    RAISE EXCEPTION 'QA cycles already seeded; run seed-qa-cycles-cleanup.sql first';
  END IF;

  INSERT INTO users (nuid, email, full_name, roles) VALUES
    ('002210268', 'young.lo@northeastern.edu', 'Lok Ye Young', '{applicant,admin}'),
    ('002217563', 'imadulla.z@northeastern.edu', 'Zainab Imadulla', '{applicant,admin}'),
    ('002221589', 'ho.dao@northeastern.edu', 'Dao Ho', '{applicant,admin}'),
    ('002239564', 'singh.harsh1@northeastern.edu', 'Harsh Singh', '{applicant,admin}'),
    ('002285124', 'nguyen.mai4@northeastern.edu', 'Mai Nguyen', '{applicant,admin}')
  ON CONFLICT (nuid) DO UPDATE SET roles = CASE WHEN 'admin' = ANY (users.roles) THEN users.roles ELSE users.roles || 'admin'::user_role END;

  SELECT array_agg('9001' || lpad(i::text, 5, '0') ORDER BY i) INTO fakes FROM generate_series(1, 150) i;
  INSERT INTO users (nuid, email, full_name, roles, graduation_year, major)
  SELECT fakes[i], 'qa.applicant' || i || '@example.com',
         firsts[1 + (i - 1) % 25] || ' ' || lasts[1 + ((i - 1) / 25 + i * 7) % 20] || ' (QA ' || i || ')', '{applicant}',
         2027 + i % 4, (ARRAY['Computer Science', 'Data Science', 'Computer Engineering', 'Design', 'Mathematics'])[1 + i % 5]
  FROM generate_series(1, 150) i
  ON CONFLICT (nuid) DO NOTHING;

  FOR k IN 0..9 LOOP
    PERFORM pg_temp.qa_cycle(('0a000000-0000-4000-8000-0000000001' || k || '0')::uuid, software, names[k + 1], k, chiefs, leads, fakes);
  END LOOP;
END
$$;
