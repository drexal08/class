"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { CombinationPicker } from "@/components/bridge/combination-picker";
import { EstimateReport } from "@/components/bridge/estimate-report";
import { MapTargetPlanner } from "@/components/bridge/map-target-planner";
import { MarkRow } from "@/components/bridge/mark-row";
import { MarksImportPanel } from "@/components/bridge/marks-import-panel";
import { TermProgress } from "@/components/bridge/term-progress";
import { UsefulnessRating } from "@/components/bridge/usefulness-rating";
import { Button } from "@/components/ui/button";
import {
  LEVELS,
  LEVEL_KEYS,
  subjectsFor,
  type EstimatorSubject as Subject,
  type Level,
} from "@/lib/bridge/combinations";
import { bandFor } from "@/lib/bridge/grade-bands";
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
  markAverage,
  matchedProgress,
  normalizeGoals,
  targetAverage,
  validMark,
} from "@/lib/bridge/progress";
import { computeWeightedPercentage } from "@/lib/bridge/scoring";
import type { SubjectTargets } from "@/lib/bridge/target-table";
import { useEstimateAutosave } from "@/lib/bridge/use-estimate-autosave";

export type BridgeInitialEstimate = {
  combinationCode: string;
  marks: Record<string, string>;
  targets: Record<string, SubjectTargets>;
  goalTargets: Record<string, string>;
  overallTarget: string;
  usefulnessRating: number | null;
};

/**
 * The CLA Bridge estimator.
 *
 * This component owns the estimate itself — the combination, the marks, the
 * targets and the goals. Everything that only renders a slice of it lives in
 * its own component next door.
 */
export function BridgeEstimator({
  level,
  ownerName,
  email,
  username,
  isAdmin,
  initial,
}: {
  level: Level;
  ownerName: string;
  email: string;
  /** Clabridge handle, preserved through the import. Null for new accounts. */
  username: string | null;
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
  const [mapOpen, setMapOpen] = useState(false);
  const [mapResetToken, setMapResetToken] = useState(0);
  const [rating, setRating] = useState<number | null>(
    initial.usefulnessRating,
  );
  const [switchingLevel, setSwitchingLevel] = useState(false);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [day, setDay] = useState(0);

  const { markDirty, save, message: saveMessage } = useEstimateAutosave({
    level,
    values: {
      combinationCode: comboCode,
      marks,
      targets,
      goalTargets: goals,
      overallTarget,
      usefulnessRating: rating,
    },
  });

  const identity = level === "s6" ? "Candidate" : level === "s5" ? "Engine" : "";

  useEffect(() => {
    const update = () => setDay(Math.floor(Date.now() / 86400000));
    update();
    const timer = window.setInterval(update, 60000);
    return () => window.clearInterval(timer);
  }, []);

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
  const progress = matchedProgress(subjects, marks, goals);
  const encouragement = dailyEncouragement(ownerName, progress, day);

  const changeOverallTarget = (next: string, resetPlan = false) => {
    setOverallTarget(next);
    markDirty("overallTarget");
    if (resetPlan) setMapResetToken((token) => token + 1);
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

  return (
    <div className="container-page py-6">
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-border pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            CLA Bridge
          </p>
          <h1 className="mt-3 text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">
            <span className="block">Hello {ownerName}</span>
            <span className="mt-1 block text-xl text-muted-foreground sm:text-2xl">
              {identity ? `${identity}, ` : ""}ready to track your progress?
            </span>
          </h1>
        </div>

        <p className="text-sm text-muted-foreground">
          {username ? `@${username} · ` : ""}
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

      <CombinationPicker
        combinations={COMBINATIONS}
        comboCode={comboCode}
        onSelect={(code) => {
          setComboCode(code);
          markDirty("combinationCode");
        }}
      />

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section>
          <h2 className="text-sm font-semibold">
            Core subjects <span className="text-muted-foreground">×7 each</span>
          </h2>
          <div className="mt-4 space-y-3">
            {subjects.slice(0, combo.cores.length).map(renderSubjectRow)}
          </div>

          <h2 className="mt-10 text-sm font-semibold">
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
          <EstimateReport
            pct={pct}
            earned={earned}
            maxPoints={maxPoints}
            filled={filled}
            totalSubjects={subjects.length}
            band={band}
            complete={complete}
            hasGoal={goalSummary.filled > 0 || manualOverallTarget !== null}
            onClear={() => {
              setMarks({});
              setTargets({});
              markDirty("marks");
              markDirty("targets");
            }}
          />
        </aside>
      </div>

      <TermProgress
        subjectCount={subjects.length}
        currentSummary={currentSummary}
        goalSummary={goalSummary}
        overallTarget={overallTarget}
        manualOverallTarget={manualOverallTarget}
        displayedOverallTarget={displayedOverallTarget}
        onOverallTargetChange={changeOverallTarget}
        onOpenPlanner={() => setMapOpen(true)}
        complete={complete}
        encouragement={encouragement}
        saveMessage={saveMessage}
        planner={
          <MapTargetPlanner
            // A new combination starts a new plan.
            key={comboCode}
            open={mapOpen}
            subjects={subjects}
            target={displayedOverallTarget}
            resetToken={mapResetToken}
            onApply={(plan) => {
              setGoals((all) => ({ ...all, ...plan }));
              markDirty("goalTargets");
            }}
            onClose={() => setMapOpen(false)}
          />
        }
      />

      <UsefulnessRating
        rating={rating}
        onChange={(value) => {
          setRating(value);
          markDirty("usefulnessRating");
        }}
      />

      <footer className="mt-12 border-t border-border pt-6 text-center text-xs text-muted-foreground">
        CLA Bridge — originally created by ikorineza kael lord mercy
      </footer>
    </div>
  );
}
