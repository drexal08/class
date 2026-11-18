import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import type { AssignmentType } from "../src/generated/prisma/client";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Demo data.
 *
 * Creates one teacher, four students and two classes, with submissions in every
 * SubmissionState so the gradebook, to-do list and grading view all have
 * something realistic to render.
 *
 * Every write is idempotent, so `npm run db:seed` can be run repeatedly without
 * duplicating stream posts, classwork, submissions or notifications.
 *
 *   SEED_ALLOW=true npm run db:seed
 */
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error(
    "\n  DATABASE_URL is not set. Copy .env.example to .env and add a PostgreSQL connection string.\n  See SETUP.md for how to point the app at Neon or a local Postgres.\n",
  );
  process.exit(1);
}

/**
 * Refuses to seed unless the operator says so.
 *
 * This project's `.env` points at the live Neon database, so an unguarded
 * `npm run db:seed` writes fictional users and classes straight into
 * production — where they show up in the admin console as if they were real
 * people. Seeding has to be a deliberate act.
 */
if (process.env.SEED_ALLOW !== "true") {
  console.error(
    "\n  Refusing to seed: demo users and demo classes would be written to the\n" +
      `  database in DATABASE_URL (${describeDatabase(connectionString)}).\n\n` +
      "  If that is a scratch database, go ahead with:\n" +
      "    SEED_ALLOW=true npm run db:seed\n",
  );
  process.exit(1);
}

/** Host and path only — never the credentials. */
function describeDatabase(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return "the configured database";
  }
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

/** Same ambiguity-free alphabet the app uses for real join codes. */
function code(seed: string): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 7; i += 1) {
    out += alphabet[(seed.charCodeAt(i % seed.length) * (i + 7)) % alphabet.length];
  }
  return out;
}

function daysFromNow(days: number, hour = 23, minute = 59): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date;
}

