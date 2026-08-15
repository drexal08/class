import { ImageResponse } from "next/og";

import { siteConfig } from "@/lib/site";

export const alt = `${siteConfig.name} — ${siteConfig.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Social preview card, generated at build time. Deliberately typographic — the
 * same restraint the app itself uses.
 */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f8fafc",
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 14,
              background: "#1e293b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#f8fafc",
              fontSize: 34,
              fontWeight: 700,
            }}
          >
            L
          </div>
          <div style={{ fontSize: 34, color: "#475569", fontWeight: 600 }}>
            {siteConfig.name}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 68,
              lineHeight: 1.1,
              color: "#1e293b",
              fontWeight: 700,
              maxWidth: 900,
            }}
          >
            {siteConfig.tagline}
          </div>
          <div style={{ fontSize: 30, color: "#64748b", maxWidth: 900 }}>
            Classes, assignments, rubrics and grading — in one focused place.
          </div>
        </div>

        <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden" }}>
          <div style={{ flex: 3, background: "#1e293b" }} />
          <div style={{ flex: 1, background: "#cbd5e1" }} />
          <div style={{ flex: 1, background: "#e2e8f0" }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
