/**
 * Shared facts for the published policies.
 *
 * The date is a constant rather than `new Date()`: the policy pages are static
 * documents, and a date that moved on every build would tell a reader nothing
 * about when the words actually changed. Bump it by hand when the text does.
 */
export const policiesUpdated = {
  label: "15 November 2026",
  iso: "2026-11-15",
} as const;
