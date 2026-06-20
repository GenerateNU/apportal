-- ═══════════════════════════════════════════════════════════════
--  seed.sql — Development seed data for ApPortal
--
--  Covers: users, cycles, questions, code_challenges, applicants,
--          applications (spread across stages), written_answers,
--          and code_submissions.
--
--  Idempotent: truncates all data then re-inserts.
--  Run:  psql "$DATABASE_URL" -f internal/supabase/seed.sql
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- Truncate top-level tables; CASCADE handles all dependents.
TRUNCATE users, cycles, applicants CASCADE;


-- ── Users (staff / reviewers) ─────────────────────────────────

INSERT INTO users (nuid, email, full_name, reviewer_role, github_username) VALUES
  ('002199001', 'sarah.chen@northeastern.edu',     'Sarah Chen',      'chief', 'sarah-chen'),
  ('002199002', 'marcus.johnson@northeastern.edu', 'Marcus Johnson',  'chief', 'marcusj'),
  ('002199003', 'emily.rodriguez@northeastern.edu','Emily Rodriguez', 'tl',    'emily-r'),
  ('002199004', 'david.kim@northeastern.edu',      'David Kim',       'tl',    'david-kim'),
  ('002199005', 'priya.patel@northeastern.edu',    'Priya Patel',     'tl',    'priya-p'),
  ('002199006', 'alex.thompson@northeastern.edu',  'Alex Thompson',   'tl',    'alex-t');


-- ── Cycles ────────────────────────────────────────────────────

INSERT INTO cycles (id, name, status, opens_at, closes_at) VALUES
  ('c0000001-0000-0000-0000-000000000000',
   'Spring 2026', 'closed',
   '2026-01-15 09:00:00+00', '2026-02-15 23:59:59+00'),

  ('c0000002-0000-0000-0000-000000000000',
   'Fall 2026', 'open',
   '2026-08-25 09:00:00+00', '2026-09-25 23:59:59+00');


-- ── Questions — Fall 2026 ──────────────────────────────────────
-- Shared questions (role IS NULL → shown to all applicants)

INSERT INTO questions (id, cycle_id, role, question_text, question_type, is_required, display_order, options) VALUES
  ('q0000001-0000-0000-0000-000000000000',
   'c0000002-0000-0000-0000-000000000000',
   NULL,
   'Why do you want to join Generate, and what do you hope to build here?',
   'long_answer', TRUE, 1, NULL),

  ('q0000002-0000-0000-0000-000000000000',
   'c0000002-0000-0000-0000-000000000000',
   NULL,
   'How many hours per week can you realistically commit to Generate?',
   'short_answer', TRUE, 2, NULL),

  ('q0000003-0000-0000-0000-000000000000',
   'c0000002-0000-0000-0000-000000000000',
   NULL,
   'Share a link to your portfolio, LinkedIn, or personal website (optional).',
   'url', FALSE, 3, NULL);

-- Software Engineer–specific questions

INSERT INTO questions (id, cycle_id, role, question_text, question_type, is_required, display_order, options) VALUES
  ('q0000004-0000-0000-0000-000000000000',
   'c0000002-0000-0000-0000-000000000000',
   'software_engineer',
   'Describe a technical challenge you faced on a project. What was your approach and what did you learn?',
   'long_answer', TRUE, 4, NULL),

  ('q0000005-0000-0000-0000-000000000000',
   'c0000002-0000-0000-0000-000000000000',
   'software_engineer',
   'What languages, frameworks, or tools do you reach for most, and why?',
   'short_answer', TRUE, 5, NULL);

-- Software Designer–specific questions

INSERT INTO questions (id, cycle_id, role, question_text, question_type, is_required, display_order, options) VALUES
  ('q0000006-0000-0000-0000-000000000000',
   'c0000002-0000-0000-0000-000000000000',
   'software_designer',
   'Walk us through your design process, from understanding a brief to final delivery.',
   'long_answer', TRUE, 4, NULL),

  ('q0000007-0000-0000-0000-000000000000',
   'c0000002-0000-0000-0000-000000000000',
   'software_designer',
   'Which design tools do you use regularly?',
   'checkbox', TRUE, 5,
   '["Figma", "Adobe XD", "Framer", "Protopie", "Illustrator", "Photoshop", "Sketch"]');