async function main() {
  console.log("Seeding demo data…");

  // Development sign-in derives ids from the email, so these ids let you sign in
  // as any of these people with AUTH_DEV_MODE=true.
  const devId = (email: string) =>
    `dev_${Buffer.from(email).toString("hex").slice(0, 40)}`;

  const people = [
    // Administrators keep their own role in the LMS; the flag only unlocks the
    // admin console.
    {
      email: "admin@school.edu",
      displayName: "Alex Mensah",
      role: "TEACHER" as const,
      isAdmin: true,
    },
    {
      email: "teacher@school.edu",
      displayName: "Ada Okonkwo",
      role: "TEACHER" as const,
      isAdmin: false,
    },
    {
      email: "amara@school.edu",
      displayName: "Amara Diallo",
      role: "STUDENT" as const,
      isAdmin: false,
    },
    {
      email: "ben@school.edu",
      displayName: "Ben Carter",
      role: "STUDENT" as const,
      isAdmin: false,
    },
    {
      email: "chidi@school.edu",
      displayName: "Chidi Eze",
      role: "STUDENT" as const,
      isAdmin: false,
    },
    {
      email: "dana@school.edu",
      displayName: "Dana Whitfield",
      role: "STUDENT" as const,
      isAdmin: false,
    },
  ];

  const users = await Promise.all(
    people.map((person) =>
      prisma.user.upsert({
        where: { email: person.email },
        create: { id: devId(person.email), ...person },
        update: {
          displayName: person.displayName,
          role: person.role,
          isAdmin: person.isAdmin,
        },
        select: { id: true, email: true, displayName: true, role: true },
      }),
    ),
  );

  const teacher = users.find((u) => u.email === "teacher@school.edu")!;
  const students = users.filter((u) => u.role === "STUDENT");

  // --- Class 1: Biology --------------------------------------------------
  const biology = await prisma.course.upsert({
    where: { code: code("biology") },
    create: {
      name: "Biology 101",
      section: "Period 3",
      subject: "Science",
      room: "B-204",
      description:
        "An introduction to cell biology, genetics and ecology. Bring your lab notebook to every session.",
      code: code("biology"),
      accent: "slate-light",
      teacherId: teacher.id,
    },
    update: {},
    select: { id: true },
  });

  const literature = await prisma.course.upsert({
    where: { code: code("english") },
    create: {
      name: "World Literature",
      section: "Period 5",
      subject: "English",
      room: "A-112",
      description:
        "Close reading of novels, poetry and drama from around the world.",
      code: code("english"),
      accent: "stone-light",
      teacherId: teacher.id,
    },
    update: {},
    select: { id: true },
  });

  for (const course of [biology, literature]) {
    await prisma.enrollment.upsert({
      where: { userId_courseId: { userId: teacher.id, courseId: course.id } },
      create: { userId: teacher.id, courseId: course.id, role: "TEACHER" },
      update: {},
    });

    for (const student of students) {
      await prisma.enrollment.upsert({
        where: { userId_courseId: { userId: student.id, courseId: course.id } },
        create: { userId: student.id, courseId: course.id, role: "STUDENT" },
        update: {},
      });
    }
  }

  // Topics
  const [cells, genetics] = await Promise.all([
    upsertTopic(biology.id, "Unit 1 — Cells", 0),
    upsertTopic(biology.id, "Unit 2 — Genetics", 1),
  ]);
  await upsertTopic(literature.id, "Poetry", 0);

  // Announcements with comments. Everything here is idempotent: running the
  // seed twice must not duplicate stream posts, classwork or notifications.
  const welcome = await upsertAnnouncement(
    biology.id,
    teacher.id,
    "Welcome to Biology 101. Read the syllabus in Classwork before Friday, and bring questions to our first session.",
    true,
  );

  await upsertAnnouncementComment(
    welcome.id,
    students[0].id,
    "Is the lab notebook the spiral one from the list?",
  );
  await upsertAnnouncementComment(
    welcome.id,
    teacher.id,
    "Any bound notebook works — spiral is fine.",
  );

  await upsertAnnouncement(
    biology.id,
    teacher.id,
    "Reminder: the cell structure diagram is due Friday at 11:59pm. Late work is accepted but marked late.",
  );

  // Classwork with a rubric
  const diagram = await upsertAssignment({
    courseId: biology.id,
    topicId: cells.id,
    title: "Cell structure diagram",
    description:
      "Label a eukaryotic cell and write two sentences on each organelle's function.",
    type: "ASSIGNMENT",
    maxPoints: 20,
    dueDate: daysFromNow(-2),
    rubric: [
      { title: "Accuracy of labels", points: 8 },
      { title: "Explanation quality", points: 8 },
      { title: "Presentation", points: 4 },
    ],
  });

  const quiz = await upsertAssignment({
    courseId: biology.id,
    topicId: genetics.id,
    title: "Mendelian genetics quiz",
    description: "Twenty questions on dominant and recessive inheritance.",
    type: "QUIZ",
    maxPoints: 50,
    dueDate: daysFromNow(5),
  });

  await upsertAssignment({
    courseId: biology.id,
    topicId: cells.id,
    title: "Course syllabus",
    description: "Everything we will cover this term, plus grading policy.",
    type: "MATERIAL",
    maxPoints: 0,
  });

  await upsertAssignment({
    courseId: biology.id,
    title: "What surprised you about osmosis?",
    description: "Answer in a short paragraph — there is no wrong answer.",
    type: "QUESTION",
    maxPoints: 5,
    dueDate: daysFromNow(9),
  });

  await upsertAssignment({
    courseId: literature.id,
    title: "Close reading — 'The Second Coming'",
    description: "Two pages on imagery and tone. Cite specific lines.",
    type: "ASSIGNMENT",
    maxPoints: 30,
    dueDate: daysFromNow(3),
  });

  // Submissions across every state, so each UI branch has data.
  const [amara, ben, chidi, dana] = students;

  const amaraSubmission = await prisma.submission.upsert({
    where: {
      assignmentId_studentId: { assignmentId: diagram.id, studentId: amara.id },
    },
    create: {
      assignmentId: diagram.id,
      studentId: amara.id,
      status: "RETURNED",
      grade: 18,
      feedback:
        "Excellent labelling and clear explanations. Tighten the mitochondria paragraph next time.",
      content: "Diagram attached, with organelle notes underneath each label.",
      submittedAt: daysFromNow(-3),
      gradedAt: daysFromNow(-1),
      returnedAt: daysFromNow(-1),
    },
    update: {
      status: "RETURNED",
      grade: 18,
      feedback:
        "Excellent labelling and clear explanations. Tighten the mitochondria paragraph next time.",
      content: "Diagram attached, with organelle notes underneath each label.",
      submittedAt: daysFromNow(-3),
      gradedAt: daysFromNow(-1),
      returnedAt: daysFromNow(-1),
    },
    select: { id: true },
  });

  await Promise.all(
    diagram.rubric.map((criterion, index) =>
      prisma.rubricScore.upsert({
        where: {
          submissionId_criterionId: {
            submissionId: amaraSubmission.id,
            criterionId: criterion.id,
          },
        },
        create: {
          submissionId: amaraSubmission.id,
          criterionId: criterion.id,
          points: [8, 7, 3][index] ?? criterion.points,
        },
        update: { points: [8, 7, 3][index] ?? criterion.points },
      }),
    ),
  );

  await upsertSubmissionComment(
    amaraSubmission.id,
    teacher.id,
    "Really strong work — see you at the study session.",
  );

  await prisma.submission.upsert({
    where: {
      assignmentId_studentId: { assignmentId: diagram.id, studentId: ben.id },
    },
    create: {
      assignmentId: diagram.id,
      studentId: ben.id,
      status: "GRADED",
      grade: 14,
      feedback: "Good diagram. The explanations need more detail.",
      content: "Here is my labelled diagram.",
      submittedAt: daysFromNow(-3),
      gradedAt: daysFromNow(-1),
    },
    update: {
      status: "GRADED",
      grade: 14,
      feedback: "Good diagram. The explanations need more detail.",
      content: "Here is my labelled diagram.",
      submittedAt: daysFromNow(-3),
      gradedAt: daysFromNow(-1),
    },
  });

  await prisma.submission.upsert({
    where: {
      assignmentId_studentId: { assignmentId: diagram.id, studentId: chidi.id },
    },
    create: {
      assignmentId: diagram.id,
      studentId: chidi.id,
      status: "LATE",
      content: "Sorry this is late — I was unwell on Friday.",
      submittedAt: daysFromNow(-1),
    },
    update: {
      status: "LATE",
      content: "Sorry this is late — I was unwell on Friday.",
      submittedAt: daysFromNow(-1),
    },
  });

  // Dana deliberately has no row: she should still appear in the grading view
  // as "Assigned", which is the missing-work case the roster join covers.

  await prisma.submission.upsert({
    where: {
      assignmentId_studentId: { assignmentId: quiz.id, studentId: amara.id },
    },
    create: {
      assignmentId: quiz.id,
      studentId: amara.id,
      status: "SUBMITTED",
      content: "Completed all twenty questions.",
      submittedAt: new Date(),
    },
    update: {
      status: "SUBMITTED",
      content: "Completed all twenty questions.",
      submittedAt: new Date(),
    },
  });

  // --- School records: terms, gradebook, register, timetable --------------
  //
  // Dates are fixed rather than relative to today so the seed stays idempotent:
  // a second run must not create a second copy of every grade column just
  // because the date moved.
  const termOne = await upsertTerm({
    academicYear: "2026-2027",
    name: "Term 1",
    startsOn: atUtc("2026-09-01"),
    endsOn: atUtc("2026-12-11"),
    isActive: true,
  });

  await upsertTerm({
    academicYear: "2026-2027",
    name: "Term 2",
    startsOn: atUtc("2027-01-12"),
    endsOn: atUtc("2027-04-02"),
    isActive: false,
  });

  const coursework = await upsertCategory({
    courseId: biology.id,
    termId: termOne.id,
    name: "Coursework",
    weight: 40,
  });
  const tests = await upsertCategory({
    courseId: biology.id,
    termId: termOne.id,
    name: "Tests",
    weight: 40,
  });
  const participation = await upsertCategory({
    courseId: biology.id,
    termId: termOne.id,
    name: "Participation",
    weight: 20,
  });

  // Linked to the classwork item so grading that submission in the app and
  // reading the gradebook stay in agreement.
  const diagramItem = await upsertGradeItem({
    courseId: biology.id,
    termId: termOne.id,
    categoryId: coursework.id,
    title: "Cell structure diagram",
    maximum: 20,
    assessedOn: atUtc("2026-11-13"),
    assignmentId: diagram.id,
  });
  const unitTest = await upsertGradeItem({
    courseId: biology.id,
    termId: termOne.id,
    categoryId: tests.id,
    title: "Unit 1 test — cells",
    maximum: 100,
    assessedOn: atUtc("2026-10-16"),
  });
  const participationItem = await upsertGradeItem({
    courseId: biology.id,
    termId: termOne.id,
    categoryId: participation.id,
    title: "Term 1 participation",
    maximum: 10,
    assessedOn: atUtc("2026-11-20"),
  });

  await Promise.all([
    setScore(diagramItem.id, amara.id, 18),
    setScore(diagramItem.id, ben.id, 14),
    // Chidi's diagram is late and ungraded, so his column stays "Not marked".
    setScore(unitTest.id, amara.id, 82),
    setScore(unitTest.id, ben.id, 67),
    setScore(unitTest.id, chidi.id, 74),
    setScore(participationItem.id, amara.id, 9),
    setScore(participationItem.id, ben.id, 7),
    setScore(participationItem.id, chidi.id, 8),
    setScore(participationItem.id, dana.id, 6),
  ]);

  // A week of registers. A course that already has any session is left alone,
  // so a teacher's real register is never overwritten by demo rows.
  const hasRegister = await prisma.attendanceSession.findFirst({
    where: { courseId: biology.id },
    select: { id: true },
  });

  if (!hasRegister) {
    const week: Array<{
      date: string;
      topic: string;
      statuses: Array<
        [
          string,
          "PRESENT" | "LATE" | "ABSENT" | "EXCUSED" | "LEFT_EARLY",
        ]
      >;
    }> = [
      {
        date: "2026-11-09",
        topic: "Osmosis in plant cells",
        statuses: [
          [amara.id, "PRESENT"],
          [ben.id, "PRESENT"],
          [chidi.id, "EXCUSED"],
          [dana.id, "ABSENT"],
        ],
      },
      {
        date: "2026-11-10",
        topic: "Mitochondria and energy",
        statuses: [
          [amara.id, "PRESENT"],
          [ben.id, "LATE"],
          [chidi.id, "PRESENT"],
          [dana.id, "ABSENT"],
        ],
      },
      {
        date: "2026-11-11",
        topic: "Cell division",
        statuses: [
          [amara.id, "PRESENT"],
          [ben.id, "PRESENT"],
          [chidi.id, "PRESENT"],
          [dana.id, "PRESENT"],
        ],
      },
      {
        date: "2026-11-12",
        topic: "Genetics problem set",
        statuses: [
          [amara.id, "PRESENT"],
          [ben.id, "ABSENT"],
          [chidi.id, "PRESENT"],
          [dana.id, "PRESENT"],
        ],
      },
      {
        date: "2026-11-13",
        topic: "Lab: observing plasmolysis",
        statuses: [
          [amara.id, "PRESENT"],
          [ben.id, "PRESENT"],
          [chidi.id, "LEFT_EARLY"],
          [dana.id, "PRESENT"],
        ],
      },
    ];

    for (const day of week) {
      const session = await prisma.attendanceSession.create({
        data: {
          courseId: biology.id,
          date: atUtc(day.date),
          topic: day.topic,
          markedById: teacher.id,
        },
        select: { id: true },
      });

      await prisma.attendanceRecord.createMany({
        data: day.statuses.map(([studentId, status]) => ({
          sessionId: session.id,
          studentId,
          status,
          minutesLate: status === "LATE" ? 10 : null,
        })),
      });
    }
  }

  // One decided request (which explains the EXCUSED day) and one still waiting.
  await upsertAbsenceRequest({
    courseId: biology.id,
    studentId: chidi.id,
    fromDate: atUtc("2026-11-09"),
    toDate: atUtc("2026-11-09"),
    reason: "Hospital appointment in the morning.",
    status: "APPROVED",
    decidedById: teacher.id,
  });

  await upsertAbsenceRequest({
    courseId: biology.id,
    studentId: dana.id,
    fromDate: atUtc("2026-11-23"),
    toDate: atUtc("2026-11-24"),
    reason: "Family bereavement — travelling upcountry.",
    status: "PENDING",
  });

  // Timetables, only when a course has none yet.
  await Promise.all([
    addSchedule(biology.id, [
      { weekday: 0, startsAt: "08:00", endsAt: "09:00", room: "B-204" },
      { weekday: 2, startsAt: "08:00", endsAt: "09:00", room: "B-204" },
      { weekday: 4, startsAt: "11:00", endsAt: "12:00", room: "Lab 1" },
    ]),
    addSchedule(literature.id, [
      { weekday: 1, startsAt: "10:00", endsAt: "11:00", room: "A-112" },
      { weekday: 3, startsAt: "10:00", endsAt: "11:00", room: "A-112" },
    ]),
  ]);

  await upsertReportComment({
    courseId: biology.id,
    termId: termOne.id,
    studentId: amara.id,
    authorId: teacher.id,
    body: "Consistently strong lab work and a good eye for detail. Keep pushing on written explanations.",
  });

  await Promise.all(
    students.map((student) =>
      upsertNotification({
        userId: student.id,
        courseId: biology.id,
        type: "ASSIGNMENT_CREATED",
        title: "New assignment: Mendelian genetics quiz",
        body: "Due in five days",
        linkPath: `/course/${biology.id}/classwork/${quiz.id}`,
      }),
    ),
  );

  console.log(`
Seed complete.

  Classes
    Biology 101       code ${code("biology")}
    World Literature  code ${code("english")}

  Sign in (AUTH_DEV_MODE=true — no password needed)
    admin@school.edu     Admin
    teacher@school.edu   Teacher
    amara@school.edu     Student (work returned)
    ben@school.edu       Student (work graded)
    chidi@school.edu     Student (turned in late)
    dana@school.edu      Student (nothing turned in)
`);
}

