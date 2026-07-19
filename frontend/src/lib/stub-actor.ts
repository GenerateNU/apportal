// Stub reviewer actor until auth is wired up — matches seed reviewer 002199001 (chief)
export const REVIEWER_ACTOR = { nuid: '002199001', role: 'chief' as const }

// Stub applicant actor for the applicant-facing flow until auth is wired up.
// Matches a seed applicant; swap for the signed-in user once login is real.
export const APPLICANT_ACTOR = { nuid: '001000001', role: 'applicant' as const }
