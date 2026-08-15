"use server";

import { db } from "@/db";
import {
  assignments,
  submissions,
  enrollments,
  topics,
  users,
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import {
  createAssignmentSchema,
  createTopicSchema,
  submitWorkSchema,
  gradeSubmissionSchema,
} from "@/lib/validators";
import { revalidatePath } from "next/cache";

export type ActionState = {
  error?: string;
  success?: boolean;
};

export async function createAssignmentAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const courseId = Number(formData.get("courseId"));
  const title = formData.get("title") as string;
  const description = (formData.get("description") as string) || undefined;
  const type = (formData.get("type") as string) || "assignment";
  const maxPointsRaw = formData.get("maxPoints") as string;
  const maxPoints = maxPointsRaw ? Number(maxPointsRaw) : null;
  const dueDateRaw = formData.get("dueDate") as string;
  const dueDate = dueDateRaw || null;
  const topicIdRaw = formData.get("topicId") as string;
  const topicId = topicIdRaw ? Number(topicIdRaw) : null;

  const parsed = createAssignmentSchema.safeParse({
    courseId,
    title,
    description,
    type,
    maxPoints,
    dueDate,
    topicId,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  // Verify teacher role
  const [enrollment] = await db
    .select({ role: enrollments.role })
    .from(enrollments)
    .where(
      and(eq(enrollments.userId, user.id), eq(enrollments.courseId, courseId))
    )
    .limit(1);

  if (!enrollment || enrollment.role !== "teacher") {
    return { error: "Only teachers can create assignments" };
  }

  await db.insert(assignments).values({
    courseId: parsed.data.courseId,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    type: parsed.data.type,
    maxPoints: parsed.data.maxPoints ?? null,
    dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
    topicId: parsed.data.topicId ?? null,
    createdById: user.id,
  });

  revalidatePath(`/course/${courseId}/classwork`);
  return { success: true };
}

export async function createTopicAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const courseId = Number(formData.get("courseId"));
  const name = formData.get("name") as string;

  const parsed = createTopicSchema.safeParse({ courseId, name });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const [enrollment] = await db
    .select({ role: enrollments.role })
    .from(enrollments)
    .where(
      and(eq(enrollments.userId, user.id), eq(enrollments.courseId, courseId))
    )
    .limit(1);

  if (!enrollment || enrollment.role !== "teacher") {
    return { error: "Only teachers can create topics" };
  }

  await db.insert(topics).values({
    courseId: parsed.data.courseId,
    name: parsed.data.name,
  });

  revalidatePath(`/course/${courseId}/classwork`);
  return { success: true };
}

export async function getCourseAssignments(courseId: number) {
  const user = await getCurrentUser();
  if (!user) return [];

  const [enrollment] = await db
    .select({ role: enrollments.role })
    .from(enrollments)
    .where(
      and(eq(enrollments.userId, user.id), eq(enrollments.courseId, courseId))
    )
    .limit(1);

  if (!enrollment) return [];

  return db
    .select({
      id: assignments.id,
      title: assignments.title,
      description: assignments.description,
      type: assignments.type,
      maxPoints: assignments.maxPoints,
      dueDate: assignments.dueDate,
      topicId: assignments.topicId,
      published: assignments.published,
      createdAt: assignments.createdAt,
      createdByName: users.name,
    })
    .from(assignments)
    .innerJoin(users, eq(assignments.createdById, users.id))
    .where(eq(assignments.courseId, courseId))
    .orderBy(desc(assignments.createdAt));
}

export async function getCourseTopics(courseId: number) {
  return db
    .select({
      id: topics.id,
      name: topics.name,
      sortOrder: topics.sortOrder,
    })
    .from(topics)
    .where(eq(topics.courseId, courseId))
    .orderBy(topics.sortOrder);
}

export async function getAssignmentById(assignmentId: number) {
  const user = await getCurrentUser();
  if (!user) return null;

  const [assignment] = await db
    .select({
      id: assignments.id,
      courseId: assignments.courseId,
      title: assignments.title,
      description: assignments.description,
      type: assignments.type,
      maxPoints: assignments.maxPoints,
      dueDate: assignments.dueDate,
      topicId: assignments.topicId,
      published: assignments.published,
      createdAt: assignments.createdAt,
      createdByName: users.name,
    })
    .from(assignments)
    .innerJoin(users, eq(assignments.createdById, users.id))
    .where(eq(assignments.id, assignmentId))
    .limit(1);

  if (!assignment) return null;

  // Verify enrollment
  const [enrollment] = await db
    .select({ role: enrollments.role })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.userId, user.id),
        eq(enrollments.courseId, assignment.courseId)
      )
    )
    .limit(1);

  if (!enrollment) return null;

  return { ...assignment, userRole: enrollment.role };
}