async function upsertTopic(courseId: string, name: string, sortOrder: number) {
  const existing = await prisma.topic.findFirst({
    where: { courseId, name },
    select: { id: true },
  });
  if (existing) return existing;

  return prisma.topic.create({
    data: { courseId, name, sortOrder },
    select: { id: true },
  });
}

async function upsertAnnouncement(
  courseId: string,
  authorId: string,
  content: string,
  pinned = false,
) {
  const existing = await prisma.announcement.findFirst({
    where: { courseId, authorId, content },
    select: { id: true, pinned: true },
  });
  if (existing) {
    if (pinned && !existing.pinned) {
      await prisma.announcement.update({
        where: { id: existing.id },
        data: { pinned: true },
      });
    }
    return existing;
  }

  return prisma.announcement.create({
    data: { courseId, authorId, content, pinned },
    select: { id: true, pinned: true },
  });
}

async function upsertAnnouncementComment(
  announcementId: string,
  authorId: string,
  content: string,
) {
  const existing = await prisma.comment.findFirst({
    where: { announcementId, authorId, content },
    select: { id: true },
  });
  if (existing) return existing;

  return prisma.comment.create({
    data: { announcementId, authorId, content },
    select: { id: true },
  });
}

async function upsertSubmissionComment(
  submissionId: string,
  authorId: string,
  content: string,
) {
  const existing = await prisma.comment.findFirst({
    where: { submissionId, authorId, content },
    select: { id: true },
  });
  if (existing) return existing;

  return prisma.comment.create({
    data: { submissionId, authorId, content, isPrivate: true },
    select: { id: true },
  });
}

