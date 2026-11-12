"use client";

import { Pencil, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MarkRow } from "@/components/bridge/mark-row";
import { MarksImportPanel } from "@/components/bridge/marks-import-panel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  LEVELS,
  LEVEL_KEYS,
  subjectsFor,
  toBridgeLevel,
  type EstimatorSubject as Subject,
  type Level,
} from "@/lib/bridge/combinations";
import {
  importMarks,
  type BridgeImport,
  type ImportReport,
} from "@/lib/bridge/marks-import";
import {
  MARKS_IMPORT_EVENT,
  clearImportProgress,
  takeMarksImport,
} from "@/lib/bridge/marks-import-store";
import {
  dailyEncouragement,
  mapTargetAverage,
  mapTargetMarksWithEdits,
  markAverage,
  matchedProgress,
  normalizeGoals,
  targetAverage,
  validMark,
} from "@/lib/bridge/progress";
import { computeWeightedPercentage } from "@/lib/bridge/scoring";
import type { SubjectTargets } from "@/lib/bridge/target-table";
import { cn } from "@/lib/utils";

export type BridgeInitialEstimate = {
  combinationCode: string;
  marks: Record<string, string>;
  targets: Record<string, SubjectTargets>;
  goalTargets: Record<string, string>;
  overallTarget: string;
  usefulnessRating: number | null;
};

const GRADE_BANDS: {
  min: number;
  label: string;
  note: string;
  ringClass: string;
}[] = [
  {
    min: 95,
    label: "Remarkable",
    note: "You will be recognized for your remarkable efforts. Keep setting the standard.",
    ringClass: "stroke-primary",
  },
  {
    min: 90,
    label: "Top performer",
    note: "With this average, you may rank among the top-performing students in your community.",
    ringClass: "stroke-primary",
  },
  {
    min: 80,
    label: "Excellent",
    note: "This is an excellent average. Maintain your discipline and keep pushing toward the very top.",
    ringClass: "stroke-primary",
  },
  {
    min: 70,
    label: "Strong",
    note: "This is a strong result. Keep working consistently to make your university applications even more competitive.",
    ringClass: "stroke-primary",
  },
  {
    min: 60,
    label: "Promoted",
    note: "You have the marks needed to pass, but averages in the 60s are not highly appreciated by universities. Put in greater effort now to make university applications easier after high school.",
    ringClass: "stroke-warning",
  },
  {
    min: 50,
    label: "Almost there",
    note: "Remember, to get promoted you need an average of 60 for the whole year. Put in some effort—you will make it.",
    ringClass: "stroke-danger",
  },
  {
    min: 0,
    label: "Below target",
    note: "Your average is below the promotion target. Start improving each subject now and ask for support where you need it.",
    ringClass: "stroke-danger",
  },
];

function bandFor(pct: number) {
  return (
    GRADE_BANDS.find((band) => pct >= band.min) ?? {
      min: 0,
      label: "Getting started",
      note: "",
      ringClass: "stroke-danger",
    }
  );
}

type SaveField =
  | "combinationCode"
  | "marks"
  | "targets"
  | "goalTargets"
  | "overallTarget"
  | "usefulnessRating";

