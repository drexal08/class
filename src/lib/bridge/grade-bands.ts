/**
 * The grade bands the standalone clabridge app showed.
 *
 * The cut-offs and the wording come from that app and must not drift: the
 * native port is only faithful if it says the same things at the same
 * percentages.
 */
export type GradeBand = {
  min: number;
  label: string;
  note: string;
  ringClass: string;
};

export const GRADE_BANDS: GradeBand[] = [
  {
    min: 95,
    label: "Remarkable",
    note: "You will be recognized for your remarkable efforts. Keep setting the standard.",
    ringClass: "stroke-primary",
  },
  {
    min: 90,
    label: "Top performer",
    note: "With this average, you may rank among the top-performing students in your community.",
    ringClass: "stroke-primary",
  },
  {
    min: 80,
    label: "Excellent",
    note: "This is an excellent average. Maintain your discipline and keep pushing toward the very top.",
    ringClass: "stroke-primary",
  },
  {
    min: 70,
    label: "Strong",
    note: "This is a strong result. Keep working consistently to make your university applications even more competitive.",
    ringClass: "stroke-primary",
  },
  {
    min: 60,
    label: "Promoted",
    note: "You have the marks needed to pass, but averages in the 60s are not highly appreciated by universities. Put in greater effort now to make university applications easier after high school.",
    ringClass: "stroke-warning",
  },
  {
    min: 50,
    label: "Almost there",
    note: "Remember, to get promoted you need an average of 60 for the whole year. Put in some effort—you will make it.",
    ringClass: "stroke-danger",
  },
  {
    min: 0,
    label: "Below target",
    note: "Your average is below the promotion target. Start improving each subject now and ask for support where you need it.",
    ringClass: "stroke-danger",
  },
];

/** The band a weighted percentage falls into. */
export function bandFor(pct: number): GradeBand {
  return (
    GRADE_BANDS.find((band) => pct >= band.min) ?? {
      min: 0,
      label: "Getting started",
      note: "",
      ringClass: "stroke-danger",
    }
  );
}