type AssignmentSeed = {
  courseId: string;
  topicId?: string;
  title: string;
  description?: string;
  type: AssignmentType;
  maxPoints: number;
  dueDate?: Date;
  rubric?: { title: string; points: number }[];
};

async function upsertAssignment(input: AssignmentSeed) {
  const existing = await prisma.assignment.findFirst({
    where: { courseId: input.courseId, title: input.title },
    select: {
      id: true,
      rubric: { select: { id: true, points: true } },
    },
  });
  if (existing) return existing;

  return prisma.assignment.create({
    data: {
      courseId: input.courseId,
      topicId: input.topicId ?? null,
      title: input.title,
      description: input.description ?? null,
      type: input.type,
      maxPoints: input.maxPoints,
      dueDate: input.dueDate ?? null,
      rubric: input.rubric
        ? {
            create: input.rubric.map((criterion, index) => ({
              title: criterion.title,
              points: criterion.points,
              sortOrder: index,
            })),
          }
        : undefined,
    },
    select: {
      id: true,
      rubric: { select: { id: true, points: true } },
    },
  });
}

async function upsertNotification(input: {
  userId: string;
  courseId: string;
  type: "ASSIGNMENT_CREATED";
  title: string;
  body: string;
  linkPath: string;
}) {
  const existing = await prisma.notification.findFirst({
    where: {
      userId: input.userId,
      courseId: input.courseId,
      type: input.type,
      title: input.title,
    },
    select: { id: true },
  });
  if (existing) return existing;

  return prisma.notification.create({
    data: input,
    select: { id: true },
  });
}

