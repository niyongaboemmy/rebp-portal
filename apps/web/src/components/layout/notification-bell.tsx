"use client";

import { useTranslations } from "next-intl";
import type { Route } from "next";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Bell } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { relativeLabel } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import { markNotificationsReadAction, notificationsAction } from "@/server/actions/inbox";

interface Item {
  id: string;
  code: string;
  messageKey: string;
  values: Record<string, string | number>;
  href: string | null;
  read: boolean;
  createdAt: string;
}

/**
 * In-app notifications (FR-NOT-002, Appendix C). Messages are stored as i18n keys, so they render
 * in the reader's current language. Polls gently while the tab is visible; opening marks them read.
 */
export function NotificationBell({ className }: { className?: string }) {
  const t = useTranslations("notificationsUi");
  const ti = useTranslations("inbox");
  const tt = useTranslations("time");
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    const load = () =>
      notificationsAction().then((result) => {
        if (!alive || !result.ok) return;
        setItems(result.data.items);
        setUnread(result.data.unread);
      });
    void load();
    const timer = setInterval(() => document.visibilityState === "visible" && void load(), 60_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const onOpenChange = (open: boolean) => {
    if (open && unread > 0)
      startTransition(async () => {
        await markNotificationsReadAction();
        setUnread(0);
      });
    if (!open) setItems((list) => list.map((i) => ({ ...i, read: true })));
  };

  const now = new Date();
  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={unread > 0 ? t("labelUnread", { count: unread }) : t("label")}
          className={cn("relative", className)}
        >
          <Bell className="size-5" />
          {unread > 0 && (
            <span
              aria-hidden
              className="absolute top-1.5 right-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[0.625rem] leading-4 font-bold num text-card"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-1.5">
        <DropdownMenuLabel>{t("title")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="flex max-h-[60vh] flex-col overflow-auto">
            {items.map((item) => {
              const key = item.messageKey as "submitted";
              const body = (
                <>
                  <span className="flex items-center gap-2">
                    {!item.read && (
                      <span aria-hidden className="size-2 shrink-0 rounded-full bg-primary" />
                    )}
                    <span className="text-sm font-semibold">
                      {ti.has(`${key}.title`) ? ti(`${key}.title`, item.values) : item.code}
                    </span>
                  </span>
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    {ti.has(`${key}.body`) ? ti(`${key}.body`, item.values) : ""}
                  </span>
                  <span className="text-[0.7rem] text-muted-foreground">
                    {relativeLabel(new Date(item.createdAt), now, tt, (d) =>
                      d.toLocaleDateString(),
                    )}
                  </span>
                </>
              );
              return (
                <li key={item.id}>
                  {item.href ? (
                    <Link
                      href={item.href as Route}
                      className="flex flex-col gap-1 rounded-xl px-3 py-2.5 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="flex flex-col gap-1 px-3 py-2.5">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
