"use client";

import { useState, useTransition } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  assignLegacyBridgeStudentAction,
  discardLegacyBridgeStudentAction,
  syncLegacyBridgeStudentsAction,
} from "@/lib/actions/bridge-actions";

export type StagedBridgeStudent = {
  id: string;
  email: string | null;
  displayName: string | null;
  level: string | null;
  username: string | null;
  hasAccount: boolean;
};

/**
 * The students the clabridge import is still holding on to.
 *
 * A row claims itself once the student signs up with the same address and
 * opens the estimator. What is left here is either a student who has not
 * registered yet or one whose address was mistyped, so an administrator can
 * point the row at the account that exists or clear it out.
 *
 * New students are pulled in automatically when they open the estimator; the
 * button below sweeps the whole source so an administrator can see who is
 * waiting without waiting for a sign-in.
 */
export function LegacyBridgeStudents({ rows }: { rows: StagedBridgeStudent[] }) {
  const [pending, startTransition] = useTransition();
  const [addresses, setAddresses] = useState<Record<string, string>>({});
  const [syncing, setSyncing] = useState(false);

  function sync() {
    setSyncing(true);
    startTransition(async () => {
      const result = await syncLegacyBridgeStudentsAction();
      setSyncing(false);
      if (result.error) toast.error(result.error);
      else toast.success("CLA Bridge imports pulled");
    });
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">CLA Bridge imports</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length
              ? `${rows.length} student${rows.length === 1 ? "" : "s"} waiting for an LMS account. They claim their import the first time they open the estimator.`
              : "Every imported student has been claimed."}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending || syncing}
          onClick={sync}
        >
          <RefreshCw className={syncing ? "animate-spin" : undefined} />
          Pull new imports
        </Button>
      </div>

      {!rows.length ? null : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Staged clabridge students waiting to be claimed
            </caption>
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="px-5 py-3 font-medium">
                  Imported address
                </th>
                <th scope="col" className="px-3 py-3 font-medium">
                  Nickname
                </th>
                <th scope="col" className="px-3 py-3 font-medium">
                  Level
                </th>
                <th scope="col" className="px-3 py-3 font-medium">
                  Status
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Claim for
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 font-medium text-foreground">
                    {row.email ?? "No address"}
                    {row.displayName && (
                      <span className="block text-xs font-normal text-muted-foreground">
                        {row.displayName}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {row.username ? `@${row.username}` : "—"}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {row.level ?? "—"}
                  </td>
                  <td className="px-3 py-3">
                    {row.hasAccount ? (
                      <Badge variant="success">Account exists</Badge>
                    ) : (
                      <Badge variant="outline">No account yet</Badge>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Input
                        value={addresses[row.id] ?? row.email ?? ""}
                        placeholder="address of the LMS account"
                        aria-label={`Address of the LMS account for ${row.email ?? "this student"}`}
                        className="h-8 w-56"
                        disabled={pending}
                        onChange={(event) =>
                          setAddresses((current) => ({
                            ...current,
                            [row.id]: event.target.value,
                          }))
                        }
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            const result = await assignLegacyBridgeStudentAction(
                              row.id,
                              addresses[row.id] ?? row.email ?? "",
                            );
                            if (result.error) toast.error(result.error);
                            else toast.success("Import claimed");
                          })
                        }
                      >
                        Link
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Discard the import for ${row.email ?? "this student"}`}
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            const result =
                              await discardLegacyBridgeStudentAction(row.id);
                            if (result.error) toast.error(result.error);
                            else toast.success("Import discarded");
                          })
                        }
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