export async function submitWorkAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const assignmentId = Number(formData.get("assignmentId"));
  const content = (formData.get("content") as string) || undefined;

  const parsed = submitWorkSchema.safeParse({ assignmentId, content });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  // Get assignment
  const [assignment] = await db
    .select({
      id: assignments.id,
      courseId: assignments.courseId,
      dueDate: assignments.dueDate,
    })
    .from(assignments)
    .where(eq(assignments.id, assignmentId))
    .limit(1);

  if (!assignment) return { error: "Assignment not found" };

  // Verify student enrollment
  const [enrollment] = await db
    .select({ role: enrollments.role })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.userId, user.id),
        eq(enrollments.courseId, assignment.courseId)
      )
    )
    .limit(1);

  if (!enrollment || enrollment.role !== "student") {
    return { error: "Only students can submit work" };
  }

  // Check if late
  const now = new Date();
  const isLate = assignment.dueDate ? now > assignment.dueDate : false;

  // Check for existing submission
  const [existing] = await db
    .select({ id: submissions.id, status: submissions.status })
    .from(submissions)
    .where(
      and(
        eq(submissions.assignmentId, assignmentId),
        eq(submissions.studentId, user.id)
      )
    )
    .limit(1);

  if (existing) {
    // Re-submit
    await db
      .update(submissions)
      .set({
        content: parsed.data.content ?? null,
        status: "turned_in",
        turnedInAt: now,
        late: isLate,
        updatedAt: now,
      })
      .where(eq(submissions.id, existing.id));
  } else {
    await db.insert(submissions).values({
      assignmentId,
      studentId: user.id,
      content: parsed.data.content ?? null,
      status: "turned_in",
      turnedInAt: now,
      late: isLate,
    });
  }

  revalidatePath(`/course/${assignment.courseId}/assignment/${assignmentId}`);
  return { success: true };
}

export async function unsubmitWorkAction(
  assignmentId: number
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const [sub] = await db
    .select({ id: submissions.id, status: submissions.status })
    .from(submissions)
    .where(
      and(
        eq(submissions.assignmentId, assignmentId),
        eq(submissions.studentId, user.id)
      )
    )
    .limit(1);

  if (!sub || sub.status !== "turned_in") {
    return { error: "Cannot unsubmit" };
  }

  await db
    .update(submissions)
    .set({
      status: "assigned",
      turnedInAt: null,
      updatedAt: new Date(),
    })
    .where(eq(submissions.id, sub.id));

  revalidatePath(`/course`);
  return { success: true };
}

export async function getStudentSubmission(
  assignmentId: number,
  studentId: number
) {
  const [sub] = await db
    .select()
    .from(submissions)
    .where(
      and(
        eq(submissions.assignmentId, assignmentId),
        eq(submissions.studentId, studentId)
      )
    )
    .limit(1);

  return sub ?? null;
}

export async function getAssignmentSubmissions(assignmentId: number) {
  const user = await getCurrentUser();
  if (!user) return [];

  // Get assignment
  const [assignment] = await db
    .select({ courseId: assignments.courseId })
    .from(assignments)
    .where(eq(assignments.id, assignmentId))
    .limit(1);

  if (!assignment) return [];

  // Verify teacher
  const [enrollment] = await db
    .select({ role: enrollments.role })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.userId, user.id),
        eq(enrollments.courseId, assignment.courseId)
      )
    )
    .limit(1);

  if (!enrollment || enrollment.role !== "teacher") return [];

  return db
    .select({
      id: submissions.id,
      status: submissions.status,
      content: submissions.content,
      grade: submissions.grade,
      feedback: submissions.feedback,
      turnedInAt: submissions.turnedInAt,
      gradedAt: submissions.gradedAt,
      late: submissions.late,
      studentId: users.id,
      studentName: users.name,
      studentEmail: users.email,
      studentColor: users.avatarColor,
    })
    .from(submissions)
    .innerJoin(users, eq(submissions.studentId, users.id))
    .where(eq(submissions.assignmentId, assignmentId))
    .orderBy(users.name);
}

