import { MailCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth/auth-card";
import { VerifyContacts } from "@/components/auth/verify-contacts";
import { maskEmailForDisplay, maskPhoneForDisplay } from "@/lib/utils";
import { isFullyVerified } from "@/server/auth/account";
import { requireUser } from "@/server/auth/guards";
import { devCodeFor } from "@/server/notifications";

/** FR-ACC-001: both email and phone must be verified before application functions. */
export default async function VerifyPage() {
  const { user } = await requireUser({ requireVerified: false, allowPendingMfa: true });
  if (isFullyVerified(user)) redirect("/dashboard");
  const t = await getTranslations("auth.verify");

  return (
    <AuthCard title={t("title")} description={t("subtitle")} icon={<MailCheck />}>
      <VerifyContacts
        email={{
          display: maskEmailForDisplay(user.email),
          verified: Boolean(user.emailVerifiedAt),
          devCode: user.emailVerifiedAt ? null : await devCodeFor(user.email, "emailVerify"),
        }}
        phone={
          user.phone
            ? {
                display: maskPhoneForDisplay(user.phone),
                verified: Boolean(user.phoneVerifiedAt),
                devCode: user.phoneVerifiedAt ? null : await devCodeFor(user.phone, "phoneVerify"),
              }
            : null
        }
      />
    </AuthCard>
  );
}
