import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { CV_DOCUMENT_TYPES, type DocumentType } from "@rebp/contracts";
import { SettingsTabs } from "@/components/layout/settings-tabs";
import { CvEditor } from "@/components/profile/cv-editor";
import { requireUser, safeNextPath } from "@/server/auth/guards";
import { cvOf } from "@/server/profile/cv";
import { accountAvatar, listProfileDocuments } from "@/server/profile/documents";
import { needsProfile, profileContext, profileOf } from "@/server/profile/profile";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("cv"))("title") };
}

/**
 * The applicant's CV (UX-018): education, training and experience kept on the account and reused
 * by every application, with their certificates and letters.
 */
export default async function CvPage({ searchParams }: PageProps<"/settings/cv">) {
  const { user } = await requireUser({ allowIncompleteProfile: true });
  // Organisations and staff keep no CV.
  if (!needsProfile(user)) redirect("/settings/security");
  // Opened from an application or the start of one (UX-021): which part, which answer, and back.
  const query = await searchParams;
  const one = (key: string) =>
    typeof query[key] === "string" ? (query[key] as string) : undefined;
  const part = one("part");
  const next = one("next") ? safeNextPath(one("next")!) : undefined;
  const [t, locale, context, cv, documents, avatar] = await Promise.all([
    getTranslations("profile"),
    getLocale(),
    profileContext(),
    cvOf(user),
    listProfileDocuments(user.id),
    accountAvatar(user),
  ]);
  const profile = profileOf(user);

  return (
    <CvEditor
      initial={cv}
      context={context}
      locale={locale}
      email={user.email}
      phone={user.phone}
      name={user.fullName}
      nav={<SettingsTabs current="cv" />}
      part={part === "c" || part === "d" || part === "e" ? part : undefined}
      focus={one("focus")}
      next={next}
      avatar={{
        ...avatar,
        label: avatar.percent === null ? user.fullName : t("progress", { percent: avatar.percent }),
      }}
      person={{
        name: [profile.givenNames, profile.surname].filter(Boolean).join(" ") || user.fullName,
        occupation: profile.occupation,
        email: user.email,
        phone: user.phone,
        photoHref: avatar.photoHref,
      }}
      documents={documents
        .filter((d) => CV_DOCUMENT_TYPES.includes(d.type as DocumentType))
        .map((d) => ({
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
