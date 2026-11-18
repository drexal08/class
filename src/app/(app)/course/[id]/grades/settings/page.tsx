import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CategoryWeightsForm } from "@/components/school/category-weights-form";
import {
  DeleteGradeItemButton,
  NewGradeItemForm,
} from "@/components/school/grade-item-form";
import { TermSelector } from "@/components/school/term-selector";
import { Card } from "@/components/ui/card";
import { getCourseGradebook } from "@/lib/data/school";
import { getCourseForUser } from "@/lib/data/courses";

export const metadata: Metadata = { title: "Gradebook settings" };
export const dynamic = "force-dynamic";

export default async function GradebookSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ term?: string }>;
}) {
  const { id } = await params;
  const { term: termId } = await searchParams;

  const course = await getCourseForUser(id);
  if (!course || !course.canManage) notFound();

  const gradebook = await getCourseGradebook(id, termId);

  if (gradebook.term === null) {
    return (
      <div className="container-feed py-6">
        <h2 className="text-xl font-semibold tracking-tight">Gradebook settings</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          An administrator needs to create a term before categories can be set.
        </p>
      </div>
    );
  }

  const categoryName = new Map(
    gradebook.categories.map((category) => [category.id, category.name]),
  );

  return (
    <div className="container-feed space-y-6 py-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          Gradebook settings
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {course.name} · {gradebook.term.name}
        </p>
      </div>

      <TermSelector
        terms={gradebook.terms}
        currentId={gradebook.term.id}
        basePath={`/course/${id}/grades/settings`}
      />

      <Card className="p-6">
        <h3 className="text-base font-semibold tracking-tight">
          Category weights
        </h3>
        <p className="mt-1 mb-4 max-w-prose text-sm text-muted-foreground">
          Categories with no marked items are dropped and their weight is shared
          across the rest, so a test nobody has sat yet cannot lower an average.
        </p>
        <CategoryWeightsForm
          key={gradebook.term.id}
          courseId={id}
          termId={gradebook.term.id}
          categories={gradebook.categories}
        />
      </Card>

      <Card className="p-6">
        <h3 className="text-base font-semibold tracking-tight">
          Add a grade column
        </h3>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Graded classwork adds its own column automatically, in the Coursework
          category.
        </p>
        <NewGradeItemForm
          courseId={id}
          termId={gradebook.term.id}
          categories={gradebook.categories}
        />
      </Card>

      <Card className="p-6">
        <h3 className="text-base font-semibold tracking-tight">
          Columns in this term
        </h3>

        {gradebook.items.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No columns yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {gradebook.items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {categoryName.get(item.categoryId) ?? "Uncategorised"} · out
                    of {item.maximum}
                    {item.assignmentId ? " · from classwork" : ""}
                  </p>
                </div>
                <DeleteGradeItemButton
                  courseId={id}
                  gradeItemId={item.id}
                  title={item.title}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
