"use client";

import { useEffect } from "react";

import { ACADEMIC_BRIDGE_ORIGIN } from "@/lib/bridge/academic-bridge";
import {
  parseBridgeImportMessage,
  parseImportProgressMessage,
} from "@/lib/bridge/marks-import";
import {
  stageImportProgress,
  stageMarksImport,
} from "@/lib/bridge/marks-import-store";

/**
 * Receives bookmarklet messages on every page, including the sign-in detour.
 *
 * The payload is staged in sessionStorage so `/bridge` can pick it up after a
 * redirect. The bookmarklet retries until it receives an acknowledgement, so
 * acknowledging as soon as the payload is staged is safe.
 */
export function BridgeImportListener() {
  useEffect(() => {
    // #region agent log
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    fetch('http://127.0.0.1:7828/ingest/62b85801-70a6-40cf-a67e-0e8937ac4fa4',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'214fb7'},body:JSON.stringify({sessionId:'214fb7',hypothesisId:'F',location:'src/components/bridge/import-listener.tsx',message:'client hydrated',data:{path:location.pathname,domContentLoadedMs:nav?Math.round(nav.domContentLoadedEventEnd):null,loadMs:nav?Math.round(nav.loadEventEnd):null,responseMs:nav?Math.round(nav.responseEnd):null,transferKb:nav?Math.round(nav.transferSize/1024):null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== ACADEMIC_BRIDGE_ORIGIN) return;

      const progress = parseImportProgressMessage(event.data);
      if (progress) {
        stageImportProgress(progress);
        return;
      }

      const payload = parseBridgeImportMessage(event.data);
      if (!payload) return;

      stageMarksImport(payload);
      const source = event.source;
      if (source && "postMessage" in source) {
        (source as Window).postMessage(
          { type: "cla-bridge:import-ack", version: 1, id: payload.id },
          event.origin,
        );
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return null;
}
