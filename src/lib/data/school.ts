import "server-only";

import {
  requireCourseAccess,
  requireCourseTeacher,
  requireUser,
} from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import {
  attendanceRate,
  bucketStatusesByDay,
  summariseAttendance,
  toDateKey,
  type AttendanceStatusValue,
} from "@/lib/school/attendance";
import {
  computeClassAverages,
  computeTerm,
  meanOfAverages,
  type CategoryWeight,
  type GradeEntry,
  type TermResult,
} from "@/lib/school/grading";
import {
  DEFAULT_SCHOOL_TIMEZONE,
  slotsForToday,
  todayKey,
  todayWeekday,
  weekdayOf,
} from "@/lib/school/schedule";

/**
 * Server-only reads for the school-records modules.
 *
 * Every export resolves the caller's relationship to the course *before*
 * reading, and every query is scoped by `courseId` (or by the caller's own
 * `studentId`), so a page can never widen its own access.
 */

export function schoolTimeZone(): string {
  return process.env.SCHOOL_TIMEZONE?.trim() || DEFAULT_SCHOOL_TIMEZONE;
}

function toNumber(
  value: { toNumber(): number } | number | string | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return value.toNumber();
}

const studentSelect = {
  id: true,
  displayName: true,
  email: true,
  avatarUrl: true,
} as const;

// ---------------------------------------------------------------------------
// Terms
// ---------------------------------------------------------------------------

export async function listTerms() {
  await requireUser();
  return prisma.term.findMany({
    orderBy: [{ startsOn: "desc" }, { name: "asc" }],
    select: {
      id: true,
      academicYear: true,
      name: true,
      startsOn: true,
      endsOn: true,
      isActive: true,
    },
  });
}

export type TermSummary = Awaited<ReturnType<typeof listTerms>>[number];

export function pickTerm(
  terms: TermSummary[],
  termId?: string,
): TermSummary | null {
  if (termId) {
    const requested = terms.find((term) => term.id === termId);
    if (requested) return requested;
  }
  return terms.find((term) => term.isActive) ?? terms[0] ?? null;
}

/** The term new entries should default to. */
export async function getActiveTerm() {
  const terms = await listTerms();
  return pickTerm(terms);
}

// ---------------------------------------------------------------------------
// Gradebook
// ---------------------------------------------------------------------------

export type GradebookItem = {
  id: string;
  title: string;
  categoryId: string;
  maximum: number;
  assessedOn: Date;
  assignmentId: string | null;
};

export type GradebookScore = {
  gradeItemId: string;
  studentId: string;
  score: number | null;
};

export async function getCourseGradebook(courseId: string, termId?: string) {
  await requireCourseTeacher(courseId);

  const [terms, roster] = await Promise.all([
    listTerms(),
    prisma.enrollment.findMany({
      where: { courseId, role: "STUDENT" },
      orderBy: { user: { displayName: "asc" } },
      select: { user: { select: studentSelect } },
    }),
  ]);

  const term = pickTerm(terms, termId);
  const students = roster.map((entry) => entry.user);

  if (!term) {
    return {
      terms,
      term: null,
      categories: [] as Array<{ id: string; name: string; weight: number }>,
      items: [] as GradebookItem[],
      students,
      scores: [] as GradebookScore[],
      results: new Map<string, TermResult>(),
    };
  }

  const [categories, items] = await Promise.all([
    prisma.gradeCategory.findMany({
      where: { courseId, termId: term.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, weight: true },
    }),
    prisma.gradeItem.findMany({
      where: { courseId, termId: term.id },
      orderBy: [{ assessedOn: "asc" }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        categoryId: true,
        maximum: true,
        assessedOn: true,
        assignmentId: true,
        scores: { select: { studentId: true, score: true } },
      },
    }),
  ]);

  const gradeItems: GradebookItem[] = items.map((item) => ({
    id: item.id,
    title: item.title,
    categoryId: item.categoryId,
    maximum: toNumber(item.maximum) ?? 0,
    assessedOn: item.assessedOn,
    assignmentId: item.assignmentId,
  }));

  const scores: GradebookScore[] = items.flatMap((item) =>
    item.scores.map((score) => ({
      gradeItemId: item.id,
      studentId: score.studentId,
      score: toNumber(score.score),
    })),
  );

  const weights: CategoryWeight[] = categories.map((category) => ({
    id: category.id,
    weight: category.weight,
  }));

  const entries: Array<GradeEntry & { studentId: string }> = gradesToEntries(
    gradeItems,
    scores,
  );

  return {
    terms,
    term,
    // Pages need the names; the grading engine only needs id + weight.
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      weight: category.weight,
    })),
    items: gradeItems,
    students,
    scores,
    results: computeClassAverages(
      students.map((student) => student.id),
      entries,
      weights,
    ),
  };
}

