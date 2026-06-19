**Application Portal — Context & Interview Flow Summary**

**Roles:** Software Engineer, Software Designer. Applicants can apply to multiple roles per cycle, one application per role.

**Login:** NUID as primary key, email stored but not used as identifier (too fragile). No OAuth/SSO.

**Application:** Collects written answers to injectable per-cycle questions, resume (Supabase Storage), availability (JSONB blob), and a GitHub repo link for the code challenge.

---

**Full Pipeline:**

1. **Submission** — Applicant submits written answers, resume, availability, and GitHub challenge link.

2. **TL Written Review** — Chiefs assign each application to 3 TLs. Each TL scores the written answers 1–10 per question plus an overall score and written reasoning.

3. **Chief Review** — Chiefs review TL scores and decide which applicants advance to interviews. No formal rating — just a boolean advance decision with notes.

4. **Interview Assignment** — Chiefs assign one interviewer (TL or Chief) per application, plus 2 different TLs to review the recording afterward.

5. **Interview Conducted** — The assigned interviewer conducts the interview, then fills out: session notes, overall comments, a rating (`do_not_hire / good / great / must_hire`), and a link to the recording.

6. **Recording Review** — The 2 assigned TLs watch the recording and each leave comments and a rating. All TLs can view all interviews at the app/RLS layer but only assigned ones submit a formal review.

7. **Selection** — All TLs review all interviews and mark who they want on their team. Chiefs use these selections to resolve conflicts and make final accept/reject decisions.

---

**Other Key Notes:**
- Code challenge scores are deferred — `raw_score` and `score_details JSONB` fields exist and will be populated externally (webhook/job) when ready. Whether past-semester scores are visible to reviewers is a flagged decision, not a blocker.
- Interview recordings are embedded links (Loom, Notion, etc.) — no file upload.
- Questions are injectable per cycle and can be role-specific or global.
- Reviewing can happen while applications are still open.
- `application_stage` enum tracks every step: `submitted → tl_review → chief_review → interview_scheduled → interview_conducted → interview_review → selection → accepted/rejected/withdrawn`.