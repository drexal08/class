"use client";

import { Bookmark, Check, Copy, ExternalLink } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { ACADEMIC_BRIDGE_GRADES_URL } from "@/lib/bridge/academic-bridge";
import { bookmarkletCode } from "@/lib/bridge/marks-bookmarklet";
import type {
  ImportProgress,
  ImportReport,
} from "@/lib/bridge/marks-import";
import {
  MARKS_IMPORT_PROGRESS_EVENT,
  readImportProgress,
} from "@/lib/bridge/marks-import-store";

function subscribeProgress(onChange: () => void) {
  window.addEventListener(MARKS_IMPORT_PROGRESS_EVENT, onChange);
  return () => window.removeEventListener(MARKS_IMPORT_PROGRESS_EVENT, onChange);
}

const serverProgress = () => null;

/**
 * Zero-install import: the student drags this button to the bookmarks bar once,
 * then clicks it on AcademicBridge. Nothing is downloaded or installed.
 */
export function MarksImportPanel({ report }: { report: ImportReport | null }) {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const codeRef = useRef("");
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [fallbackCode, setFallbackCode] = useState("");
  const [hint, setHint] = useState("");
  const progress: ImportProgress | null = useSyncExternalStore(
    subscribeProgress,
    readImportProgress,
    serverProgress,
  );

  useEffect(() => {
    const code = bookmarkletCode(window.location.origin);
    codeRef.current = code;
    // React 19 blocks javascript: URLs in the href prop, so set it on the node.
    linkRef.current?.setAttribute("href", code);
  }, []);

  const copy = async () => {
    if (!codeRef.current) return;
    try {
      await navigator.clipboard.writeText(codeRef.current);
      setCopied(true);
      setCopyFailed(false);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setFallbackCode(codeRef.current);
      setCopyFailed(true);
    }
  };

  const activeProgress =
    progress && progress.stage !== "done" ? progress : null;

  return (
    <section
      aria-label="Import AcademicBridge marks"
      className="mt-6 rounded-lg border border-border bg-card px-5 py-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="text-sm font-semibold">
            Import your AcademicBridge marks
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Drag the{" "}
            <span className="font-semibold text-foreground">
              Import my marks
            </span>{" "}
            button to your bookmarks bar once. After that, click the bookmark
            anywhere in AcademicBridge — it opens Grades, reads every assessment
            page and fills your subject averages, tables and this estimate,
            which is saved automatically.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href={ACADEMIC_BRIDGE_GRADES_URL} target="_blank" rel="noreferrer">
            Open AcademicBridge <ExternalLink />
          </a>
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <a
          ref={linkRef}
          href="#"
          draggable
          onClick={(event) => {
            event.preventDefault();
            setHint(
              "Drag this button up to your bookmarks bar — clicking it here does nothing.",
            );
          }}
          className="inline-flex cursor-grab items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 active:cursor-grabbing"
        >
          <Bookmark className="size-4" aria-hidden="true" />
          Import my marks
        </a>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void copy()}
          disabled={copied}
        >
          {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy bookmarklet"}
        </Button>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Bookmarks bar hidden? Press{" "}
        <kbd className="rounded bg-secondary px-1">Ctrl</kbd>+
        <kbd className="rounded bg-secondary px-1">Shift</kbd>+
        <kbd className="rounded bg-secondary px-1">B</kbd> (
        <kbd className="rounded bg-secondary px-1">⌘</kbd>+
        <kbd className="rounded bg-secondary px-1">Shift</kbd>+
        <kbd className="rounded bg-secondary px-1">B</kbd> on Mac). Bookmarklets
        run in desktop browsers; mobile browsers do not support them.
      </p>

      {hint && (
        <output className="mt-2 block text-xs font-medium text-foreground">
          {hint}
        </output>
      )}

      {activeProgress && (
        <output
          aria-live="polite"
          className="mt-3 block rounded-md border border-border bg-secondary/50 px-4 py-3 text-xs text-foreground"
        >
          <span className="font-semibold">{activeProgress.message}</span>
          {activeProgress.totalPages !== null && activeProgress.page !== null
            ? ` Page ${activeProgress.page} of ${activeProgress.totalPages}.`
            : ""}
          {activeProgress.rows > 0
            ? ` ${activeProgress.rows} rows read.`
            : ""}
        </output>
      )}

      {copyFailed && (
        <div className="mt-3">
          <p className="text-xs text-muted-foreground">
            Copy this code into a new bookmark&apos;s address:
          </p>
          <textarea
            readOnly
            value={fallbackCode}
            rows={3}
            onFocus={(event) => event.currentTarget.select()}
            aria-label="Bookmarklet code"
            className="mt-1 w-full rounded-md border border-border bg-background p-2 font-mono text-xs text-foreground"
          />
        </div>
      )}

      {report && <ImportSummary report={report} />}
    </section>
  );
}

function ImportSummary({ report }: { report: ImportReport }) {
  const subjects = report.matched.length;
  const imported = report.matched.reduce((sum, item) => sum + item.marks, 0);
  return (
    <output className="mt-4 block rounded-md border border-border bg-secondary/50 p-4">
      <p className="text-sm font-semibold text-foreground">
        Imported {imported} {imported === 1 ? "mark" : "marks"} into {subjects}{" "}
        {subjects === 1 ? "subject" : "subjects"}
        {report.pages > 1 ? ` from ${report.pages} pages` : ""}.
      </p>

      {subjects > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {report.matched.map((item) => (
            <li key={item.subject}>
              <span className="font-semibold text-foreground">
                {item.subject}
              </span>
              {" · "}
              {item.marks} {item.marks === 1 ? "mark" : "marks"}
              {Object.keys(item.counts).length > 0
                ? ` (${Object.entries(item.counts)
                    .map(([column, count]) => `${column} ${count}`)
                    .join(", ")})`
                : ""}
              {" · "}term estimate{" "}
              {item.estimate === null
                ? "—"
                : `${item.estimate.toFixed(1)}%`}
            </li>
          ))}
        </ul>
      )}

      {report.expectedCount !== null &&
        report.expectedCount > report.totalRows && (
          <p className="mt-2 text-xs text-muted-foreground">
            Read {report.totalRows} of {report.expectedCount} assessment rows.
            If some pages did not load, click the bookmark again.
          </p>
        )}

      {subjects === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          None of the imported subjects matched this level and combination.
          Check the combination above, then click the bookmark again.
        </p>
      )}

      {report.unmatched.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Not in this level or combination: {report.unmatched.join(", ")}.
          Switch combination and import again, or enter those subjects by hand.
        </p>
      )}

      {report.unknown.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          Skipped unknown assessment types:{" "}
          {report.unknown
            .map((item) => `${item.type} (${item.count})`)
            .join(", ")}
          .
        </p>
      )}

      {report.collapsed.length > 0 && (
        <details className="mt-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer">
            {report.collapsed.length} column
            {report.collapsed.length === 1 ? "" : "s"} averaged to fit the table
          </summary>
          <ul className="mt-1 space-y-1">
            {report.collapsed.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      )}
    </output>
  );
}