export async function gradeSubmissionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const submissionId = Number(formData.get("submissionId"));
  const grade = Number(formData.get("grade"));
  const feedback = (formData.get("feedback") as string) || undefined;

  const parsed = gradeSubmissionSchema.safeParse({
    submissionId,
    grade,
    feedback,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  // Get submission and assignment
  const [sub] = await db
    .select({
      id: submissions.id,
      assignmentId: submissions.assignmentId,
    })
    .from(submissions)
    .where(eq(submissions.id, submissionId))
    .limit(1);

  if (!sub) return { error: "Submission not found" };

  const [assignment] = await db
    .select({ courseId: assignments.courseId })
    .from(assignments)
    .where(eq(assignments.id, sub.assignmentId))
    .limit(1);

  if (!assignment) return { error: "Assignment not found" };

  // Verify teacher
  const [enrollment] = await db
    .select({ role: enrollments.role })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.userId, user.id),
        eq(enrollments.courseId, assignment.courseId)
      )
    )
    .limit(1);

  if (!enrollment || enrollment.role !== "teacher") {
    return { error: "Only teachers can grade submissions" };
  }

  await db
    .update(submissions)
    .set({
      grade: parsed.data.grade,
      feedback: parsed.data.feedback ?? null,
      status: "graded",
      gradedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(submissions.id, submissionId));

  revalidatePath(`/course/${assignment.courseId}`);
  return { success: true };
}

export async function returnSubmissionAction(
  submissionId: number
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const [sub] = await db
    .select({
      id: submissions.id,
      assignmentId: submissions.assignmentId,
    })
    .from(submissions)
    .where(eq(submissions.id, submissionId))
    .limit(1);

  if (!sub) return { error: "Submission not found" };

  const [assignment] = await db
    .select({ courseId: assignments.courseId })
    .from(assignments)
    .where(eq(assignments.id, sub.assignmentId))
    .limit(1);

  if (!assignment) return { error: "Assignment not found" };

  const [enrollment] = await db
    .select({ role: enrollments.role })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.userId, user.id),
        eq(enrollments.courseId, assignment.courseId)
      )
    )
    .limit(1);

  if (!enrollment || enrollment.role !== "teacher") {
    return { error: "Only teachers can return submissions" };
  }

  await db
    .update(submissions)
    .set({
      status: "returned",
      updatedAt: new Date(),
    })
    .where(eq(submissions.id, submissionId));

  revalidatePath(`/course/${assignment.courseId}`);
  return { success: true };
}

export async function deleteAssignmentAction(
  assignmentId: number,
  courseId: number
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const [enrollment] = await db
    .select({ role: enrollments.role })
    .from(enrollments)
    .where(
      and(eq(enrollments.userId, user.id), eq(enrollments.courseId, courseId))
    )
    .limit(1);

  if (!enrollment || enrollment.role !== "teacher") {
    return { error: "Only teachers can delete assignments" };
  }

  await db.delete(assignments).where(eq(assignments.id, assignmentId));
  revalidatePath(`/course/${courseId}/classwork`);
  return { success: true };
}

export async function getGradebookData(courseId: number) {
  const user = await getCurrentUser();
  if (!user) return null;

  const [enrollment] = await db
    .select({ role: enrollments.role })
    .from(enrollments)
    .where(
      and(eq(enrollments.userId, user.id), eq(enrollments.courseId, courseId))
    )
    .limit(1);

  if (!enrollment || enrollment.role !== "teacher") return null;

  // Get all students
  const studentList = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      avatarColor: users.avatarColor,
    })
    .from(enrollments)
    .innerJoin(users, eq(enrollments.userId, users.id))
    .where(
      and(
        eq(enrollments.courseId, courseId),
        eq(enrollments.role, "student")
      )
    )
    .orderBy(users.name);

  // Get all graded assignments
  const assignmentList = await db
    .select({
      id: assignments.id,
      title: assignments.title,
      maxPoints: assignments.maxPoints,
      type: assignments.type,
    })
    .from(assignments)
    .where(eq(assignments.courseId, courseId))
    .orderBy(assignments.createdAt);

  // Get all submissions
  const allSubmissions = await db
    .select({
      assignmentId: submissions.assignmentId,
      studentId: submissions.studentId,
      grade: submissions.grade,
      status: submissions.status,
    })
    .from(submissions);

  return {
    students: studentList,
    assignments: assignmentList.filter((a) => a.type !== "material"),
    submissions: allSubmissions,
  };
}
