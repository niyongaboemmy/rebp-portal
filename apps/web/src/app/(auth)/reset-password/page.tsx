import { KeyRound } from "lucide-react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { emailSchema } from "@rebp/contracts";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/password-recovery-forms";
import { Alert } from "@/components/ui/alert";

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const params = await searchParams;
  const parsed = emailSchema.safeParse(params.email);
  if (!parsed.success) redirect("/forgot-password");
  const t = await getTranslations("auth");
  return (
    <AuthCard title={t("reset.title")} description={t("reset.subtitle")} icon={<KeyRound />}>
      {params.sent === "1" && (
        <Alert variant="info">{t("forgot.sent", { email: parsed.data })}</Alert>
      )}
      <ResetPasswordForm email={parsed.data} />
    </AuthCard>
  );
}
