import { NextResponse, type NextRequest } from "next/server";
import { safeEqual } from "@/server/auth/crypto";
import { env } from "@/server/env";
import { runScheduledJobs } from "@/server/jobs/lifecycle";

export const dynamic = "force-dynamic";

/** Scheduler entry point (cron): renewal reminders, expiry, lapse, timers, reconciliation. */
export async function POST(request: NextRequest) {
  const secret = env().CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`))
    return NextResponse.json({ error: "errors.forbidden" }, { status: 403 });
  return NextResponse.json(await runScheduledJobs());
}
