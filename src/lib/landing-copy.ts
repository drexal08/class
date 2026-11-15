/**
 * The copy on the public landing page.
 *
 * It lives apart from `site.ts` so that the branding and SEO config stays a
 * small module any component can import, and this page-sized copy stays with
 * the page that uses it.
 */

/** What the product does, in the order the landing page tells it. */
export const featureHighlights = [
  {
    icon: "grid",
    title: "Classes and rosters",
    description:
      "Spin up a class in seconds and share a seven-character code. Students join instantly — no invitations to chase.",
  },
  {
    icon: "messages",
    title: "A stream that stays readable",
    description:
      "Announcements, threaded comments and attachments, with moderation controls when a conversation needs steering.",
  },
  {
    icon: "work",
    title: "Classwork with a clear structure",
    description:
      "Assignments, quizzes, questions and material, organised by topic, with due dates and point values.",
  },
  {
    icon: "marking",
    title: "Grading built for focus",
    description:
      "A split-screen marking view puts the student's work beside the rubric, the grade box and private feedback.",
  },
  {
    icon: "grades",
    title: "A gradebook that adds up",
    description:
      "A live gradebook with per-assignment breakdowns, class averages and CSV export for your records.",
  },
  {
    icon: "timeline",
    title: "One view of what is due",
    description:
      "A to-do list and calendar show every student exactly what is due next, and every teacher what is waiting to be reviewed.",
  },
] as const;

/**
 * The principles the product is built on.
 *
 * These are the claims that are true of the app as it stands, not promises.
 * The icon is a key into the icon map on the landing page.
 */
export const principles = [
  {
    icon: "feather",
    title: "Quiet by default",
    description:
      "Announcements, badges and notifications only appear when there is something worth interrupting for.",
  },
  {
    icon: "shield",
    title: "The rules hold everywhere",
    description:
      "Classwork, grading and archiving are enforced on the server, so behaviour never depends on which screen someone is using.",
  },
  {
    icon: "lock",
    title: "Your files stay private",
    description:
      "Uploads live in a private bucket and are only ever served through short-lived signed links.",
  },
] as const;

/** What a teacher does, in order. */
export const teacherWorkflow = [
  {
    title: "Create the class",
    description:
      "Name it, describe it, and share the seven-character code. Students join from any device.",
  },
  {
    title: "Set the work",
    description:
      "Post assignments, quizzes and material, attach a rubric with a maximum per criterion, and set a due date.",
  },
  {
    title: "Mark and return",
    description:
      "Work down the queue in the marking view, tick the criteria, write private feedback, then return the grade.",
  },
] as const;

/** What a student does, in order. */
export const studentWorkflow = [
  {
    title: "Join with the code",
    description:
      "Enter the seven-character code and you are in the class. There is no invitation to wait for.",
  },
  {
    title: "See what is due",
    description:
      "One to-do list and one calendar, ordered by what is due next — not by which tab you opened first.",
  },
  {
    title: "Submit and get it back",
    description:
      "Attach your work, hand it in, and read the mark, the rubric and the feedback once it is returned.",
  },
] as const;

/** The section links in the page header. */
export const landingNav = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "For teachers", href: "#teachers" },
  { label: "For students", href: "#students" },
] as const;

/** The links in the footer. Every one of them points at a real route. */
export const footerLinks = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "How it works", href: "/#how-it-works" },
      { label: "For teachers", href: "/#teachers" },
      { label: "For students", href: "/#students" },
    ],
  },
  {
    heading: "Get started",
    links: [
      { label: "Create an account", href: "/register" },
      { label: "Sign in", href: "/login" },
    ],
  },
] as const;
