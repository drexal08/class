import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Demo data.
 *
 * Creates one teacher, four students and two classes, with submissions in every
 * SubmissionState so the gradebook, to-do list and grading view all have
 * something realistic to render.
 *
 *   npm run db:seed
 */
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error(
    "\n  DATABASE_URL is not set. Copy .env.example to .env and add a PostgreSQL connection string.\n  See SETUP.md for a three-step Supabase walkthrough.\n",
  );
  process.exit(1);
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
    { email: "admin@school.edu", displayName: "Alex Mensah", role: "ADMIN" as const },
    { email: "teacher@school.edu", displayName: "Ada Okonkwo", role: "TEACHER" as const },
    { email: "amara@school.edu", displayName: "Amara Diallo", role: "STUDENT" as const },
    { email: "ben@school.edu", displayName: "Ben Carter", role: "STUDENT" as const },
    { email: "chidi@school.edu", displayName: "Chidi Eze", role: "STUDENT" as const },
    { email: "dana@school.edu", displayName: "Dana Whitfield", role: "STUDENT" as const },
  ];

  const users = await Promise.all(
    people.map((person) =>
      prisma.user.upsert({
        where: { email: person.email },
        create: { id: devId(person.email), ...person },
        update: { displayName: person.displayName, role: person.role },
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
      accent: "teal",
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
      accent: "indigo",
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

  // Announcements with comments
  const welcome = await prisma.announcement.create({
    data: {
      courseId: biology.id,
      authorId: teacher.id,
      content:
        "Welcome to Biology 101. Read the syllabus in Classwork before Friday, and bring questions to our first session.",
      pinned: true,
    },
    select: { id: true },
  });

  await prisma.comment.createMany({
    data: [
      {
        announcementId: welcome.id,
        authorId: students[0].id,
        content: "Is the lab notebook the spiral one from the list?",
      },
      {
        announcementId: welcome.id,
        authorId: teacher.id,
        content: "Any bound notebook works — spiral is fine.",
      },
    ],
  });

  await prisma.announcement.create({
    data: {
      courseId: biology.id,
      authorId: teacher.id,
      content:
        "Reminder: the cell structure diagram is due Friday at 11:59pm. Late work is accepted but marked late.",
    },
  });

  // Classwork with a rubric
  const diagram = await prisma.assignment.create({
    data: {
      courseId: biology.id,
      topicId: cells.id,
      title: "Cell structure diagram",
      description:
        "Label a eukaryotic cell and write two sentences on each organelle's function.",
      type: "ASSIGNMENT",
      maxPoints: 20,
      dueDate: daysFromNow(-2),
      rubric: {
        create: [
          { title: "Accuracy of labels", points: 8, sortOrder: 0 },
          { title: "Explanation quality", points: 8, sortOrder: 1 },
          { title: "Presentation", points: 4, sortOrder: 2 },
        ],
      },
    },
    select: { id: true, rubric: { select: { id: true, points: true } } },
  });

  const quiz = await prisma.assignment.create({
    data: {
      courseId: biology.id,
      topicId: genetics.id,
      title: "Mendelian genetics quiz",
      description: "Twenty questions on dominant and recessive inheritance.",
      type: "QUIZ",
      maxPoints: 50,
      dueDate: daysFromNow(5),
    },
    select: { id: true },
  });

  await prisma.assignment.create({
    data: {
      courseId: biology.id,
      topicId: cells.id,
      title: "Course syllabus",
      description: "Everything we will cover this term, plus grading policy.",
      type: "MATERIAL",
      maxPoints: 0,
    },
  });

  await prisma.assignment.create({
    data: {
      courseId: biology.id,
      title: "What surprised you about osmosis?",
      description: "Answer in a short paragraph — there is no wrong answer.",
      type: "QUESTION",
      maxPoints: 5,
      dueDate: daysFromNow(9),
    },
  });

  await prisma.assignment.create({
    data: {
      courseId: literature.id,
      title: "Close reading — 'The Second Coming'",
      description: "Two pages on imagery and tone. Cite specific lines.",
      type: "ASSIGNMENT",
      maxPoints: 30,
      dueDate: daysFromNow(3),
    },
  });

  // Submissions across every state, so each UI branch has data.
  const [amara, ben, chidi, dana] = students;

  await prisma.submission.create({
    data: {
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
      rubricScores: {
        create: diagram.rubric.map((criterion, index) => ({
          criterionId: criterion.id,
          points: [8, 7, 3][index] ?? criterion.points,
        })),
      },
      comments: {
        create: {
          authorId: teacher.id,
          content: "Really strong work — see you at the study session.",
          isPrivate: true,
        },
      },
    },
  });

  await prisma.submission.create({
    data: {
      assignmentId: diagram.id,
      studentId: ben.id,
      status: "GRADED",
      grade: 14,
      feedback: "Good diagram. The explanations need more detail.",
      content: "Here is my labelled diagram.",
      submittedAt: daysFromNow(-3),
      gradedAt: daysFromNow(-1),
    },
  });

  await prisma.submission.create({
    data: {
      assignmentId: diagram.id,
      studentId: chidi.id,
      status: "LATE",
      content: "Sorry this is late — I was unwell on Friday.",
      submittedAt: daysFromNow(-1),
    },
  });

  // Dana deliberately has no row: she should still appear in the grading view
  // as "Assigned", which is the missing-work case the roster join covers.

  await prisma.submission.create({
    data: {
      assignmentId: quiz.id,
      studentId: amara.id,
      status: "SUBMITTED",
      content: "Completed all twenty questions.",
      submittedAt: new Date(),
    },
  });

  await prisma.notification.createMany({
    data: students.map((student) => ({
      userId: student.id,
      courseId: biology.id,
      type: "ASSIGNMENT_CREATED" as const,
      title: "New assignment: Mendelian genetics quiz",
      body: "Due in five days",
      linkPath: `/course/${biology.id}/classwork/${quiz.id}`,
    })),
  });

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

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