/** A date-only value at UTC midnight, the convention every register uses. */
function atUtc(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

async function upsertTerm(input: {
  academicYear: string;
  name: string;
  startsOn: Date;
  endsOn: Date;
  isActive: boolean;
}) {
  return prisma.term.upsert({
    where: {
      academicYear_name: {
        academicYear: input.academicYear,
        name: input.name,
      },
    },
    create: input,
    update: {
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      // Never deactivate another term by seeding; only an explicit seed row
      // may claim the active flag.
      ...(input.isActive ? { isActive: true } : {}),
    },
    select: { id: true },
  });
}

async function upsertCategory(input: {
  courseId: string;
  termId: string;
  name: string;
  weight: number;
}) {
  return prisma.gradeCategory.upsert({
    where: {
      courseId_termId_name: {
        courseId: input.courseId,
        termId: input.termId,
        name: input.name,
      },
    },
    create: input,
    update: { weight: input.weight },
    select: { id: true },
  });
}

async function upsertGradeItem(input: {
  courseId: string;
  termId: string;
  categoryId: string;
  title: string;
  maximum: number;
  assessedOn: Date;
  assignmentId?: string;
}) {
  return prisma.gradeItem.upsert({
    where: {
      courseId_termId_title_assessedOn: {
        courseId: input.courseId,
        termId: input.termId,
        title: input.title,
        assessedOn: input.assessedOn,
      },
    },
    create: {
      courseId: input.courseId,
      termId: input.termId,
      categoryId: input.categoryId,
      title: input.title,
      maximum: input.maximum,
      assessedOn: input.assessedOn,
      assignmentId: input.assignmentId ?? null,
    },
    update: {
      categoryId: input.categoryId,
      maximum: input.maximum,
      assignmentId: input.assignmentId ?? null,
    },
    select: { id: true },
  });
}

async function setScore(gradeItemId: string, studentId: string, score: number) {
  return prisma.gradeScore.upsert({
    where: { gradeItemId_studentId: { gradeItemId, studentId } },
    create: { gradeItemId, studentId, score },
    update: { score },
  });
}

async function upsertAbsenceRequest(input: {
  courseId: string;
  studentId: string;
  fromDate: Date;
  toDate: Date;
  reason: string;
  status: "PENDING" | "APPROVED" | "DECLINED";
  decidedById?: string;
}) {
  const existing = await prisma.attendanceRequest.findFirst({
    where: {
      courseId: input.courseId,
      studentId: input.studentId,
      fromDate: input.fromDate,
      toDate: input.toDate,
    },
    select: { id: true },
  });
  if (existing) return existing;

  return prisma.attendanceRequest.create({
    data: {
      courseId: input.courseId,
      studentId: input.studentId,
      fromDate: input.fromDate,
      toDate: input.toDate,
      reason: input.reason,
      status: input.status,
      decidedById: input.decidedById ?? null,
      decidedAt: input.decidedById ? new Date() : null,
      decisionNote: input.status === "APPROVED" ? "Approved — take care." : null,
    },
    select: { id: true },
  });
}

/** Leaves a course's timetable alone once it has any slot. */
async function addSchedule(
  courseId: string,
  slots: Array<{
    weekday: number;
    startsAt: string;
    endsAt: string;
    room?: string;
  }>,
) {
  const existing = await prisma.courseSchedule.findFirst({
    where: { courseId },
    select: { id: true },
  });
  if (existing) return;

  await prisma.courseSchedule.createMany({
    data: slots.map((slot) => ({
      courseId,
      weekday: slot.weekday,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      room: slot.room ?? null,
    })),
  });
}

async function upsertReportComment(input: {
  courseId: string;
  termId: string;
  studentId: string;
  authorId: string;
  body: string;
}) {
  return prisma.reportComment.upsert({
    where: {
      courseId_termId_studentId: {
        courseId: input.courseId,
        termId: input.termId,
        studentId: input.studentId,
      },
    },
    create: input,
    update: { body: input.body, authorId: input.authorId },
    select: { id: true },
  });
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
