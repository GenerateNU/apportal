// Stub reviewer actor until auth is wired up. Must be a chief that actually
// exists in the users table — writes like lead assignments FK assigned_by to
// this nuid, so a non-existent nuid fails with a 422.
export const REVIEWER_ACTOR = { nuid: '002221589', role: 'chief' as const }

// Stub applicant actor for the applicant-facing flow until auth is wired up.
// Matches a seed applicant; swap for the signed-in user once login is real.
export const APPLICANT_ACTOR = { nuid: '001000001', role: 'applicant' as const }
