"use client";

import { ChevronDown, Laptop, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useErrorMessage } from "@/hooks/use-error-message";
import { revokeOtherSessionsAction, revokeSessionAction } from "@/server/actions/security";

export interface SessionRow {
  id: string;
  device: string | null;
  ipAddress: string | null;
  lastActive: string;
  method: string;
  current: boolean;
}

/** Sessions shown before "Show all": the current device plus the most recent others. */
const COLLAPSED = 4;

export function SessionsList({ sessions }: { sessions: SessionRow[] }) {
  const t = useTranslations("security.sessions");
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [busy, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  // Current device first, so it is never hidden behind "Show all".
  const ordered = [...sessions.filter((s) => s.current), ...sessions.filter((s) => !s.current)];
  const visible = expanded ? ordered : ordered.slice(0, COLLAPSED);
  const hidden = ordered.length - visible.length;

  const revoke = (id: string) =>
    startTransition(async () => {
      const result = await revokeSessionAction(id);
      if (!result.ok) return void toast.error(errorMessage(result.error));
      toast.success(t("revoked"));
      router.refresh();
    });

  const revokeOthers = () =>
    startTransition(async () => {
      const result = await revokeOtherSessionsAction();
      if (!result.ok) return void toast.error(errorMessage(result.error));
      toast.success(t("revokedOthers", { count: result.data.count }));
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y rounded-xl border">
        {visible.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 p-4">
            <Laptop className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="flex flex-wrap items-center gap-2 font-medium">
                {s.device ?? t("unknownDevice")}
                {s.current && <Badge variant="success">{t("current")}</Badge>}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("lastActive", { time: s.lastActive })} ·{" "}
                {t("signedInWith", { method: s.method })}
                {s.ipAddress ? ` · ${s.ipAddress}` : ""}
              </span>
            </div>
            {!s.current && (
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => revoke(s.id)}>
                {t("revoke")}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <Button variant="ghost" className="self-start" onClick={() => setExpanded(true)}>
          <ChevronDown /> {t("showAll", { count: ordered.length })}
        </Button>
      )}
      {sessions.length > 1 && (
        <Button variant="outline" className="self-start" disabled={busy} onClick={revokeOthers}>
          <LogOut /> {t("revokeOthers")}
        </Button>
      )}
    </div>
  );
}
