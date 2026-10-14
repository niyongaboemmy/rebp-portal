import { KeyRound } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/password-recovery-forms";

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth.forgot");
  return (
    <AuthCard title={t("title")} description={t("subtitle")} icon={<KeyRound />}>
      <ForgotPasswordForm />
    </AuthCard>
  );
}
