import { getTranslations } from "next-intl/server";
import { RegisterSkeleton } from "@/components/register/register-skeleton";

/** Directory: the full-screen map skeleton (same size and layout as the page). */
export default async function RegisterLoading() {
  const t = await getTranslations("common");
  return <RegisterSkeleton label={t("loading")} />;
}