function gradesToEntries(
  items: GradebookItem[],
  scores: GradebookScore[],
): Array<GradeEntry & { studentId: string }> {
  const itemsById = new Map(items.map((item) => [item.id, item]));

  return scores.flatMap((score) => {
    const item = itemsById.get(score.gradeItemId);
    if (!item) return [];
    return [
      {
        studentId: score.studentId,
        categoryId: item.categoryId,
        maximum: item.maximum,
        score: score.score,
      },
    ];
  });
}

/**
 * One student's marked items for a course. Teachers may call this to preview
 * exactly what a student sees; the `studentId` is always the caller's own
 * unless a teacher is inspecting.
 */
export async function getStudentCourseMarks(
  courseId: string,
  termId?: string,
  studentId?: string,
) {
  const context = await requireCourseAccess(courseId);
  const targetId = studentId && context.isTeacher ? studentId : context.user.id;

  const [terms, categories, items] = await Promise.all([
    listTerms(),
    prisma.gradeCategory.findMany({
      where: { courseId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, weight: true, termId: true },
    }),
    prisma.gradeItem.findMany({
      where: { courseId },
      orderBy: [{ assessedOn: "asc" }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        categoryId: true,
        termId: true,
        maximum: true,
        assessedOn: true,
        scores: { where: { studentId: targetId }, select: { score: true } },
      },
    }),
  ]);

  const term = pickTerm(terms, termId);
  if (!term) return { terms, term: null, rows: [], result: null };

  const termItems = items.filter((item) => item.termId === term.id);
  const termWeights = categories
    .filter((category) => category.termId === term.id)
    .map((category) => ({ id: category.id, weight: category.weight }));

  const categoryNames = new Map(
    categories.map((category) => [category.id, category.name]),
  );

  const entries: GradeEntry[] = termItems.map((item) => ({
    categoryId: item.categoryId,
    maximum: toNumber(item.maximum) ?? 0,
    score: toNumber(item.scores[0]?.score ?? null),
  }));

  const rows = termItems.map((item) => {
    const maximum = toNumber(item.maximum) ?? 0;
    const score = toNumber(item.scores[0]?.score ?? null);
    return {
      id: item.id,
      title: item.title,
      categoryId: item.categoryId,
      categoryName: categoryNames.get(item.categoryId) ?? "Uncategorised",
      maximum,
      score,
      assessedOn: item.assessedOn,
      percentage:
        score === null || maximum <= 0
          ? null
          : Math.round((score / maximum) * 1000) / 10,
    };
  });

  return {
    terms,
    term,
    rows,
    result: computeTerm(entries, termWeights),
  };
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

export type RegisterRow = {
  student: {
    id: string;
    displayName: string | null;
    email: string;
    avatarUrl: string | null;
  };
  status: AttendanceStatusValue | null;
  note: string | null;
  minutesLate: number | null;
};

export async function getAttendanceRegister(
  courseId: string,
  dateKey: string,
  period?: string,
) {
  await requireCourseTeacher(courseId);

  const date = new Date(`${dateKey}T00:00:00.000Z`);

  const [roster, session, requests] = await Promise.all([
    prisma.enrollment.findMany({
      where: { courseId, role: "STUDENT" },
      orderBy: { user: { displayName: "asc" } },
      select: { user: { select: studentSelect } },
    }),
    prisma.attendanceSession.findFirst({
      where: { courseId, date, period: period ?? null },
      select: {
        id: true,
        topic: true,
        markedAt: true,
        records: {
          select: { studentId: true, status: true, note: true, minutesLate: true },
        },
      },
    }),
    prisma.attendanceRequest.findMany({
      where: { courseId, status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        fromDate: true,
        toDate: true,
        reason: true,
        createdAt: true,
        student: { select: studentSelect },
      },
    }),
  ]);

  const byStudent = new Map(
    (session?.records ?? []).map((record) => [record.studentId, record]),
  );

  const rows: RegisterRow[] = roster.map(({ user }) => {
    const record = byStudent.get(user.id);
    return {
      student: user,
      status: (record?.status as AttendanceStatusValue | undefined) ?? null,
      note: record?.note ?? null,
      minutesLate: record?.minutesLate ?? null,
    };
  });

  return {
    date,
    dateKey,
    session: session
      ? { id: session.id, topic: session.topic, markedAt: session.markedAt }
      : null,
    rows,
    requests,
  };
}

/** Statuses for every student in a course between two dates. */
export async function getCourseAttendanceByStudent(
  courseId: string,
  from: Date,
  to: Date,
): Promise<Map<string, AttendanceStatusValue[]>> {
  const sessions = await prisma.attendanceSession.findMany({
    where: { courseId, date: { gte: from, lte: to } },
    select: { records: { select: { studentId: true, status: true } } },
  });

  const byStudent = new Map<string, AttendanceStatusValue[]>();
  for (const session of sessions) {
    for (const record of session.records) {
      const bucket = byStudent.get(record.studentId);
      if (bucket) bucket.push(record.status as AttendanceStatusValue);
      else byStudent.set(record.studentId, [record.status as AttendanceStatusValue]);
    }
  }

  return byStudent;
}

export async function getStudentAttendanceMonth(year: number, month: number) {
  const user = await requireUser();

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: user.id },
    select: { course: { select: { id: true, name: true, accent: true } } },
  });

  const courseIds = enrollments.map((entry) => entry.course.id);
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  const records = courseIds.length
    ? await prisma.attendanceRecord.findMany({
        where: {
          studentId: user.id,
          session: { courseId: { in: courseIds }, date: { gte: from, lte: to } },
        },
        select: {
          status: true,
          minutesLate: true,
          note: true,
          session: {
            select: {
              date: true,
              period: true,
              course: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { session: { date: "asc" } },
      })
    : [];

  const statuses = records.map(
    (record) => record.status as AttendanceStatusValue,
  );

  return {
    year,
    month,
    courses: enrollments.map((entry) => entry.course),
    records,
    byDay: bucketStatusesByDay(
      records.map((record) => ({
        date: record.session.date,
        status: record.status as AttendanceStatusValue,
      })),
    ),
    counts: summariseAttendance(statuses),
    rate: attendanceRate(statuses),
  };
}

export async function getStudentAbsenceRequests() {
  const user = await requireUser();

  return prisma.attendanceRequest.findMany({
    where: { studentId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      fromDate: true,
      toDate: true,
      reason: true,
      status: true,
      decisionNote: true,
      createdAt: true,
      course: { select: { id: true, name: true } },
    },
  });
}

export async function getCourseAttendanceRequests(courseId: string) {
  await requireCourseTeacher(courseId);

  return prisma.attendanceRequest.findMany({
    where: { courseId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 50,
    select: {
      id: true,
      fromDate: true,
      toDate: true,
      reason: true,
      status: true,
      decisionNote: true,
      createdAt: true,
      student: { select: studentSelect },
      decidedBy: { select: { id: true, displayName: true } },
    },
  });
}

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

export async function getCourseSchedule(courseId: string) {
  await requireCourseAccess(courseId);

  const slots = await prisma.courseSchedule.findMany({
    where: { courseId },
    orderBy: [{ weekday: "asc" }, { startsAt: "asc" }],
    select: {
      id: true,
      weekday: true,
      startsAt: true,
      endsAt: true,
      room: true,
    },
  });

  return slots;
}

/** Every slot across the caller's classes, for the calendar and dashboard. */
export async function getUserSchedule() {
  const user = await requireUser();

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: user.id, course: { archived: false } },
    select: {
      course: { select: { id: true, name: true, section: true, accent: true } },
    },
  });

  const courses = enrollments.map((entry) => entry.course);
  const courseIds = courses.map((course) => course.id);

  if (courseIds.length === 0) return { courses, slots: [] };

  const slots = await prisma.courseSchedule.findMany({
    where: { courseId: { in: courseIds } },
    orderBy: [{ weekday: "asc" }, { startsAt: "asc" }],
    select: {
      id: true,
      courseId: true,
      weekday: true,
      startsAt: true,
      endsAt: true,
      room: true,
      course: { select: { name: true, accent: true } },
    },
  });

  return { courses, slots };
}

