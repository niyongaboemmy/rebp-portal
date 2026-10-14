import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { requiresMfa } from "@rebp/contracts";
import { ContactCard } from "@/components/security/contact-card";
import { MfaCard } from "@/components/security/mfa-card";
import { ProtectionSummary } from "@/components/security/protection-summary";
import { SessionsList } from "@/components/security/sessions-list";
import { SignInMethodsCard } from "@/components/security/sign-in-methods-card";
import { StepUpProvider } from "@/components/security/step-up";
import { Alert } from "@/components/ui/alert";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  describeUserAgent,
  formatDate,
  formatDateTime,
  maskEmailForDisplay,
  maskPhoneForDisplay,
} from "@/lib/utils";
import { requireUser } from "@/server/auth/guards";
import { remainingRecoveryCodes } from "@/server/auth/mfa";
import { listActiveSessions } from "@/server/auth/session";
import { db } from "@/server/db";
import { isGoogleEnabled } from "@/server/env";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("security"))("title") };
}

/** FR-ACC-004/007/008/010: the user's sign-in, two-step and session preferences in one place. */
export default async function SecurityPage({ searchParams }: PageProps<"/settings/security">) {
  const { user, session } = await requireUser({ allowPendingMfa: true });
  const params = await searchParams;
  const [t, tAuth, google, recoveryRemaining] = await Promise.all([
    getTranslations("security"),
    getTranslations("auth.oauthErrors"),
    db.oAuthAccount.findUnique({
      where: { userId_provider: { userId: user.id, provider: "google" } },
    }),
    remainingRecoveryCodes(user.id),
  ]);
  const error = typeof params.error === "string" ? params.error : null;
  const mfaRequired = requiresMfa(user.roles);

  return (
    <StepUpProvider hasPassword={Boolean(user.passwordHash)}>
      <PageHeader title={t("title")} description={t("subtitle")} />

      {params.setup === "required" && mfaRequired && user.mfaMethods.length === 0 && (
        <Alert variant="warning">{t("requiredBanner")}</Alert>
      )}
      {params.linked === "google" && <Alert variant="success">{t("linked")}</Alert>}
      {error && (
        <Alert variant="danger">
          {tAuth.has(error) ? tAuth(error as "oauthFailed") : tAuth("oauthFailed")}
        </Alert>
      )}

      <ProtectionSummary
        emailVerified={Boolean(user.emailVerifiedAt)}
        phoneVerified={Boolean(user.phoneVerifiedAt)}
        twoStepOn={user.mfaMethods.length > 0}
        recoveryRemaining={recoveryRemaining}
      />

      <MfaCard
        enabled={user.mfaMethods}
        preferred={user.mfaPreferred}
        phoneVerified={Boolean(user.phoneVerifiedAt)}
        destinations={{
          SMS: user.phone ? maskPhoneForDisplay(user.phone) : null,
          EMAIL: maskEmailForDisplay(user.email),
        }}
        recoveryRemaining={recoveryRemaining}
        required={mfaRequired}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <SignInMethodsCard
          hasPassword={Boolean(user.passwordHash)}
          passwordChangedAt={user.passwordChangedAt ? formatDate(user.passwordChangedAt) : null}
          google={{
            linked: Boolean(google),
            email: google?.email ?? null,
            available: isGoogleEnabled(),
          }}
        />
        <ContactCard
          email={{ value: user.email, verified: Boolean(user.emailVerifiedAt) }}
          phone={{ value: user.phone, verified: Boolean(user.phoneVerifiedAt) }}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("sessions.title")}</CardTitle>
          <CardDescription>{t("sessions.description")}</CardDescription>
        </CardHeader>
        <Suspense fallback={<Skeleton className="h-40" />}>
          <Sessions userId={user.id} currentId={session.id} />
        </Suspense>
      </Card>
    </StepUpProvider>
  );
}

/** Streamed separately so the rest of the page renders first. */
async function Sessions({ userId, currentId }: { userId: string; currentId: string }) {
  const sessions = await listActiveSessions(userId);
  return (
    <SessionsList
      sessions={sessions.map((s) => ({
        id: s.id,
        device: describeUserAgent(s.userAgent),
        ipAddress: s.ipAddress,
        lastActive: formatDateTime(s.lastActiveAt),
        method: s.method === "google" ? "Google" : "Password",
        current: s.id === currentId,
      }))}
    />
  );
}
