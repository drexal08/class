import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    databaseUrlPrefix: process.env.DATABASE_URL?.slice(0, 30) || "not set",
    deploymentTarget: process.env.DEPLOYMENT_TARGET,
    nodeEnv: process.env.NODE_ENV,
  });
}
