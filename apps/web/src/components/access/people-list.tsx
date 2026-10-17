"use client";

import { ChevronRight, ShieldCheck, UserX } from "@/components/icons";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { PermissionMatrix } from "@rebp/contracts";
import {
  ATTENTION_CHIP,
  ATTENTION_DOT,
  LIST_GROUP,
  LIST_ROW,
  LIST_ROW_HOVER,
  OK_CHIP,
} from "@/components/admin/surfaces";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";
import type { UserRow } from "@/server/access/users";
import { RoleChip } from "./role-chip";

// The drawer (with its live preview logic) loads only when someone opens it.
const ManageAccessSheet = dynamic(() => import("./manage-access-sheet"));

interface PeopleListProps {
  users: UserRow[];
  currentUserId: string;
  matrix: PermissionMatrix;
  canManage: boolean;
  /** Profile photos by user id (UX-035); initials when absent. */
  photos?: Record<string, string>;
}

export function PeopleList({
  users,
  currentUserId,
  matrix,
  canManage,
  photos = {},
}: PeopleListProps) {
  const t = useTranslations("access.people");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = users.find((u) => u.id === selectedId) ?? null;

  return (
    <>
      <ul className={LIST_GROUP} data-testid="people-list">
        {users.map((user, index) => {
          const isSelf = user.id === currentUserId;
          return (
            <li
              key={user.id}
              className="animate-in fill-mode-both fade-in slide-in-from-bottom-1"
              style={{ animationDelay: `${index * 25}ms` }}
            >
              <button
                type="button"
                onClick={() => setSelectedId(user.id)}
                data-testid={`person-${user.email}`}
                className={cn(
                  "group flex w-full items-center gap-3 text-left outline-none focus-visible:bg-primary/[0.05] focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:ring-inset @xl/main:gap-4",
                  LIST_ROW,
                  LIST_ROW_HOVER,
                  "py-3",
                )}
              >
                <div className="relative">
                  <Avatar name={user.fullName} src={photos[user.id]} className="size-10" />
                  {user.disabled && (
                    <span className="absolute -right-1 -bottom-1 inline-flex size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground ring-2 ring-card">
                      <UserX className="size-3" aria-hidden />
                    </span>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate font-semibold">{user.fullName}</span>
                    {isSelf && <span className={OK_CHIP}>{t("you")}</span>}
                    {user.disabled && <Badge variant="danger">{t("disabled")}</Badge>}
                    {user.accountType === "ORGANISATION" && (
                      <Badge variant="neutral">{t("organisation")}</Badge>
                    )}
                  </div>
                  <span className="truncate text-sm text-muted-foreground">{user.email}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {user.roles.map((role) => (
                      <RoleChip key={role} role={role} />
                    ))}
                  </div>
                </div>
                <div className="hidden shrink-0 flex-col items-end gap-1.5 text-xs @3xl/main:flex">
                  {user.mfaMethods.length > 0 ? (
                    <span className={OK_CHIP}>
                      <ShieldCheck aria-hidden /> {t("mfaOn")}
                    </span>
                  ) : (
                    <span className={ATTENTION_CHIP}>
                      <span aria-hidden className={ATTENTION_DOT} /> {t("noMfa")}
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {user.lastSignInAt
                      ? t("lastSignIn", { date: formatDate(user.lastSignInAt) })
                      : t("neverSignedIn")}
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors group-hover:text-link">
                  <span className="hidden @xl/main:inline">
                    {canManage && !isSelf ? t("manage") : t("view")}
                  </span>
                  <ChevronRight
                    className="size-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {selected && (
        <ManageAccessSheet
          key={selected.id}
          user={selected}
          matrix={matrix}
          editable={canManage && selected.id !== currentUserId}
          isSelf={selected.id === currentUserId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  );
}
