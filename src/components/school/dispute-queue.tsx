"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, UserCheck, UserX, Gavel } from "lucide-react";
import {
  resolveDisputeActionSimple,
} from "@/lib/actions/cohort-actions";
import type { ActionState } from "@/lib/types";

interface Dispute {
  id: string;
  code: string;
  note: string | null;
  createdAt: string;
  member: {
    id: string;
    user: {
      studentCode: string | null;
      displayName: string | null;
      nameAsImported: string | null;
    };
  };
}

interface DisputeQueueProps {
  cohortId: string;
  disputes: Dispute[];
}

function DisputeList({ 
  cohortId, 
  disputes, 
  pending, 
  run 
}: { 
  cohortId: string; 
  disputes: Dispute[]; 
  pending: boolean; 
  run: (action: Promise<ActionState>, success: string) => void;
}) {
  return (
    <div className="space-y-4">
      {disputes.map((dispute) => (
        <div key={dispute.id} className="rounded-lg border border-border p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-medium">
                {dispute.member.user.displayName ?? dispute.member.user.nameAsImported ?? "Unknown"}
              </p>
              <p className="text-sm text-muted-foreground">
                Code: <code className="font-mono">{dispute.code}</code>
              </p>
              {dispute.note && (
                <p className="text-sm mt-1 text-muted-foreground">
                  Note: {dispute.note}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Filed: {new Date(dispute.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                variant="destructive"
                disabled={pending}
                onClick={() => run(
                  resolveDisputeActionSimple(cohortId, dispute.id, "UNASSIGN"),
                  "Code unassigned, student must re-claim"
                )}
              >
                <UserX className="mr-2 h-4 w-4" /> Unassign
              </Button>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => run(
                  resolveDisputeActionSimple(cohortId, dispute.id, "REASSIGN"),
                  "Code reassigned to another student"
                )}
              >
                <UserCheck className="mr-2 h-4 w-4" /> Reassign
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DisputeQueue({ cohortId, disputes }: DisputeQueueProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(action: Promise<ActionState>, success: string) {
    startTransition(async () => {
      const result = await action;
      if (result.error) toast.error(result.error);
      else {
        toast.success(success);
        router.refresh();
      }
    });
  }

  if (disputes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-muted-foreground" />
            Dispute queue
          </CardTitle>
          <CardDescription>No open disputes</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">No open disputes for this cohort</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-warning" />
          Dispute queue ({disputes.length})
        </CardTitle>
        <CardDescription>
          Students who disputed their claimed identity. Resolve by unassigning or reassigning.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DisputeList 
          cohortId={cohortId} 
          disputes={disputes} 
          pending={pending} 
          run={run}
        />
      </CardContent>
    </Card>
  );
}