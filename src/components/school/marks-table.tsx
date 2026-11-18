import type { TermResult } from "@/lib/school/grading";
import { cn } from "@/lib/utils";

type MarkRow = {
  id: string;
  title: string;
  categoryName: string;
  maximum: number;
  score: number | null;
  assessedOn: Date;
};

function formatDay(value: Date): string {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * A student's marked items for one course and term.
 *
 * Unmarked rows are shown rather than hidden, and read "Not marked" instead of
 * a zero, so a missing entry is visibly missing.
 */
export function MarksTable({
  rows,
  result,
}: {
  rows: MarkRow[];
  result: TermResult | null;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        Nothing has been entered for this term yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {result && result.categories.length > 0 && (
        <ul className="flex flex-wrap gap-2 text-xs">
          {result.categories.map((category) => (
            <li
              key={category.categoryId}
              className="rounded-full border border-border bg-secondary px-2.5 py-1"
            >
              <span className="font-medium">{round(category.average)}%</span>{" "}
              <span className="text-muted-foreground">
                {round(category.effectiveWeight)}% of term
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Marked items for this term
          </caption>
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="px-4 py-2.5 font-medium">
                Item
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                Category
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">
                Score
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">
                %
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">
                Date
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const percentage =
                row.score === null || row.maximum <= 0
                  ? null
                  : Math.round((row.score / row.maximum) * 1000) / 10;

              return (
              <tr key={row.id} className="border-b border-border last:border-0">
                <th scope="row" className="px-4 py-2.5 text-left font-normal">
                  {row.title}
                </th>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {row.categoryName}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {row.score === null ? (
                    <span className="text-muted-foreground">Not marked</span>
                  ) : (
                    `${row.score} / ${row.maximum}`
                  )}
                </td>
                <td
                  className={cn(
                    "px-4 py-2.5 text-right tabular-nums",
                    percentage === null
                      ? "text-muted-foreground"
                      : percentage < 50
                        ? "text-danger"
                        : percentage < 60
                          ? "text-warning"
                          : "text-foreground",
                  )}
                >
                  {percentage === null ? "—" : `${percentage}%`}
                </td>
                <td className="px-4 py-2.5 text-right text-muted-foreground">
                  {formatDay(row.assessedOn)}
                </td>
              </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-secondary/40">
              <th scope="row" colSpan={3} className="px-4 py-2.5 text-right font-medium">
                Term average
              </th>
              <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                {result?.average === null || result === null
                  ? "—"
                  : `${result.average}%`}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