-- ── Code Challenge — Fall 2026 (SE) ───────────────────────────

INSERT INTO code_challenges (id, cycle_id, role, name, github_repo_url, instructions, due_at) VALUES
  ('cc000001-0000-0000-0000-000000000000',
   'c0000002-0000-0000-0000-000000000000',
   'software_engineer',
   'Backend API Challenge',
   'https://github.com/GenerateNU/fall-2026-backend-challenge',
   'Fork the template repository and implement the specified REST endpoints. All requirements are in the README. Submit your fork URL before the deadline.',
   '2026-09-20 23:59:59+00');


-- ── Applicants ────────────────────────────────────────────────

INSERT INTO applicants (nuid, email, full_name, github_username, graduation_year, major) VALUES
  -- SE applicants
  ('003100001', 'jordan.lee@northeastern.edu',     'Jordan Lee',     'jordan-lee',  2028, 'Computer Science'),
  ('003100002', 'maya.patel@northeastern.edu',     'Maya Patel',     'maya-p',      2027, 'Computer Science'),
  ('003100003', 'liam.nguyen@northeastern.edu',    'Liam Nguyen',    'liam-nguyen', 2028, 'Computer Engineering'),
  ('003100004', 'sophia.wu@northeastern.edu',      'Sophia Wu',      'sophiawu',    2026, 'Information Systems'),
  ('003100005', 'ethan.brown@northeastern.edu',    'Ethan Brown',    'ethan-b',     2027, 'Computer Science'),
  ('003100006', 'chloe.kim@northeastern.edu',      'Chloe Kim',      'chloe-kim',   2028, 'Data Science'),
  -- SD applicants
  ('003100007', 'noah.garcia@northeastern.edu',    'Noah Garcia',    'noah-g',      2027, 'Interaction Design'),
  ('003100008', 'ava.chen@northeastern.edu',       'Ava Chen',       'avachen',     2028, 'Graphic Design'),
  ('003100009', 'lucas.martin@northeastern.edu',   'Lucas Martin',   'lucas-m',     2027, 'Communication Design'),
  ('003100010', 'isabella.jones@northeastern.edu', 'Isabella Jones', 'izzy-j',      2026, 'Media Arts');


-- ── Applications — Fall 2026 ───────────────────────────────────
-- Spread across stages to exercise the full reviewer pipeline.