export async function getTodaySchedule(now = new Date()) {
  const { slots } = await getUserSchedule();
  // The timezone conversion happens in the pure module so the dashboard and
  // the calendar agree about which day it is.
  return slotsForToday(slots, now, schoolTimeZone());
}

// ---------------------------------------------------------------------------
// Report cards
// ---------------------------------------------------------------------------

export type CourseReportRow = {
  student: {
    id: string;
    displayName: string | null;
    email: string;
    avatarUrl: string | null;
  };
  result: TermResult;
  attendance: ReturnType<typeof summariseAttendance>;
  attendanceRate: number | null;
  comment: string | null;
};

export async function getCourseReports(courseId: string, termId?: string) {
  await requireCourseTeacher(courseId);

  const [terms, roster] = await Promise.all([
    listTerms(),
    prisma.enrollment.findMany({
      where: { courseId, role: "STUDENT" },
      orderBy: { user: { displayName: "asc" } },
      select: { user: { select: studentSelect } },
    }),
  ]);

  const term = pickTerm(terms, termId);
  if (!term) {
    return { terms, term: null, rows: [] as CourseReportRow[], classAverage: null };
  }

  const [categories, items, attendance, comments] = await Promise.all([
    prisma.gradeCategory.findMany({
      where: { courseId, termId: term.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, weight: true },
    }),
    prisma.gradeItem.findMany({
      where: { courseId, termId: term.id },
      orderBy: [{ assessedOn: "asc" }, { title: "asc" }],
      select: {
        id: true,
        categoryId: true,
        maximum: true,
        scores: { select: { studentId: true, score: true } },
      },
    }),
    getCourseAttendanceByStudent(courseId, term.startsOn, term.endsOn),
    prisma.reportComment.findMany({
      where: { courseId, termId: term.id },
      select: { studentId: true, body: true },
    }),
  ]);

  const weights: CategoryWeight[] = categories.map((category) => ({
    id: category.id,
    weight: category.weight,
  }));

  const entries: Array<GradeEntry & { studentId: string }> = items.flatMap(
    (item) =>
      item.scores.map((score) => ({
        studentId: score.studentId,
        categoryId: item.categoryId,
        maximum: toNumber(item.maximum) ?? 0,
        score: toNumber(score.score),
      })),
  );

  const results = computeClassAverages(
    roster.map((entry) => entry.user.id),
    entries,
    weights,
  );

  const commentByStudent = new Map(
    comments.map((comment) => [comment.studentId, comment.body]),
  );

  const rows: CourseReportRow[] = roster.map(({ user }) => {
    const statuses = attendance.get(user.id) ?? [];
    return {
      student: user,
      result:
        results.get(user.id) ?? {
          average: null,
          categories: [],
          markedItems: 0,
          totalItems: 0,
        },
      attendance: summariseAttendance(statuses),
      attendanceRate: attendanceRate(statuses),
      comment: commentByStudent.get(user.id) ?? null,
    };
  });

  return {
    terms,
    term,
    rows,
    classAverage: meanOfAverages(rows.map((row) => row.result.average)),
  };
}

