import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, CircleAlert, ListTodo } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentUser } from "@/lib/auth/session";
import { getStudentTodo, getTeacherTodo } from "@/lib/data/todo";
import { accentClasses, cn, formatDueDate, isOverdue } from "@/lib/utils";

export const metadata: Metadata = { title: "To-do" };
export const dynamic = "force-dynamic";

type Item = {
  id: string;
  title: string;
  dueDate: Date | null;
  maxPoints: number;
  course: { id: string; name: string; accent: string };
};

export default async function TodoPage() {
  const user = await getCurrentUser();
  const isTeacher = user?.role === "TEACHER" || user?.role === "ADMIN";

  return (
    <div className="container-feed py-8">
      <h1 className="text-2xl font-semibold tracking-tight">To-do</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {isTeacher
          ? "Work waiting for your review, across every class you teach."
          : "Everything assigned to you, across every class."}
      </p>

      <div className="mt-6">
        {isTeacher ? <TeacherTodo /> : <StudentTodo />}
      </div>
    </div>
  );
}

async function StudentTodo() {
  const { assigned, missing, done } = await getStudentTodo();

  return (
    <Tabs defaultValue="assigned">
      <TabsList>
        <TabsTrigger value="assigned">
          Assigned
          {assigned.length > 0 && <Count>{assigned.length}</Count>}
        </TabsTrigger>
        <TabsTrigger value="missing">
          Missing
          {missing.length > 0 && <Count>{missing.length}</Count>}
        </TabsTrigger>
        <TabsTrigger value="done">Done</TabsTrigger>
      </TabsList>

      <TabsContent value="assigned">
        <ItemList
          items={assigned}
          empty={{
            icon: CheckCircle2,
            title: "Nothing due",
            description: "You are all caught up. New work will appear here.",
          }}
        />
      </TabsContent>

      <TabsContent value="missing">
        <ItemList
          items={missing}
          overdue
          empty={{
            icon: CheckCircle2,
            title: "Nothing missing",
            description: "You have not missed any deadlines.",
          }}
        />
      </TabsContent>

      <TabsContent value="done">
        <ItemList
          items={done}
          empty={{
            icon: ListTodo,
            title: "Nothing turned in yet",
            description: "Work you hand in will be listed here.",
          }}
        />
      </TabsContent>
    </Tabs>
  );
}

async function TeacherTodo() {
  const { toReview, graded } = await getTeacherTodo();

  return (
    <Tabs defaultValue="review">
      <TabsList>
        <TabsTrigger value="review">
          To review
          {toReview.length > 0 && <Count>{toReview.length}</Count>}
        </TabsTrigger>
        <TabsTrigger value="graded">Reviewed</TabsTrigger>
      </TabsList>

      <TabsContent value="review">
        {toReview.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="Nothing to review"
            description="When students turn work in, it will appear here."
          />
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {toReview.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/course/${item.course.id}/classwork/${item.id}/grade`}
                    className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/50"
                  >
                    <Rule accent={item.course.accent} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{item.title}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {item.course.name} · {formatDueDate(item.dueDate)}
                      </p>
                    </div>
                    <Badge variant="info" className="shrink-0">
                      {item.turnedIn} to grade
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="graded">
        {graded.length === 0 ? (
          <EmptyState
            icon={ListTodo}
            title="Nothing reviewed yet"
            description="Assignments you have finished grading will be listed here."
          />
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {graded.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/course/${item.course.id}/classwork/${item.id}/grade`}
                    className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/50"
                  >
                    <Rule accent={item.course.accent} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{item.title}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {item.course.name}
                      </p>
                    </div>
                    <Badge variant="success" className="shrink-0">
                      {item.graded} graded
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </TabsContent>
    </Tabs>
  );
}

function ItemList({
  items,
  overdue = false,
  empty,
}: {
  items: Item[];
  overdue?: boolean;
  empty: {
    icon: typeof CheckCircle2;
    title: string;
    description: string;
  };
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={empty.icon}
        title={empty.title}
        description={empty.description}
      />
    );
  }

  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/course/${item.course.id}/classwork/${item.id}`}
              className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/50"
            >
              <Rule accent={item.course.accent} />

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.title}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {item.course.name} · {formatDueDate(item.dueDate)}
                </p>
              </div>

              {overdue || (item.dueDate && isOverdue(item.dueDate)) ? (
                <Badge variant="danger" className="shrink-0">
                  <CircleAlert className="size-3" />
                  Late
                </Badge>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Rule({ accent }: { accent: string }) {
  return (
    <span
      className={cn("h-8 w-1 shrink-0 rounded-full", accentClasses(accent).rule)}
      aria-hidden
    />
  );
}

function Count({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-1.5 rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground tabular-nums">
      {children}
    </span>
  );
}