INSERT INTO applications (id, cycle_id, applicant_nuid, role, stage, availability, resume_url, submitted_at) VALUES

  -- ── Software Engineer ──────────────────────────────────────

  ('ap000001-0000-0000-0000-000000000000',
   'c0000002-0000-0000-0000-000000000000', '003100001',
   'software_engineer', 'submitted',
   '{"mon_am":true,"mon_pm":true,"tue_am":false,"tue_pm":true,"wed_am":true,"wed_pm":false,"thu_am":true,"thu_pm":true,"fri_am":false,"fri_pm":false}',
   'https://storage.example.com/resumes/jordan-lee.pdf',
   '2026-09-01 14:22:00+00'),

  ('ap000002-0000-0000-0000-000000000000',
   'c0000002-0000-0000-0000-000000000000', '003100002',
   'software_engineer', 'submitted',
   '{"mon_am":false,"mon_pm":true,"tue_am":true,"tue_pm":true,"wed_am":false,"wed_pm":false,"thu_am":true,"thu_pm":false,"fri_am":true,"fri_pm":true}',
   'https://storage.example.com/resumes/maya-patel.pdf',
   '2026-09-02 10:05:00+00'),

  ('ap000003-0000-0000-0000-000000000000',
   'c0000002-0000-0000-0000-000000000000', '003100003',
   'software_engineer', 'tl_review',
   '{"mon_am":true,"mon_pm":false,"tue_am":true,"tue_pm":false,"wed_am":true,"wed_pm":true,"thu_am":false,"thu_pm":true,"fri_am":true,"fri_pm":false}',
   'https://storage.example.com/resumes/liam-nguyen.pdf',
   '2026-09-01 09:15:00+00'),

  ('ap000004-0000-0000-0000-000000000000',
   'c0000002-0000-0000-0000-000000000000', '003100004',
   'software_engineer', 'chief_review',
   '{"mon_am":true,"mon_pm":true,"tue_am":true,"tue_pm":false,"wed_am":false,"wed_pm":false,"thu_am":true,"thu_pm":true,"fri_am":true,"fri_pm":true}',
   'https://storage.example.com/resumes/sophia-wu.pdf',
   '2026-08-31 16:44:00+00'),

  ('ap000005-0000-0000-0000-000000000000',
   'c0000002-0000-0000-0000-000000000000', '003100005',
   'software_engineer', 'interview_scheduled',
   '{"mon_am":false,"mon_pm":false,"tue_am":true,"tue_pm":true,"wed_am":true,"wed_pm":true,"thu_am":false,"thu_pm":false,"fri_am":true,"fri_pm":false}',
   'https://storage.example.com/resumes/ethan-brown.pdf',
   '2026-08-30 11:30:00+00'),

  ('ap000006-0000-0000-0000-000000000000',
   'c0000002-0000-0000-0000-000000000000', '003100006',
   'software_engineer', 'accepted',
   '{"mon_am":true,"mon_pm":true,"tue_am":true,"tue_pm":true,"wed_am":true,"wed_pm":true,"thu_am":false,"thu_pm":false,"fri_am":false,"fri_pm":false}',
   'https://storage.example.com/resumes/chloe-kim.pdf',
   '2026-08-28 08:00:00+00'),

  -- ── Software Designer ──────────────────────────────────────

  ('ap000007-0000-0000-0000-000000000000',
   'c0000002-0000-0000-0000-000000000000', '003100007',
   'software_designer', 'submitted',
   '{"mon_am":true,"mon_pm":false,"tue_am":false,"tue_pm":true,"wed_am":true,"wed_pm":true,"thu_am":false,"thu_pm":true,"fri_am":true,"fri_pm":false}',
   'https://storage.example.com/resumes/noah-garcia.pdf',
   '2026-09-03 13:00:00+00'),

  ('ap000008-0000-0000-0000-000000000000',
   'c0000002-0000-0000-0000-000000000000', '003100008',
   'software_designer', 'tl_review',
   '{"mon_am":false,"mon_pm":true,"tue_am":true,"tue_pm":false,"wed_am":false,"wed_pm":true,"thu_am":true,"thu_pm":false,"fri_am":false,"fri_pm":true}',
   'https://storage.example.com/resumes/ava-chen.pdf',
   '2026-09-01 17:22:00+00'),

  ('ap000009-0000-0000-0000-000000000000',
   'c0000002-0000-0000-0000-000000000000', '003100009',
   'software_designer', 'interview_scheduled',
   '{"mon_am":true,"mon_pm":true,"tue_am":false,"tue_pm":false,"wed_am":true,"wed_pm":false,"thu_am":true,"thu_pm":true,"fri_am":false,"fri_pm":true}',
   'https://storage.example.com/resumes/lucas-martin.pdf',
   '2026-08-29 12:12:00+00'),

  ('ap000010-0000-0000-0000-000000000000',
   'c0000002-0000-0000-0000-000000000000', '003100010',
   'software_designer', 'rejected',
   '{"mon_am":false,"mon_pm":false,"tue_am":true,"tue_pm":true,"wed_am":false,"wed_pm":false,"thu_am":true,"thu_pm":true,"fri_am":true,"fri_pm":true}',
   'https://storage.example.com/resumes/isabella-jones.pdf',
   '2026-08-27 09:45:00+00');


-- ── Written Answers ───────────────────────────────────────────
-- Provide answers for all applications that have moved past submission.

