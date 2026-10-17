import { Inbox } from "@/components/icons";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { ConfirmationInbox, type InboxItem } from "@/components/applications/confirmation-inbox";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { asData } from "@/server/applications/applications";
import { requireCapability } from "@/server/auth/guards";
import { confirmationInbox } from "@/server/confirmations/confirmations";
import { db } from "@/server/db";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("confirmations"))("title") };
}

/**
 * Confirmation inbox (FR-F-007, FR-FIRM-003): supervision and affiliation requests addressed to
 * the user, answered one by one or in bulk. Addressees see a summary only (App. D), never the
 * applicant's documents or Section H.
 */
export default async function ConfirmationsPage({ searchParams }: PageProps<"/confirmations">) {
  const { user } = await requireCapability("confirmation.decide");
  const [t, locale, requests, query] = await Promise.all([
    getTranslations("confirmations"),
    getLocale(),
    confirmationInbox(user.id),
    searchParams,
  ]);
  const firmIds = [
    ...new Set(
      requests
        .map((r) => asData(r.application.data).f?.firmId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const firms = firmIds.length
    ? await db.firm.findMany({
        where: { id: { in: firmIds } },
        select: { id: true, legalName: true, tradingName: true },
      })
    : [];
  const firmName = new Map(firms.map((f) => [f.id, f.tradingName ?? f.legalName]));

  const items: InboxItem[] = requests.map((r) => {
    const data = asData(r.application.data);
    const name =
      [data.b?.givenNames, data.b?.surname].filter(Boolean).join(" ") ||
      r.application.applicant.fullName;
    return {
      id: r.id,
      kind: r.kind,
      status: r.status,
      reason: r.reason,
      createdAt: r.createdAt.toISOString(),
      dueAt: r.dueAt.toISOString(),
      reference: r.application.referenceNo,
      category: r.application.category,
      applicant: r.application.category === "REBF" ? (data.g?.legalName ?? name) : name,
      firm: data.f?.firmId ? (firmName.get(data.f.firmId) ?? null) : (data.f?.firmName ?? null),
      affiliationStart: data.f?.affiliationStart ?? null,
    };
  });

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {items.length === 0 ? (
        <EmptyState icon={Inbox} title={t("emptyTitle")} description={t("emptyBody")} />
      ) : (
        <ConfirmationInbox
          items={items}
          locale={locale}
          focus={typeof query.focus === "string" ? query.focus : undefined}
        />
      )}
    </>
  );
}
