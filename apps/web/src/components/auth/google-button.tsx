import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { env } from "@/server/env";
import { GoogleSignInButton } from "./google-sign-in-button";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.4-1.66 4.1-5.5 4.1-3.31 0-6-2.74-6-6.2s2.69-6.2 6-6.2c1.88 0 3.15.8 3.87 1.49l2.64-2.54C16.84 3.2 14.65 2.2 12 2.2 6.92 2.2 2.8 6.32 2.8 11.4S6.92 20.6 12 20.6c5.31 0 8.83-3.73 8.83-8.98 0-.6-.07-1.06-.15-1.52H12z"
      />
    </svg>
  );
}

/** Google's button (ID-token sign-in, no client secret); a disabled placeholder when not configured. */
export async function GoogleButton({
  enabled,
  next,
  context = "signin",
}: {
  enabled: boolean;
  next?: string;
  context?: "signin" | "signup";
}) {
  const t = await getTranslations("auth");
  const clientId = env().GOOGLE_CLIENT_ID;
  if (!enabled || !clientId) {
    return (
      <Button
        variant="outline"
        size="lg"
        className="w-full rounded-full"
        disabled
        title={t("googleUnavailable")}
      >
        <GoogleMark /> {t("continueWithGoogle")}
      </Button>
    );
  }
  return <GoogleSignInButton clientId={clientId} context={context} next={next} />;
}

export async function OrDivider() {
  const t = await getTranslations("common");
  return (
    <div className="flex items-center gap-3 text-[0.7rem] font-bold tracking-widest text-muted-foreground uppercase">
      <span className="h-px flex-1 bg-linear-to-r from-transparent to-foreground/15" />
      <span className="rounded-full bg-foreground/[0.04] px-2.5 py-0.5 dark:bg-white/[0.05]">
        {t("or")}
      </span>
      <span className="h-px flex-1 bg-linear-to-l from-transparent to-foreground/15" />
    </div>
  );
}