-- Jordan Lee — SE, submitted (ap000001)
INSERT INTO written_answers (application_id, question_id, answer_text, answer_options) VALUES
  ('ap000001-0000-0000-0000-000000000000', 'q0000001-0000-0000-0000-000000000000',
   'I want to join Generate because I believe in shipping real products for real users. The idea of building something that Northeastern students actually rely on is motivating in a way that class projects never are.', NULL),
  ('ap000001-0000-0000-0000-000000000000', 'q0000002-0000-0000-0000-000000000000',
   '10–12 hours', NULL),
  ('ap000001-0000-0000-0000-000000000000', 'q0000003-0000-0000-0000-000000000000',
   'https://jordanlee.dev', NULL),
  ('ap000001-0000-0000-0000-000000000000', 'q0000004-0000-0000-0000-000000000000',
   'During a co-op I had to migrate a legacy REST API to GraphQL under a tight deadline. I introduced a compatibility shim so both surfaces stayed live during the transition, then cut over incrementally. Zero downtime, and the team shipped on time.', NULL),
  ('ap000001-0000-0000-0000-000000000000', 'q0000005-0000-0000-0000-000000000000',
   'TypeScript, Go, React, PostgreSQL', NULL);

-- Maya Patel — SE, submitted (ap000002)
INSERT INTO written_answers (application_id, question_id, answer_text, answer_options) VALUES
  ('ap000002-0000-0000-0000-000000000000', 'q0000001-0000-0000-0000-000000000000',
   'Generate represents the intersection of design thinking and engineering that I care about. I want to contribute to a team that ships software used by people I actually know.', NULL),
  ('ap000002-0000-0000-0000-000000000000', 'q0000002-0000-0000-0000-000000000000',
   '8–10 hours', NULL),
  ('ap000002-0000-0000-0000-000000000000', 'q0000004-0000-0000-0000-000000000000',
   'I traced a 4-second page load to an N+1 query on a personal project. Adding a composite index and rewriting the ORM query to eager-load associations brought it under 200ms.', NULL),
  ('ap000002-0000-0000-0000-000000000000', 'q0000005-0000-0000-0000-000000000000',
   'Python, FastAPI, React, SQLAlchemy', NULL);

-- Liam Nguyen — SE, tl_review (ap000003)
INSERT INTO written_answers (application_id, question_id, answer_text, answer_options) VALUES
  ('ap000003-0000-0000-0000-000000000000', 'q0000001-0000-0000-0000-000000000000',
   'I have seen Generate''s work on campus and the quality stands out. I want to grow as a full-stack engineer while making a tangible difference at the university.', NULL),
  ('ap000003-0000-0000-0000-000000000000', 'q0000002-0000-0000-0000-000000000000',
   '12 hours', NULL),
  ('ap000003-0000-0000-0000-000000000000', 'q0000004-0000-0000-0000-000000000000',
   'I built a real-time collaborative whiteboard and hit race conditions when multiple users edited the same element simultaneously. I resolved it with a server-authoritative model using operational transforms.', NULL),
  ('ap000003-0000-0000-0000-000000000000', 'q0000005-0000-0000-0000-000000000000',
   'JavaScript, Node.js, React, MongoDB', NULL);

-- Sophia Wu — SE, chief_review (ap000004)
INSERT INTO written_answers (application_id, question_id, answer_text, answer_options) VALUES
  ('ap000004-0000-0000-0000-000000000000', 'q0000001-0000-0000-0000-000000000000',
   'Generate builds products that matter to people at Northeastern. I want to be part of a team that takes ideas from zero to production and iterates on real user feedback.', NULL),
  ('ap000004-0000-0000-0000-000000000000', 'q0000002-0000-0000-0000-000000000000',
   '10 hours', NULL),
  ('ap000004-0000-0000-0000-000000000000', 'q0000003-0000-0000-0000-000000000000',
   'https://github.com/sophiawu', NULL),
  ('ap000004-0000-0000-0000-000000000000', 'q0000004-0000-0000-0000-000000000000',
   'On co-op I architected an event-driven notification system. The original approach had ~15% delivery failures. I replaced it with a durable message queue with retry logic, bringing failures under 0.1%.', NULL),
  ('ap000004-0000-0000-0000-000000000000', 'q0000005-0000-0000-0000-000000000000',
   'Java, Spring Boot, Kafka, React', NULL);