export type ReportCardCourse = {
  courseId: string;
  courseName: string;
  accent: string;
  result: TermResult;
  attendance: ReturnType<typeof summariseAttendance>;
  attendanceRate: number | null;
  comment: string | null;
  rows: Array<{
    id: string;
    title: string;
    categoryName: string;
    maximum: number;
    score: number | null;
    assessedOn: Date;
  }>;
};

/** A student's own report card for one term. Teachers cannot call this. */
export async function getStudentReportCard(termId: string) {
  const user = await requireUser();

  const term = await prisma.term.findUnique({
    where: { id: termId },
    select: {
      id: true,
      name: true,
      academicYear: true,
      startsOn: true,
      endsOn: true,
    },
  });
  if (!term) return null;

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: user.id, course: { archived: false } },
    select: {
      course: { select: { id: true, name: true, accent: true } },
    },
  });

  const courses = enrollments.map((entry) => entry.course);
  const courseIds = courses.map((course) => course.id);
  if (courseIds.length === 0) {
    return { term, student: user, courses: [] as ReportCardCourse[] };
  }

  const [categories, items, attendance, comments] = await Promise.all([
    prisma.gradeCategory.findMany({
      where: { courseId: { in: courseIds }, termId },
      orderBy: { name: "asc" },
      select: { id: true, courseId: true, name: true, weight: true },
    }),
    prisma.gradeItem.findMany({
      where: { courseId: { in: courseIds }, termId },
      orderBy: [{ assessedOn: "asc" }, { title: "asc" }],
      select: {
        id: true,
        courseId: true,
        title: true,
        categoryId: true,
        maximum: true,
        assessedOn: true,
        scores: { where: { studentId: user.id }, select: { score: true } },
      },
    }),
    prisma.attendanceSession.findMany({
      where: {
        courseId: { in: courseIds },
        date: { gte: term.startsOn, lte: term.endsOn },
      },
      select: {
        courseId: true,
        records: {
          where: { studentId: user.id },
          select: { status: true },
        },
      },
    }),
    prisma.reportComment.findMany({
      where: { studentId: user.id, termId },
      select: { courseId: true, body: true },
    }),
  ]);

  const categoryName = new Map(
    categories.map((category) => [category.id, category.name]),
  );
  const commentByCourse = new Map(
    comments.map((comment) => [comment.courseId, comment.body]),
  );

  const attendanceByCourse = new Map<string, AttendanceStatusValue[]>();
  for (const session of attendance) {
    for (const record of session.records) {
      const bucket = attendanceByCourse.get(session.courseId);
      const status = record.status as AttendanceStatusValue;
      if (bucket) bucket.push(status);
      else attendanceByCourse.set(session.courseId, [status]);
    }
  }

  const coursesReport: ReportCardCourse[] = courses.map((course) => {
    const courseItems = items.filter((item) => item.courseId === course.id);
    const courseCategories = categories.filter(
      (category) => category.courseId === course.id,
    );

    const entries: GradeEntry[] = courseItems.map((item) => ({
      categoryId: item.categoryId,
      maximum: toNumber(item.maximum) ?? 0,
      score: toNumber(item.scores[0]?.score ?? null),
    }));

    const statuses = attendanceByCourse.get(course.id) ?? [];

    return {
      courseId: course.id,
      courseName: course.name,
      accent: course.accent,
      result: computeTerm(
        entries,
        courseCategories.map((category) => ({
          id: category.id,
          weight: category.weight,
        })),
      ),
      attendance: summariseAttendance(statuses),
      attendanceRate: attendanceRate(statuses),
      comment: commentByCourse.get(course.id) ?? null,
      rows: courseItems.map((item) => ({
        id: item.id,
        title: item.title,
        categoryName: categoryName.get(item.categoryId) ?? "Uncategorised",
        maximum: toNumber(item.maximum) ?? 0,
        score: toNumber(item.scores[0]?.score ?? null),
        assessedOn: item.assessedOn,
      })),
    };
  });

  return { term, student: user, courses: coursesReport };
}

