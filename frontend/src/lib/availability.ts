// Availability for the club's weekly meeting times during the semester. Each
// option is a stable key in the JSONB availability blob stored on the
// application — shared between the applicant-facing form and reviewer-facing
// display/filtering so both sides always agree on the same slot keys.
//
// TODO: these time options are hardcoded for now — they should eventually be
// configured per cycle in the application builder (admin), the same way
// questions and the code challenge are, rather than baked into the client.
export const AVAILABILITY_OPTIONS = [
  { key: 'monday_1800_1930', label: 'Monday 6:00–7:30 PM' },
  { key: 'tuesday_1930_2100', label: 'Tuesday 7:30–9:00 PM' },
  { key: 'wednesday_1800_1930', label: 'Wednesday 6:00–7:30 PM' },
  { key: 'thursday_1930_2100', label: 'Thursday 7:30–9:00 PM' },
] as const
