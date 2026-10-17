import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/server/http";
import { WEBHOOK_SIGNATURE_HEADER } from "@/server/payments/gateway";
import { processWebhook } from "@/server/payments/payments";

export const dynamic = "force-dynamic";

/**
 * Gateway webhook (FR-PAY-005, INT-010). Authenticated by an HMAC signature over the raw body;
 * idempotent by event id, so the gateway may retry freely.
 */
export async function POST(request: NextRequest) {
  try {
    const raw = await request.text();
    if (raw.length > 64_000)
      return NextResponse.json({ error: "errors.validation" }, { status: 413 });
    const outcome = await processWebhook(raw, request.headers.get(WEBHOOK_SIGNATURE_HEADER));
    return NextResponse.json({ received: true, outcome });
  } catch (error) {
    return errorResponse(error);
  }
}