/** The small dashboard card: this term's average and attendance. */
export async function getStudentTermOverview(termId?: string) {
  const user = await requireUser();

  const terms = await listTerms();
  const term = pickTerm(terms, termId);
  if (!term) return { term: null, average: null, attendanceRate: null };

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: user.id, course: { archived: false } },
    select: { course: { select: { id: true } } },
  });
  const courseIds = enrollments.map((entry) => entry.course.id);

  if (courseIds.length === 0) {
    return { term, average: null, attendanceRate: null };
  }

  const [categories, items, records] = await Promise.all([
    prisma.gradeCategory.findMany({
      where: { courseId: { in: courseIds }, termId: term.id },
      select: { id: true, courseId: true, weight: true },
    }),
    prisma.gradeItem.findMany({
      where: { courseId: { in: courseIds }, termId: term.id },
      select: {
        courseId: true,
        categoryId: true,
        maximum: true,
        scores: { where: { studentId: user.id }, select: { score: true } },
      },
    }),
    prisma.attendanceRecord.findMany({
      where: {
        studentId: user.id,
        session: {
          courseId: { in: courseIds },
          date: { gte: term.startsOn, lte: term.endsOn },
        },
      },
      select: { status: true },
    }),
  ]);

  const averages: Array<number | null> = [];
  for (const courseId of courseIds) {
    const courseCategories = categories.filter(
      (category) => category.courseId === courseId,
    );
    const courseItems = items.filter((item) => item.courseId === courseId);
    const result = computeTerm(
      courseItems.map((item) => ({
        categoryId: item.categoryId,
        maximum: toNumber(item.maximum) ?? 0,
        score: toNumber(item.scores[0]?.score ?? null),
      })),
      courseCategories.map((category) => ({
        id: category.id,
        weight: category.weight,
      })),
    );
    averages.push(result.average);
  }

  return {
    term,
    average: meanOfAverages(averages),
    attendanceRate: attendanceRate(
      records.map((record) => record.status as AttendanceStatusValue),
    ),
  };
}

// ---------------------------------------------------------------------------
// Small helpers used by pages
// ---------------------------------------------------------------------------

export function weekdayForToday(now = new Date()): number {
  return todayWeekday(now, schoolTimeZone());
}

export function currentDateKey(now = new Date()): string {
  return todayKey(now, schoolTimeZone());
}

export function weekdayOfDateKey(dateKey: string): number {
  return weekdayOf(dateKey);
}

export function dateKeyOf(date: Date): string {
  return toDateKey(date);
}
