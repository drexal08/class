"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { toBridgeLevel, type Level } from "@/lib/bridge/combinations";

/** The parts of an estimate the estimator can write back. */
export type EstimateSaveField =
  | "combinationCode"
  | "marks"
  | "targets"
  | "goalTargets"
  | "overallTarget"
  | "usefulnessRating";

export type EstimateValues = Record<EstimateSaveField, unknown>;

/**
 * Autosave for the estimator.
 *
 * Only the fields the tab actually edited are written, so a stale tab cannot
 * overwrite newer marks. The pending edits are flushed when the page is hidden
 * or closed, and a failed save keeps them queued for the next attempt.
 */
export function useEstimateAutosave({
  level,
  values,
}: {
  level: Level;
  values: EstimateValues;
}) {
  const [message, setMessage] = useState("");
  const [tick, setTick] = useState(0);
  const dirty = useRef<Set<EstimateSaveField>>(new Set());
  const latest = useRef<EstimateValues>(values);

  useEffect(() => {
    latest.current = values;
  });

  const markDirty = useCallback((field: EstimateSaveField) => {
    dirty.current.add(field);
    setTick((current) => current + 1);
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    const fields = Array.from(dirty.current);
    if (!fields.length) return true;
    dirty.current.clear();

    const patch: Record<string, unknown> = {};
    for (const field of fields) patch[field] = latest.current[field];

    setMessage("Saving changes…");
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
      setMessage("Changes saved");
      return true;
    } catch (error) {
      // Keep the edits pending so the pagehide flush can retry them.
      for (const field of fields) dirty.current.add(field);
      setMessage(
        error instanceof Error && error.message
          ? error.message
          : "Your latest changes could not be saved. Please check your connection.",
      );
      return false;
    }
  }, [level]);

  useEffect(() => {
    if (!tick) return;
    const timer = window.setTimeout(() => {
      void save();
    }, 500);
    return () => window.clearTimeout(timer);
  }, [tick, save]);

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

  return { markDirty, save, message };
}
