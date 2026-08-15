/** Single source of truth for branding and SEO copy. */
export const siteConfig = {
  name: "LMS Core",
  tagline: "A calm classroom for teachers and students",
  description:
    "LMS Core is a modern learning management platform for schools. Create classes, post assignments with rubrics, collect student work, and grade it all in one focused place.",
  url:
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000",
} as const;

/** Marketing copy for the landing page, kept beside the SEO metadata. */
export const featureHighlights = [
  {
    title: "Classes and rosters",
    description:
      "Spin up a class in seconds and share a seven-character code. Students join instantly — no invitations to chase.",
  },
  {
    title: "A stream that stays readable",
    description:
      "Announcements, threaded comments and attachments, with moderation controls when a conversation needs steering.",
  },
  {
    title: "Classwork with real structure",
    description:
      "Assignments, quizzes, questions and material, organised by topic, with due dates and point values.",
  },
  {
    title: "Grading built for focus",
    description:
      "A split-screen marking view puts the student's work beside the rubric, the grade box and private feedback.",
  },
  {
    title: "Grades you can trust",
    description:
      "A live gradebook with per-assignment breakdowns, class averages and CSV export for your records.",
  },
  {
    title: "Everything in one timeline",
    description:
      "A to-do list and calendar show every student exactly what is due next, and every teacher what is waiting to be reviewed.",
  },
] as const;
