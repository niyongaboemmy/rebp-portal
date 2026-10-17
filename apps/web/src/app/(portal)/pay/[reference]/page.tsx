import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { SandboxCheckout } from "@/components/applications/sandbox-checkout";
import { formatMoney } from "@/lib/format";
import { requireCapability } from "@/server/auth/guards";
import { db } from "@/server/db";
import { NO_INDEX } from "@/server/seo";
import { sandboxEnabled } from "@/server/payments/payments";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("payments.sandbox"))("title"), robots: NO_INDEX };
}

/**
 * Sandbox payment gateway (ADR-005, INT-023). In production this is the aggregator's hosted page;
 * here it simulates the payer's choice and reports back through the same signed webhook.
 */
export default async function SandboxPage({ params }: PageProps<"/pay/[reference]">) {
  const { user } = await requireCapability("payments.pay");
  const { reference } = await params;
  // The sandbox gateway never runs in production (security review H1).
  if (!sandboxEnabled()) notFound();
  const payment = await db.payment.findUnique({
    where: { reference: decodeURIComponent(reference) },
    include: { application: { select: { id: true, referenceNo: true } } },
  });
  if (!payment || payment.payerId !== user.id) notFound();
  const locale = await getLocale();
  return (
    <SandboxCheckout
      reference={payment.reference}
      applicationId={payment.application.id}
      applicationRef={payment.application.referenceNo}
      amount={formatMoney(payment.amount, payment.currency, locale)}
      method={payment.method ?? "CARD"}
      msisdn={payment.msisdn}
      status={payment.status}
    />
  );
}
