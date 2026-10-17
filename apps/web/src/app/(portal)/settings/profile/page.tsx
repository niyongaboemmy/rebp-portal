import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { SettingsTabs } from "@/components/layout/settings-tabs";
import { ProfileForm } from "@/components/profile/profile-form";
import { requireUser, safeNextPath } from "@/server/auth/guards";
import { db } from "@/server/db";
import type { DocumentType } from "@rebp/contracts";
import { listProfileDocuments } from "@/server/profile/documents";
import { needsProfile, profileContext, profileOf } from "@/server/profile/profile";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("profile"))("title") };
}

/**
 * The applicant profile (UX-010): personal details entered once, reused by every application.
 * Reachable while incomplete (everything else sends the applicant here first, then back).
 */
export default async function ProfilePage({ searchParams }: PageProps<"/settings/profile">) {
  const { user } = await requireUser({ allowIncompleteProfile: true });
  // Organisations and staff have no personal profile to keep.
  if (!needsProfile(user)) redirect("/settings/security");
  const query = await searchParams;
  const welcome = query.welcome === "1";
  const next = safeNextPath(typeof query.next === "string" ? query.next : null);
  const [locale, context, provinces, documents] = await Promise.all([
    getLocale(),
    profileContext(),
    db.adminDivision.findMany({
      where: { level: 1 },
      orderBy: { code: "asc" },
      select: { code: true, name: true, level: true },
    }),
    listProfileDocuments(user.id),
  ]);

  return (
    <ProfileForm
      initial={profileOf(user)}
      context={context}
      provinces={provinces}
      locale={locale}
      email={user.email}
      phone={user.phone}
      name={user.fullName}
      welcome={welcome}
      next={next}
      nav={<SettingsTabs current="profile" />}
      documents={documents.map((d) => ({
        id: d.id,
        type: d.type as DocumentType,
        status: d.status,
        fileName: d.fileName,
        size: d.size,
        mimeType: d.mimeType,
        version: 1,
        officerNote: null,
        href: `/api/profile/documents/${d.id}`,
      }))}
    />
  );
}
