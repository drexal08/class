import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClipboardList } from "lucide-react";

import {
  ClassworkGroup,
  ClassworkList,
} from "@/components/classwork/classwork-list";
import { CreateAssignmentDialog } from "@/components/classwork/create-assignment-dialog";
import { CreateTopicForm } from "@/components/classwork/create-topic-form";
import { EmptyState } from "@/components/shared/empty-state";
import { getCourseForUser } from "@/lib/data/courses";
import { listAssignments, listTopics } from "@/lib/data/classwork";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Classwork" };
export const dynamic = "force-dynamic";

export default async function ClassworkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const course = await getCourseForUser(id);
  if (!course) notFound();

  const [items, topics, totalStudents] = await Promise.all([
    listAssignments(id),
    listTopics(id),
    prisma.enrollment.count({ where: { courseId: id, role: "STUDENT" } }),
  ]);

  const ungrouped = items.filter((item) => !item.topicId);
  const byTopic = topics
    .map((topic) => ({
      topic,
      items: items.filter((item) => item.topicId === topic.id),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="container-feed py-6">
      {course.isTeacher && !course.archived && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <CreateAssignmentDialog courseId={course.id} topics={topics} />
          <CreateTopicForm courseId={course.id} />
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No classwork yet"
          description={
            course.isTeacher
              ? "Create an assignment, quiz, question or material. Group related work with topics."
              : "Assignments and material will appear here once your teacher posts them."
          }
        />
      ) : (
        <div className="space-y-6">
          {ungrouped.length > 0 && (
            <ClassworkGroup>
              <ClassworkList
                items={ungrouped}
                courseId={course.id}
                isTeacher={course.isTeacher}
                totalStudents={totalStudents}
              />
            </ClassworkGroup>
          )}

          {byTopic.map((group) => (
            <ClassworkGroup key={group.topic.id} title={group.topic.name}>
              <ClassworkList
                items={group.items}
                courseId={course.id}
                isTeacher={course.isTeacher}
                totalStudents={totalStudents}
              />
            </ClassworkGroup>
          ))}
        </div>
      )}
    </div>
  );
}
