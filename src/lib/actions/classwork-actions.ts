"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  requireActiveCourseManager,
  requireAssignmentManager,
  runAction,
} from "@/lib/auth/guards";
import { notifyCourse } from "@/lib/notify";
import { prisma } from "@/lib/prisma";
import { courseChannel, publish } from "@/lib/realtime/server";
import { deleteObject } from "@/lib/storage/s3";
import type { ActionState } from "@/lib/types";
import {
  createAssignmentSchema,
  createTopicSchema,
  firstIssue,
  rubricCriterionSchema,
} from "@/lib/validators";

/** The topic select submits "none" rather than "", which Radix disallows. */
function normaliseTopicId(value: FormDataEntryValue | null): string | undefined {
  const topicId = typeof value === "string" ? value.trim() : "";
  return topicId && topicId !== "none" ? topicId : undefined;
}

type RubricInput = { title: string; description?: string; points: number };

/**
 * Reads the parallel rubric inputs and validates them with the same schema the
 * API uses, rather than trusting `Number(...)` on arbitrary form values.
 */
function parseRubric(formData: FormData):
  | { rubric: RubricInput[] }
  | { error: string } {
  const titles = formData.getAll("rubricTitle").map(String);
  const points = formData.getAll("rubricPoints").map(String);
  const descriptions = formData.getAll("rubricDescription").map(String);

  const rows = titles
    .map((title, index) => ({
      title,
      description: descriptions[index] ?? "",
      points: points[index] ?? "10",
    }))
    .filter((row) => row.title.trim().length > 0);

  const parsed = z.array(rubricCriterionSchema).safeParse(rows);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  return { rubric: parsed.data };
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
    const context = await requireActiveCourseManager(courseId);

    // A topic from another course would silently re-parent the assignment.
    if (topicId) {
      const owned = await prisma.topic.count({ where: { id: topicId, courseId } });
      if (!owned) return { error: "That topic belongs to another class" };
    }

    const rubric = parseRubric(formData);
    if ("error" in rubric) return { error: rubric.error };

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
          create: rubric.rubric.map((criterion, index) => ({
            title: criterion.title,
            description: criterion.description ?? null,
            points: criterion.points,
            sortOrder: index,
          })),
        },
      },
      select: { id: true },
    });

    revalidatePath(`/course/${courseId}/classwork`);
    await publish(courseChannel(courseId), "assignment:new", {
      actorId: context.user.id,
      id: assignment.id,
    });

    if (data.published) {
      await notifyCourse({
        courseId,
        type: "ASSIGNMENT_CREATED",
        title: `New classwork: ${data.title}`,
        body: data.dueDate
          ? `Due ${data.dueDate.toLocaleDateString()}`
          : undefined,
        linkPath: `/course/${courseId}/classwork/${assignment.id}`,
        actorId: context.user.id,
      });
    }
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
      acceptingSubmissions: formData
        .getAll("acceptingSubmissions")
        .includes("true"),
      allowLateSubmissions: formData.getAll("allowLateSubmissions").includes("true"),
    });
    if (!parsed.success) return { error: firstIssue(parsed.error) };

    const { courseId, topicId, ...data } = parsed.data;
    await requireAssignmentManager(courseId, assignmentId);

    if (topicId) {
      const owned = await prisma.topic.count({ where: { id: topicId, courseId } });
      if (!owned) return { error: "That topic belongs to another class" };
    }

    const rubric = parseRubric(formData);
    if ("error" in rubric) return { error: rubric.error };

    await prisma.$transaction(async (tx) => {
      await tx.assignment.updateMany({
        where: { id: assignmentId, courseId },
        data: {
          title: data.title,
          description: data.description ?? null,
          type: data.type,
          maxPoints: data.maxPoints,
          dueDate: data.dueDate ?? null,
          published: data.published,
          acceptingSubmissions: data.acceptingSubmissions,
          allowLateSubmissions: data.allowLateSubmissions,
          topicId: topicId ?? null,
        },
      });

      // Rubric criteria are replaced as a set. Existing marks are tied to the
      // old criteria and are removed with them; the edit form warns about this.
      await tx.rubricCriterion.deleteMany({ where: { assignmentId } });
      if (rubric.rubric.length > 0) {
        await tx.rubricCriterion.createMany({
          data: rubric.rubric.map((criterion, index) => ({
            assignmentId,
            title: criterion.title,
            description: criterion.description ?? null,
            points: criterion.points,
            sortOrder: index,
          })),
        });
      }
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
    await requireAssignmentManager(courseId, assignmentId);

    const attachments = await prisma.attachment.findMany({
      where: { assignmentId, assignment: { courseId } },
      select: { key: true },
    });

    await prisma.assignment.deleteMany({ where: { id: assignmentId, courseId } });
    await Promise.all(
      attachments.map((attachment) => deleteObject(attachment.key)),
    );

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
    await requireAssignmentManager(courseId, assignmentId);

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
    await requireActiveCourseManager(courseId);

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
