"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  requireAssignmentTeacher,
  requireCourseTeacher,
  runAction,
} from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { courseChannel, publish } from "@/lib/realtime/server";
import type { ActionState } from "@/lib/types";
import {
  createAssignmentSchema,
  createTopicSchema,
  firstIssue,
} from "@/lib/validators";

/** The topic select submits "none" rather than "", which Radix disallows. */
function normaliseTopicId(value: FormDataEntryValue | null): string | undefined {
  const topicId = typeof value === "string" ? value.trim() : "";
  return topicId && topicId !== "none" ? topicId : undefined;
}

export async function createAssignmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const parsed = createAssignmentSchema.safeParse({
      courseId: formData.get("courseId"),
      title: formData.get("title"),
      description: formData.get("description"),
      type: formData.get("type") ?? "ASSIGNMENT",
      maxPoints: formData.get("maxPoints") ?? 100,
      dueDate: formData.get("dueDate"),
      // "none" is the select's sentinel for "no topic".
      topicId: normaliseTopicId(formData.get("topicId")),
      published: formData.get("published") !== "false",
    });
    if (!parsed.success) return { error: firstIssue(parsed.error) };

    const { courseId, topicId, ...data } = parsed.data;
    const context = await requireCourseTeacher(courseId);

    // A topic from another course would silently re-parent the assignment.
    if (topicId) {
      const owned = await prisma.topic.count({ where: { id: topicId, courseId } });
      if (!owned) return { error: "That topic belongs to another class" };
    }

    const rubricTitles = formData.getAll("rubricTitle").map(String);
    const rubricPoints = formData.getAll("rubricPoints").map(String);

    const assignment = await prisma.assignment.create({
      data: {
        courseId,
        topicId: topicId ?? null,
        title: data.title,
        description: data.description ?? null,
        type: data.type,
        maxPoints: data.maxPoints,
        dueDate: data.dueDate ?? null,
        published: data.published,
        rubric: {
          create: rubricTitles
            .map((title, index) => ({
              title: title.trim(),
              points: Number(rubricPoints[index] ?? 10) || 0,
              sortOrder: index,
            }))
            .filter((criterion) => criterion.title.length > 0),
        },
      },
      select: { id: true },
    });

    revalidatePath(`/course/${courseId}/classwork`);
    await publish(courseChannel(courseId), "assignment:new", {
      actorId: context.user.id,
      id: assignment.id,
    });
  });
}

export async function updateAssignmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const assignmentId = String(formData.get("assignmentId") ?? "");
    const parsed = createAssignmentSchema.safeParse({
      courseId: formData.get("courseId"),
      title: formData.get("title"),
      description: formData.get("description"),
      type: formData.get("type") ?? "ASSIGNMENT",
      maxPoints: formData.get("maxPoints") ?? 100,
      dueDate: formData.get("dueDate"),
      // "none" is the select's sentinel for "no topic".
      topicId: normaliseTopicId(formData.get("topicId")),
      published: formData.get("published") !== "false",
    });
    if (!parsed.success) return { error: firstIssue(parsed.error) };

    const { courseId, topicId, ...data } = parsed.data;
    await requireAssignmentTeacher(courseId, assignmentId);

    if (topicId) {
      const owned = await prisma.topic.count({ where: { id: topicId, courseId } });
      if (!owned) return { error: "That topic belongs to another class" };
    }

    await prisma.assignment.updateMany({
      where: { id: assignmentId, courseId },
      data: {
        title: data.title,
        description: data.description ?? null,
        type: data.type,
        maxPoints: data.maxPoints,
        dueDate: data.dueDate ?? null,
        published: data.published,
        topicId: topicId ?? null,
      },
    });

    revalidatePath(`/course/${courseId}/classwork`);
    revalidatePath(`/course/${courseId}/classwork/${assignmentId}`);
  });
}

export async function deleteAssignmentAction(
  courseId: string,
  assignmentId: string,
): Promise<ActionState> {
  const result = await runAction(async () => {
    await requireAssignmentTeacher(courseId, assignmentId);

    await prisma.assignment.deleteMany({ where: { id: assignmentId, courseId } });
    revalidatePath(`/course/${courseId}/classwork`);
  });

  if (result.error) return result;
  redirect(`/course/${courseId}/classwork`);
}

export async function setAssignmentPublishedAction(
  courseId: string,
  assignmentId: string,
  published: boolean,
): Promise<ActionState> {
  return runAction(async () => {
    await requireAssignmentTeacher(courseId, assignmentId);

    await prisma.assignment.updateMany({
      where: { id: assignmentId, courseId },
      data: { published },
    });

    revalidatePath(`/course/${courseId}/classwork`);
  });
}

export async function createTopicAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const parsed = createTopicSchema.safeParse({
      courseId: formData.get("courseId"),
      name: formData.get("name"),
    });
    if (!parsed.success) return { error: firstIssue(parsed.error) };

    const { courseId, name } = parsed.data;
    await requireCourseTeacher(courseId);

    // New topics append to the end of the list.
    const last = await prisma.topic.findFirst({
      where: { courseId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    await prisma.topic.create({
      data: { courseId, name, sortOrder: (last?.sortOrder ?? -1) + 1 },
    });

    revalidatePath(`/course/${courseId}/classwork`);
  });
}

export async function deleteTopicAction(
  courseId: string,
  topicId: string,
): Promise<ActionState> {
  return runAction(async () => {
    await requireCourseTeacher(courseId);

    // Assignments survive; the schema sets their topicId to null.
    await prisma.topic.deleteMany({ where: { id: topicId, courseId } });
    revalidatePath(`/course/${courseId}/classwork`);
  });
}
