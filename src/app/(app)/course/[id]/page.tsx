import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarClock, MessagesSquare } from "lucide-react";

import { AnnouncementCard } from "@/components/stream/announcement-card";
import { AnnouncementComposer } from "@/components/stream/announcement-composer";
import { EmptyState } from "@/components/shared/empty-state";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { getCourseForUser } from "@/lib/data/courses";
import { listAssignments } from "@/lib/data/classwork";
import { listAnnouncements } from "@/lib/data/stream";
import { formatDueDate, isOverdue } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function StreamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [user, course] = await Promise.all([getCurrentUser(), getCourseForUser(id)]);
  if (!user || !course) notFound();

  const [posts, classwork] = await Promise.all([
    listAnnouncements(id),
    listAssignments(id),
  ]);

  // Module C moderation: the class post policy decides who may post or comment.
  const canPost =
    course.isTeacher ||
    course.postPolicy === "STUDENTS_CAN_POST_AND_COMMENT";
  const canComment =
    course.isTeacher || course.postPolicy !== "ONLY_TEACHERS";

  const upcoming = classwork
    .filter((item) => item.dueDate && !isOverdue(item.dueDate))
    .sort(
      (a, b) =>
        new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime(),
    )
    .slice(0, 3);

  return (
    <div className="container-page py-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-4">
          {course.description && (
            <Card className="p-5">
              <h2 className="text-sm font-medium text-muted-foreground">
                About this class
              </h2>
              <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">
                {course.description}
              </p>
            </Card>
          )}

          {canPost && !course.archived && (
            <AnnouncementComposer courseId={course.id} user={user} />
          )}

          {posts.length === 0 ? (
            <EmptyState
              icon={MessagesSquare}
              title="Nothing on the stream yet"
              description={
                course.isTeacher
                  ? "Post an announcement to welcome your class and set expectations."
                  : "Announcements from your teacher will appear here."
              }
            />
          ) : (
            <ul className="space-y-4">
              {posts.map((post) => (
                <li key={post.id}>
                  <AnnouncementCard
                    post={post}
                    courseId={course.id}
                    viewerId={user.id}
                    isTeacher={course.isTeacher}
                    canComment={canComment && !course.archived}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <CalendarClock
                className="size-4 text-muted-foreground"
                strokeWidth={1.75}
                aria-hidden
              />
              Coming up
            </h2>

            {upcoming.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No work due soon.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {upcoming.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/course/${course.id}/classwork/${item.id}`}
                      className="block rounded-md text-sm hover:underline"
                    >
                      <span className="line-clamp-2 font-medium">
                        {item.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {formatDueDate(item.dueDate)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <Link
              href={`/course/${course.id}/classwork`}
              className="mt-4 inline-block text-sm font-medium underline-offset-4 hover:underline"
            >
              View all classwork
            </Link>
          </Card>
        </aside>
      </div>
    </div>
  );
}