export function BridgeEstimator({
  level,
  ownerName,
  email,
  isAdmin,
  initial,
}: {
  level: Level;
  ownerName: string;
  email: string;
  isAdmin: boolean;
  initial: BridgeInitialEstimate;
}) {
  const router = useRouter();
  const lv = LEVELS[level];
  const COMBINATIONS = lv.combos;
  const initialCombo = COMBINATIONS.some(
    (combo) => combo.code === initial.combinationCode,
  )
    ? initial.combinationCode
    : (COMBINATIONS[0]?.code ?? "");

  const [comboCode, setComboCode] = useState(initialCombo);
  const [marks, setMarks] = useState(initial.marks);
  const [targets, setTargets] = useState(initial.targets);
  const [goals, setGoals] = useState(normalizeGoals(initial.goalTargets));
  const [overallTarget, setOverallTarget] = useState(initial.overallTarget);
  const [editingOverallTarget, setEditingOverallTarget] = useState(false);
  const [overallTargetDraft, setOverallTargetDraft] = useState("");
  const [mapOpen, setMapOpen] = useState(false);
  const [mapSelection, setMapSelection] = useState<string[]>([]);
  const [mapPlanVisible, setMapPlanVisible] = useState(false);
  const [mapEditing, setMapEditing] = useState(false);
  const [mapEdits, setMapEdits] = useState<Record<string, string>>({});
  const [mapApplied, setMapApplied] = useState(false);
  const [rating, setRating] = useState<number | null>(
    initial.usefulnessRating,
  );
  const [saveMessage, setSaveMessage] = useState("");
  const [switchingLevel, setSwitchingLevel] = useState(false);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [day, setDay] = useState(0);

  const identity = level === "s6" ? "Candidate" : level === "s5" ? "Engine" : "";

  useEffect(() => {
    const update = () => setDay(Math.floor(Date.now() / 86400000));
    update();
    const timer = window.setInterval(update, 60000);
    return () => window.clearInterval(timer);
  }, []);

  // Autosave tracks the fields this tab actually edited. Writing the whole
  // estimate on every change lets a stale tab overwrite newer marks.
  const [saveTick, setSaveTick] = useState(0);
  const dirty = useRef<Set<SaveField>>(new Set());
  const values = useRef<Record<SaveField, unknown>>(
    {} as Record<SaveField, unknown>,
  );

  useEffect(() => {
    values.current = {
      combinationCode: comboCode,
      marks,
      targets,
      goalTargets: goals,
      overallTarget,
      usefulnessRating: rating,
    };
  });

  const markDirty = (field: SaveField) => {
    dirty.current.add(field);
    setSaveTick((tick) => tick + 1);
  };

  const save = useCallback(async (): Promise<boolean> => {
    const fields = Array.from(dirty.current);
    if (!fields.length) return true;
    dirty.current.clear();

    const patch: Record<string, unknown> = {};
    for (const field of fields) patch[field] = values.current[field];

    setSaveMessage("Saving changes…");
    try {
      const response = await fetch("/api/bridge/estimate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ level: toBridgeLevel(level), patch }),
        keepalive: true,
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Could not save your estimate");
      }
      setSaveMessage("Changes saved");
      return true;
    } catch (error) {
      // Keep the edits pending so the pagehide flush can retry them.
      for (const field of fields) dirty.current.add(field);
      setSaveMessage(
        error instanceof Error && error.message
          ? error.message
          : "Your latest changes could not be saved. Please check your connection.",
      );
      return false;
    }
  }, [level]);

  useEffect(() => {
    if (!saveTick) return;
    const timer = window.setTimeout(() => {
      void save();
    }, 500);
    return () => window.clearTimeout(timer);
  }, [saveTick, save]);

  // Never lose the last keystrokes when leaving the page or closing the tab.
  useEffect(() => {
    const flush = () => {
      void save();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      flush();
    };
  }, [save]);

  const switchLevel = async (next: Level) => {
    if (next === level || switchingLevel) return;
    setSwitchingLevel(true);
    await save();
    router.push(`/bridge?level=${next.toUpperCase()}`);
  };

  const combo =
    COMBINATIONS.find((item) => item.code === comboCode) ?? COMBINATIONS[0];

  const subjects: Subject[] = useMemo(
    () => (combo ? subjectsFor(level, combo) : []),
    [combo, level],
  );

  // Bookmarklet imports are staged by BridgeImportListener. Apply them when
  // the estimator mounts, or as soon as the listener dispatches an event.
  const appliedImport = useRef<string | null>(null);
  const applyImport = useRef<(payload: BridgeImport) => void>(() => undefined);

  useEffect(() => {
    applyImport.current = (payload) => {
      if (appliedImport.current === payload.id) return;
      appliedImport.current = payload.id;

      const outcome = importMarks(payload, subjects, targets);
      if (Object.keys(outcome.marks).length) {
        setMarks((previous) => ({ ...previous, ...outcome.marks }));
        markDirty("marks");
      }
      if (Object.keys(outcome.targets).length) {
        setTargets((previous) => {
          const next = { ...previous };
          for (const [name, table] of Object.entries(outcome.targets)) {
            // Replace the imported columns but never wipe a column the student
            // filled by hand and AcademicBridge has no marks for yet.
            next[name] = { ...previous[name], ...table };
          }
          return next;
        });
        markDirty("targets");
      }
      setImportReport(outcome.report);
      clearImportProgress();
    };
  });

  useEffect(() => {
    const receive = () => {
      const payload = takeMarksImport();
      if (!payload || appliedImport.current === payload.id) return;
      applyImport.current(payload);
    };
    receive();
    window.addEventListener(MARKS_IMPORT_EVENT, receive);
    return () => window.removeEventListener(MARKS_IMPORT_EVENT, receive);
  }, []);

  const { pct, earned, maxPoints, filled } = useMemo(
    () => computeWeightedPercentage(subjects, marks),
    [marks, subjects],
  );
  const band = bandFor(pct);
  const complete = filled === subjects.length;
  const goalSummary = targetAverage(subjects, goals);
  const currentSummary = markAverage(subjects, marks);
  const manualOverallTarget = validMark(overallTarget);
  const displayedOverallTarget = manualOverallTarget ?? goalSummary.value;

  const mapSelectedSubjects = useMemo(
    () =>
      mapSelection.flatMap((name) => {
        const subject = subjects.find((item) => item.name === name);
        return subject ? [subject] : [];
      }),
    [mapSelection, subjects],
  );

  const mapPlan = useMemo(() => {
    if (displayedOverallTarget === null) return null;
    const edits: Record<string, number> = {};
    for (const [name, value] of Object.entries(mapEdits)) {
      const mark = validMark(value);
      if (mark !== null) edits[name] = mark;
    }
    return mapTargetMarksWithEdits(
      mapSelectedSubjects,
      displayedOverallTarget,
      edits,
    );
  }, [displayedOverallTarget, mapEdits, mapSelectedSubjects]);

  const mapPlanAverage = useMemo(
    () => (mapPlan ? mapTargetAverage(mapPlan) : null),
    [mapPlan],
  );
  const mapAwayFromTarget =
    mapPlanAverage !== null &&
    displayedOverallTarget !== null &&
    Math.abs(mapPlanAverage - displayedOverallTarget) > 0.05;
  const progress = matchedProgress(subjects, marks, goals);
  const encouragement = dailyEncouragement(ownerName, progress, day);

  const startOverallTargetEdit = () => {
    setOverallTargetDraft(
      overallTarget ||
        (goalSummary.value === null ? "" : goalSummary.value.toFixed(2)),
    );
    setEditingOverallTarget(true);
  };

  const cancelOverallTargetEdit = () => {
    setEditingOverallTarget(false);
    setOverallTargetDraft("");
  };

  const resetMapEdits = () => {
    setMapEditing(false);
    setMapEdits({});
    setMapApplied(false);
  };

  const commitOverallTarget = () => {
    const next = overallTargetDraft.trim();
    if (next !== "" && validMark(next) === null) return;
    setOverallTarget(next);
    setEditingOverallTarget(false);
    setOverallTargetDraft("");
    resetMapEdits();
    markDirty("overallTarget");
  };

  const toggleMapCourse = (name: string) => {
    setMapPlanVisible(false);
    resetMapEdits();
    setMapSelection((previous) =>
      previous.includes(name)
        ? previous.filter((item) => item !== name)
        : [...previous, name],
    );
  };

  const openMapPlanner = () => {
    setMapOpen(true);
    setMapPlanVisible(false);
    resetMapEdits();
  };

  const closeMapPlanner = () => {
    setMapOpen(false);
    setMapPlanVisible(false);
    resetMapEdits();
  };

  const startMapEdit = () => {
    setMapEditing(true);
    setMapApplied(false);
  };

  const setMapEdit = (name: string, value: string) => {
    if (
      value !== "" &&
      (!/^\d{0,3}(\.\d{0,20})?$/.test(value) || Number(value) > 100)
    )
      return;
    setMapEdits((all) => ({ ...all, [name]: value }));
    setMapApplied(false);
  };

  const clearEmptyMapEdit = (name: string) => {
    setMapEdits((all) => {
      if (all[name] !== "") return all;
      const next = { ...all };
      delete next[name];
      return next;
    });
  };

  const applyMapPlan = () => {
    if (!mapPlan) return;
    const nextGoals = { ...goals };
    for (const row of mapPlan)
      nextGoals[row.name] = String(Number(row.mark.toFixed(1)));
    setGoals(nextGoals);
    setMapEditing(false);
    setMapApplied(true);
    markDirty("goalTargets");
  };

  const setSubjectTable = (name: string, data: SubjectTargets) => {
    setTargets((all) => ({ ...all, [name]: data }));
    markDirty("targets");
  };

  const setMark = (name: string, value: string) => {
    if (value !== "" && !/^\d{0,3}(\.\d{0,1})?$/.test(value)) return;
    const num = Number(value);
    if (value !== "" && !Number.isNaN(num) && num > 100) value = "100";
    setMarks((current) => ({ ...current, [name]: value }));
    markDirty("marks");
  };

  const renderSubjectRow = (subject: Subject) => (
    <MarkRow
      key={subject.name}
      subject={subject}
      value={marks[subject.name] ?? ""}
      onChange={setMark}
      targets={targets[subject.name] ?? {}}
      onTargets={setSubjectTable}
      goal={goals[subject.name] ?? ""}
      onGoal={(name, target) => {
        setGoals((all) => ({ ...all, [name]: target }));
        markDirty("goalTargets");
      }}
      disabled={false}
    />
  );

  if (!combo) return null;

  const R = 84;
  const C = 2 * Math.PI * R;
  const dash = (pct / 100) * C;

  return (
    <div className="container-page py-6">
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-border pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            CLA Bridge
          </p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
            <span className="block">Hello {ownerName}</span>
            <span className="mt-1 block text-2xl text-muted-foreground sm:text-3xl">
              {identity ? `${identity}, ` : ""}ready to track your progress?
            </span>
          </h1>
        </div>

        <p className="text-sm text-muted-foreground">
          {email} · {lv.label}
        </p>
      </header>

      {isAdmin && (
        <nav
          aria-label="Switch school level"
          className="mt-4 flex flex-wrap items-center gap-2"
        >
          <span className="mr-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Admin view · all levels
          </span>
          {LEVEL_KEYS.map((item) => (
            <Button
              key={item}
              size="sm"
              variant={item === level ? "default" : "outline"}
              onClick={() => void switchLevel(item)}
              disabled={switchingLevel}
              aria-current={item === level ? "page" : undefined}
            >
              {item.toUpperCase()}
            </Button>
          ))}
        </nav>
      )}

      <MarksImportPanel report={importReport} />

      <section aria-busy={false} className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Your combination
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {COMBINATIONS.map((item) => {
            const active = item.code === comboCode;
            return (
              <button
                key={item.code}
                onClick={() => {
                  setComboCode(item.code);
                  markDirty("combinationCode");
                  setMapSelection([]);
                  setMapPlanVisible(false);
                }}
                className={cn(
                  "rounded-lg border bg-card p-4 text-left transition-colors",
                  active
                    ? "border-primary ring-1 ring-primary"
                    : "border-border hover:border-primary/50",
                )}
              >
                <span
                  className={cn(
                    "text-2xl font-semibold",
                    active ? "text-primary" : "text-foreground",
                  )}
                >
                  {item.code}
                </span>
                <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
                  {item.cores.join(" · ")}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            Core subjects <span className="text-foreground">×7 each</span>
          </h2>
          <div className="mt-4 space-y-3">
            {subjects.slice(0, combo.cores.length).map(renderSubjectRow)}
          </div>

          <h2 className="mt-10 text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            Subsidiaries
          </h2>
          <p className="mt-2 text-xs text-muted-foreground">
            {subjects.slice(combo.cores.length).map((subject, index) => (
              <span key={subject.name}>
                {index > 0 ? ", " : ""}
                {subject.name}{" "}
                <span className="text-foreground">×{subject.weight}</span>
              </span>
            ))}
          </p>
          <div className="mt-4 space-y-3">
            {subjects.slice(combo.cores.length).map(renderSubjectRow)}
          </div>
        </section>

        <aside className="h-fit lg:sticky lg:top-20">
          <Card className="p-6">
            <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
              Estimated report
            </h2>

            <div className="relative mx-auto mt-6 h-52 w-52">
              <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
                <circle
                  cx="100"
                  cy="100"
                  r={R}
                  fill="none"
                  stroke="var(--muted)"
                  strokeWidth="12"
                />
                <circle
                  cx="100"
                  cy="100"
                  r={R}
                  fill="none"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${dash} ${C}`}
                  className={cn(
                    band.ringClass,
                    "transition-all duration-500 ease-out",
                  )}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-semibold text-foreground">
                  {pct.toFixed(2)}
                  <span className="text-2xl text-muted-foreground">%</span>
                </span>
                <span className="mt-1 text-xs text-muted-foreground">
                  {earned.toFixed(0)} / {maxPoints * 100} weighted marks
                </span>
              </div>
            </div>

            {complete && (
              <div className="mt-6 rounded-lg bg-secondary p-4 text-center">
                <p className="text-xl font-semibold text-foreground">
                  {band.label}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {goalSummary.filled || manualOverallTarget !== null
                    ? "Keep building toward your personal goal."
                    : band.note}
                </p>
              </div>
            )}

            <p className="mt-4 text-center text-xs text-muted-foreground">
              {complete
                ? "All subjects filled — this is your full estimate."
                : `${filled} of ${subjects.length} subjects entered — fill the rest for a complete picture.`}
            </p>

            <Button
              variant="outline"
              onClick={() => {
                setMarks({});
                setTargets({});
                markDirty("marks");
                markDirty("targets");
              }}
              className="mt-5 w-full"
            >
              Clear all marks
            </Button>
          </Card>
        </aside>
      </div>

      <section aria-label="Overall progress" className="mt-10 border-t border-border pt-8">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Your term progress
        </h2>
        <div className="mt-5 grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              Actual overall average
            </p>
            <p className="mt-2 text-4xl font-semibold text-foreground">
              {currentSummary.value === null
                ? "—"
                : currentSummary.value.toFixed(2)}
              <span className="text-lg text-muted-foreground"> /100</span>
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {currentSummary.filled}/{subjects.length} subjects entered
              {currentSummary.filled < subjects.length
                ? " · current marks only"
                : ""}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              Target overall average
            </p>
            {editingOverallTarget ? (
              <form
                className="mt-2 flex flex-wrap items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  commitOverallTarget();
                }}
              >
                <input
                  autoFocus
                  type="text"
                  inputMode="decimal"
                  aria-label="Target overall average out of 100"
                  placeholder="e.g. 80"
                  value={overallTargetDraft}
                  onChange={(event) => {
                    const next = event.target.value;
                    if (
                      next !== "" &&
                      (!/^\d{0,3}(\.\d{0,20})?$/.test(next) ||
                        Number(next) > 100)
                    )
                      return;
                    setOverallTargetDraft(next);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") cancelOverallTargetEdit();
                  }}
                  className="w-24 rounded-md border border-input bg-background px-2 py-1 text-right text-2xl font-semibold text-warning outline-none focus:border-ring"
                />
                <span className="text-lg text-muted-foreground">/100</span>
                <Button
                  type="submit"
                  size="sm"
                  disabled={
                    overallTargetDraft.trim() !== "" &&
                    validMark(overallTargetDraft) === null
                  }
                >
                  Save
                </Button>
                {overallTarget && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setOverallTarget("");
                      setEditingOverallTarget(false);
                      setOverallTargetDraft("");
                      markDirty("overallTarget");
                    }}
                  >
                    Clear
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={cancelOverallTargetEdit}
                >
                  Cancel
                </Button>
              </form>
            ) : (
              <button
                type="button"
                onClick={startOverallTargetEdit}
                title="Click to set or modify your target overall average"
                className="group mt-2 flex items-baseline gap-2 rounded-md text-left outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <span className="text-4xl font-semibold text-warning">
                  {displayedOverallTarget === null
                    ? "—"
                    : displayedOverallTarget.toFixed(2)}
                </span>
                <span className="text-lg text-muted-foreground">/100</span>
                <Pencil
                  aria-hidden="true"
                  className="size-4 self-center text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                />
                <span className="sr-only">Edit target overall average</span>
              </button>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {manualOverallTarget !== null
                ? "Your custom target · click the number to modify"
                : `${goalSummary.filled}/${subjects.length} targets set${
                    goalSummary.filled < subjects.length
                      ? " · partial target"
                      : ""
                  }`}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={openMapPlanner}
              className="mt-3"
            >
              Set your MAP target
            </Button>
          </div>
        </div>

        {mapOpen && (
          <section
            aria-label="MAP target planner"
            className="mt-6 rounded-lg border border-border bg-card p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-foreground">
                  MAP target planner
                </h3>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                  Select the courses you want to plan for, starting with your
                  hardest course and finishing with your easiest. The planner
                  gives the hardest course the lowest mark and the easiest
                  course the highest mark.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={closeMapPlanner}>
                Close
              </Button>
            </div>

            {mapPlanVisible && mapPlan ? (
              <>
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <caption className="sr-only">
                      Marks needed in each selected course to reach your target
                      overall average
                    </caption>
                    <thead>
                      <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                        <th scope="col" className="py-2 pr-3 font-semibold">
                          Order
                        </th>
                        <th scope="col" className="py-2 pr-3 font-semibold">
                          Course
                        </th>
                        <th scope="col" className="py-2 pr-3 font-semibold">
                          Weight
                        </th>
                        <th
                          scope="col"
                          className="py-2 text-right font-semibold"
                        >
                          {mapEditing ? "Your mark" : "Mark needed"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {mapPlan.map((row) => (
                        <tr
                          key={row.name}
                          className="border-b border-border/60 last:border-0"
                        >
                          <td className="py-2.5 pr-3">
                            <span className="inline-flex size-6 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                              {row.rank + 1}
                            </span>
                            {row.rank === 0 && (
                              <span className="ml-2 text-[11px] font-semibold uppercase tracking-wide text-primary">
                                Hardest
                              </span>
                            )}
                            {row.rank === mapPlan.length - 1 &&
                              mapPlan.length > 1 && (
                                <span className="ml-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                  Easiest
                                </span>
                              )}
                          </td>
                          <td className="py-2.5 pr-3 font-medium text-foreground">
                            {row.name}
                          </td>
                          <td className="py-2.5 pr-3 text-muted-foreground">
                            ×{row.weight}
                          </td>
                          <td className="py-2.5 text-right text-lg font-semibold text-foreground">
                            {mapEditing ? (
                              <span className="inline-flex items-center gap-1">
                                <input
                                  aria-label={`${row.name} proposed target mark out of 100`}
                                  type="text"
                                  inputMode="decimal"
                                  value={
                                    mapEdits[row.name] ?? row.mark.toFixed(1)
                                  }
                                  onChange={(event) =>
                                    setMapEdit(row.name, event.target.value)
                                  }
                                  onBlur={() => clearEmptyMapEdit(row.name)}
                                  className="w-20 rounded-md border border-input bg-background px-2 py-1.5 text-right text-lg font-semibold text-foreground outline-none focus:border-ring"
                                />
                                <span className="text-xs font-normal text-muted-foreground">
                                  /100
                                </span>
                              </span>
                            ) : (
                              <>
                                <span>{row.mark.toFixed(1)}</span>
                                <span className="text-xs font-normal text-muted-foreground">
                                  {" "}
                                  /100
                                </span>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Target overall average across these courses:{" "}
                      {displayedOverallTarget?.toFixed(2) ?? "—"} · Plan
                      weighted result: {mapPlanAverage?.toFixed(2) ?? "—"} ·
                      marks rounded to one decimal place.
                    </p>
                    {mapEditing && (
                      <p className="text-xs text-muted-foreground">
                        Change any mark and the other courses rebalance to keep
                        the weighted result on target.
                      </p>
                    )}
                    {mapAwayFromTarget && (
                      <p className="text-xs text-danger">
                        Your edits cannot reach{" "}
                        {displayedOverallTarget?.toFixed(2)} with these courses,
                        so the plan&apos;s weighted result is{" "}
                        {mapPlanAverage?.toFixed(2)}.
                      </p>
                    )}
                    {mapApplied && (
                      <output className="block text-xs text-foreground">
                        Applied to the target fields for these courses.
                      </output>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setMapPlanVisible(false);
                        resetMapEdits();
                      }}
                    >
                      Change courses
                    </Button>
                    {mapEditing ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={resetMapEdits}
                      >
                        Cancel edit
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={startMapEdit}
                        disabled={!mapPlan}
                      >
                        Edit
                      </Button>
                    )}
                    <Button size="sm" onClick={applyMapPlan} disabled={!mapPlan}>
                      Apply
                    </Button>
                    <Button variant="ghost" size="sm" onClick={closeMapPlanner}>
                      Done
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {subjects.map((subject) => {
                    const rank = mapSelection.indexOf(subject.name);
                    const selected = rank >= 0;
                    return (
                      <button
                        key={subject.name}
                        type="button"
                        aria-pressed={selected}
                        aria-label={`${subject.name}, weight ${subject.weight}${
                          selected ? `, selected as number ${rank + 1}` : ""
                        }`}
                        onClick={() => toggleMapCourse(subject.name)}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
                          selected
                            ? "border-primary bg-secondary"
                            : "border-border bg-background hover:border-primary/50",
                        )}
                      >
                        <span>
                          <span className="block text-sm font-medium text-foreground">
                            {subject.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ×{subject.weight}
                          </span>
                        </span>
                        {selected && (
                          <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                            {rank + 1}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {mapSelection.length
                    ? `${mapSelection.length} course${
                        mapSelection.length === 1 ? "" : "s"
                      } selected · 1 is your hardest course${
                        mapSelection.length > 1
                          ? `, ${mapSelection.length} is your easiest`
                          : ""
                      }.`
                    : "No courses selected yet. Tap them in order from hardest to easiest."}
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    Target overall average:{" "}
                    {displayedOverallTarget === null
                      ? "not set"
                      : `${displayedOverallTarget.toFixed(2)} /100`}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {mapSelection.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setMapSelection([]);
                          setMapPlanVisible(false);
                        }}
                      >
                        Clear selection
                      </Button>
                    )}
                    <Button
                      size="sm"
                      disabled={
                        mapSelection.length === 0 ||
                        displayedOverallTarget === null
                      }
                      onClick={() => setMapPlanVisible(true)}
                    >
                      Set
                    </Button>
                  </div>
                </div>
                {displayedOverallTarget === null && (
                  <p className="mt-2 text-xs text-danger">
                    Set your target overall average first by clicking the target
                    number above.
                  </p>
                )}
              </>
            )}
          </section>
        )}

        {complete && (
          <div className="mt-6 border-l-2 border-primary pl-4" aria-live="polite">
            <h3 className="text-sm font-semibold text-primary">
              Today&apos;s progress feedback
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-foreground">
              {encouragement}
            </p>
          </div>
        )}
        <output className="mt-4 block text-xs text-muted-foreground">
          {saveMessage}
        </output>
      </section>

      <section aria-label="App usefulness" className="mt-10 border-t border-border pt-6">
        <h2 className="text-sm font-semibold text-foreground">
          How useful has CLA Bridge been for you?
        </h2>
        <fieldset className="mt-3 flex gap-2" aria-label="Usefulness rating">
          {[1, 2, 3, 4, 5].map((value) => (
            <Button
              key={value}
              variant="ghost"
              size="icon"
              aria-label={`Rate ${value} out of 5`}
              aria-pressed={rating === value}
              title={`${value} out of 5`}
              onClick={() => {
                setRating(value);
                markDirty("usefulnessRating");
              }}
              className={cn(
                rating !== null && value <= rating
                  ? "text-primary"
                  : "text-muted-foreground",
              )}
            >
              <Star
                className={
                  rating !== null && value <= rating ? "fill-current" : ""
                }
              />
            </Button>
          ))}
        </fieldset>
        <p className="mt-2 text-xs text-muted-foreground">
          {rating
            ? `Your rating: ${rating}/5. Thank you for your feedback.`
            : "1 = Not useful · 5 = Very useful"}
        </p>
      </section>

      <footer className="mt-12 border-t border-border pt-6 text-center text-xs text-muted-foreground">
        CLA Bridge — originally created by ikorineza kael lord mercy
      </footer>
    </div>
  );
}
