import type { BridgeImport, ImportProgress } from "@/lib/bridge/marks-import";
import {
  parseBridgeImportMessage,
  parseImportProgressMessage,
} from "@/lib/bridge/marks-import";

const IMPORT_KEY = "cla-bridge.pending-import";
const PROGRESS_KEY = "cla-bridge.import-progress";

/** Fired after a bookmarklet payload is staged, so an open estimator can react. */
export const MARKS_IMPORT_EVENT = "cla-bridge:marks-import";

/** Fired whenever the live bookmarklet progress changes or is cleared. */
export const MARKS_IMPORT_PROGRESS_EVENT = "cla-bridge:marks-import-progress";

let importMemory: BridgeImport | null = null;
let progressMemory: ImportProgress | null = null;
let clearedProgress: { id: string } | null = null;

function sessionStore(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    // Storage can be disabled (private mode, hardened browsers); fall back to memory.
    return null;
  }
}

function notify(event: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(event));
}

/**
 * Keep a received import until the estimator mounts.
 * A bookmarklet can arrive while the app is still on the sign-in page, so the
 * payload has to survive that detour inside the same tab.
 */
export function stageMarksImport(payload: BridgeImport) {
  importMemory = payload;
  try {
    sessionStore()?.setItem(
      IMPORT_KEY,
      JSON.stringify({
        type: "cla-bridge:import",
        version: 1,
        id: payload.id,
        rows: payload.rows,
        pages: payload.pages,
        expectedCount: payload.expectedCount,
      }),
    );
  } catch {
    // Ignore quota/serialization failures; the in-memory copy still works.
  }
  notify(MARKS_IMPORT_EVENT);
}

/** Read and clear the staged import. */
export function takeMarksImport(): BridgeImport | null {
  const stored = importMemory ?? readStoredImport();
  importMemory = null;
  try {
    sessionStore()?.removeItem(IMPORT_KEY);
  } catch {
    // Nothing to clean up when storage is unavailable.
  }
  return stored;
}

/**
 * Remember the latest bookmarklet stage so the status panel can appear after a
 * sign-in redirect, or catch up when the estimator was not mounted yet.
 */
export function stageImportProgress(progress: ImportProgress) {
  // A run that the estimator already applied (or the student dismissed) must
  // not pop back up when the bookmarklet re-sends its last stage or reports the
  // final "done" after the acknowledgment. A retry is a new run with a new id.
  if (clearedProgress && clearedProgress.id === progress.id) {
    return;
  }
  progressMemory = progress;
  try {
    sessionStore()?.setItem(
      PROGRESS_KEY,
      JSON.stringify({
        type: "cla-bridge:progress",
        version: 1,
        ...progress,
      }),
    );
  } catch {
    // The in-memory copy still keeps the status usable.
  }
  notify(MARKS_IMPORT_PROGRESS_EVENT);
}

/** Latest staged progress, or null when no import is active. */
export function readImportProgress(): ImportProgress | null {
  if (progressMemory) return progressMemory;
  const store = sessionStore();
  if (!store) return null;
  try {
    const raw = store.getItem(PROGRESS_KEY);
    if (!raw) return null;
    // Cache the parsed value so `useSyncExternalStore` gets a stable snapshot.
    progressMemory = parseImportProgressMessage(JSON.parse(raw));
    return progressMemory;
  } catch {
    return null;
  }
}

/** Drop the status once the estimate has been filled. */
export function clearImportProgress() {
  const current = progressMemory ?? readImportProgress();
  if (current) clearedProgress = { id: current.id };
  progressMemory = null;
  try {
    sessionStore()?.removeItem(PROGRESS_KEY);
  } catch {
    // Nothing to clean up when storage is unavailable.
  }
  notify(MARKS_IMPORT_PROGRESS_EVENT);
}

function readStoredImport(): BridgeImport | null {
  const store = sessionStore();
  if (!store) return null;
  try {
    const raw = store.getItem(IMPORT_KEY);
    if (!raw) return null;
    return parseBridgeImportMessage(JSON.parse(raw));
  } catch {
    return null;
  }
}