-- Ethan Brown — SE, interview_scheduled (ap000005)
INSERT INTO written_answers (application_id, question_id, answer_text, answer_options) VALUES
  ('ap000005-0000-0000-0000-000000000000', 'q0000001-0000-0000-0000-000000000000',
   'I want to work on a product that outlasts my time at Northeastern. Generate''s track record of handing off working software to clients is exactly the kind of environment where I want to develop.', NULL),
  ('ap000005-0000-0000-0000-000000000000', 'q0000002-0000-0000-0000-000000000000',
   '12–15 hours', NULL),
  ('ap000005-0000-0000-0000-000000000000', 'q0000003-0000-0000-0000-000000000000',
   'https://ethan-brown.com', NULL),
  ('ap000005-0000-0000-0000-000000000000', 'q0000004-0000-0000-0000-000000000000',
   'I had to reduce cold start latency on a Lambda-based service from ~3s to under 500ms. I profiled the initialization path, switched to a lighter SDK, and moved secrets loading to async — hit 420ms.', NULL),
  ('ap000005-0000-0000-0000-000000000000', 'q0000005-0000-0000-0000-000000000000',
   'Go, AWS, React, PostgreSQL, Terraform', NULL);

-- Chloe Kim — SE, accepted (ap000006)
INSERT INTO written_answers (application_id, question_id, answer_text, answer_options) VALUES
  ('ap000006-0000-0000-0000-000000000000', 'q0000001-0000-0000-0000-000000000000',
   'I applied because I wanted to do engineering work that actually ships. After talking to Generate members I knew this was the right place — the culture of ownership and craft is rare at the undergrad level.', NULL),
  ('ap000006-0000-0000-0000-000000000000', 'q0000002-0000-0000-0000-000000000000',
   '10 hours', NULL),
  ('ap000006-0000-0000-0000-000000000000', 'q0000004-0000-0000-0000-000000000000',
   'I led a database migration on a live product with 50k users. I wrote the migration to be backwards compatible, ran it behind a feature flag, and monitored p99 latency throughout — no incidents.', NULL),
  ('ap000006-0000-0000-0000-000000000000', 'q0000005-0000-0000-0000-000000000000',
   'TypeScript, Next.js, Go, PostgreSQL', NULL);

-- Noah Garcia — SD, submitted (ap000007)
INSERT INTO written_answers (application_id, question_id, answer_text, answer_options) VALUES
  ('ap000007-0000-0000-0000-000000000000', 'q0000001-0000-0000-0000-000000000000',
   'I love Generate''s collaborative, product-focused culture. As a designer I want to work closely with engineers to bring thoughtful interfaces to life for users who actually depend on them.', NULL),
  ('ap000007-0000-0000-0000-000000000000', 'q0000002-0000-0000-0000-000000000000',
   '8 hours', NULL),
  ('ap000007-0000-0000-0000-000000000000', 'q0000003-0000-0000-0000-000000000000',
   'https://noahgarcia.design', NULL),
  ('ap000007-0000-0000-0000-000000000000', 'q0000006-0000-0000-0000-000000000000',
   'I start with stakeholder interviews and a competitor audit, move into low-fi wireframes to align on structure, then iterate on high-fi prototypes in Figma with the team before handoff.', NULL),
  ('ap000007-0000-0000-0000-000000000000', 'q0000007-0000-0000-0000-000000000000',
   NULL, '["Figma", "Protopie"]');

-- Ava Chen — SD, tl_review (ap000008)
INSERT INTO written_answers (application_id, question_id, answer_text, answer_options) VALUES
  ('ap000008-0000-0000-0000-000000000000', 'q0000001-0000-0000-0000-000000000000',
   'I want to design interfaces that students actually enjoy using. Generate''s portfolio of real products is exactly the kind of environment where I want to grow as a product designer.', NULL),
  ('ap000008-0000-0000-0000-000000000000', 'q0000002-0000-0000-0000-000000000000',
   '10 hours', NULL),
  ('ap000008-0000-0000-0000-000000000000', 'q0000006-0000-0000-0000-000000000000',
   'I ground every project in user research first — interviews, usage data, whatever I can get. I use affinity mapping to synthesize findings, then move from sketches to interactive Figma prototypes with usability testing at each stage.', NULL),
  ('ap000008-0000-0000-0000-000000000000', 'q0000007-0000-0000-0000-000000000000',
   NULL, '["Figma", "Framer", "Illustrator"]');

-- Lucas Martin — SD, interview_scheduled (ap000009)
INSERT INTO written_answers (application_id, question_id, answer_text, answer_options) VALUES
  ('ap000009-0000-0000-0000-000000000000', 'q0000001-0000-0000-0000-000000000000',
   'The opportunity to work on products with a real user base is rare at this level. I want to be surrounded by people who take design craft seriously and ship things together.', NULL),
  ('ap000009-0000-0000-0000-000000000000', 'q0000002-0000-0000-0000-000000000000',
   '10–12 hours', NULL),
  ('ap000009-0000-0000-0000-000000000000', 'q0000003-0000-0000-0000-000000000000',
   'https://lucasmartindesign.com', NULL),
  ('ap000009-0000-0000-0000-000000000000', 'q0000006-0000-0000-0000-000000000000',
   'My process is research → define → ideate → prototype → test. I spend more time in the define phase than most because clarity there saves hours of revision later.', NULL),
  ('ap000009-0000-0000-0000-000000000000', 'q0000007-0000-0000-0000-000000000000',
   NULL, '["Figma", "Adobe XD", "Protopie", "Illustrator"]');

-- Isabella Jones — SD, rejected (ap000010)
INSERT INTO written_answers (application_id, question_id, answer_text, answer_options) VALUES
  ('ap000010-0000-0000-0000-000000000000', 'q0000001-0000-0000-0000-000000000000',
   'I want to apply my design skills to a team that ships real software.', NULL),
  ('ap000010-0000-0000-0000-000000000000', 'q0000002-0000-0000-0000-000000000000',
   '5 hours', NULL),
  ('ap000010-0000-0000-0000-000000000000', 'q0000006-0000-0000-0000-000000000000',
   'I usually sketch some ideas, pick the best one, and turn it into a Figma mockup.', NULL),
  ('ap000010-0000-0000-0000-000000000000', 'q0000007-0000-0000-0000-000000000000',
   NULL, '["Figma"]');


-- ── Code Submissions (SE applicants) ──────────────────────────

INSERT INTO code_submissions (application_id, challenge_id, github_repo_url, raw_score, score_details, score_updated_at) VALUES
  ('ap000001-0000-0000-0000-000000000000', 'cc000001-0000-0000-0000-000000000000',
   'https://github.com/jordan-lee/fall-2026-backend-challenge',
   NULL, NULL, NULL),

  ('ap000002-0000-0000-0000-000000000000', 'cc000001-0000-0000-0000-000000000000',
   'https://github.com/maya-p/fall-2026-backend-challenge',
   NULL, NULL, NULL),

  ('ap000003-0000-0000-0000-000000000000', 'cc000001-0000-0000-0000-000000000000',
   'https://github.com/liam-nguyen/fall-2026-backend-challenge',
   78, '{"tests_passed":19,"tests_total":25,"notes":"Good attempt; auth middleware incomplete"}',
   NOW()),

  ('ap000004-0000-0000-0000-000000000000', 'cc000001-0000-0000-0000-000000000000',
   'https://github.com/sophiawu/fall-2026-backend-challenge',
   85, '{"tests_passed":21,"tests_total":25,"notes":"Solid overall; a few edge cases missed"}',
   NOW()),

  ('ap000005-0000-0000-0000-000000000000', 'cc000001-0000-0000-0000-000000000000',
   'https://github.com/ethan-b/fall-2026-backend-challenge',
   91, '{"tests_passed":23,"tests_total":25,"notes":"Clean implementation; excellent error handling"}',
   NOW()),

  ('ap000006-0000-0000-0000-000000000000', 'cc000001-0000-0000-0000-000000000000',
   'https://github.com/chloe-kim/fall-2026-backend-challenge',
   96, '{"tests_passed":25,"tests_total":25,"notes":"Full marks; standout code quality and docs"}',
   NOW());


COMMIT;
