"use client";

import { ChevronRight, ShieldAlert, ShieldCheck, UserX } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { PermissionMatrix } from "@rebp/contracts";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { UserRow } from "@/server/access/users";
import { RoleChip } from "./role-chip";

// The drawer (with its live preview logic) loads only when someone opens it.
const ManageAccessSheet = dynamic(() => import("./manage-access-sheet"));

interface PeopleListProps {
  users: UserRow[];
  currentUserId: string;
  matrix: PermissionMatrix;
  canManage: boolean;
}

export function PeopleList({ users, currentUserId, matrix, canManage }: PeopleListProps) {
  const t = useTranslations("access.people");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = users.find((u) => u.id === selectedId) ?? null;

  return (
    <>
      <ul className="flex flex-col gap-2.5" data-testid="people-list">
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
                className="group flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left transition-all outline-none hover:border-primary/40 hover:bg-surface-2 focus-visible:ring-[3px] focus-visible:ring-ring/40 active:scale-[0.995] sm:gap-4 sm:p-4"
              >
                <div className="relative">
                  <Avatar name={user.fullName} className="size-11" />
                  {user.disabled && (
                    <span className="absolute -right-1 -bottom-1 inline-flex size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground ring-2 ring-[var(--card)]">
                      <UserX className="size-3" aria-hidden />
                    </span>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate font-semibold">{user.fullName}</span>
                    {isSelf && <Badge variant="info">{t("you")}</Badge>}
                    {user.disabled && <Badge variant="danger">{t("disabled")}</Badge>}
                    {user.accountType === "ORGANISATION" && (
                      <Badge variant="outline">{t("organisation")}</Badge>
                    )}
                  </div>
                  <span className="truncate text-sm text-muted-foreground">{user.email}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {user.roles.map((role) => (
                      <RoleChip key={role} role={role} />
                    ))}
                  </div>
                </div>
                <div className="hidden shrink-0 flex-col items-end gap-1.5 text-xs md:flex">
                  {user.mfaMethods.length > 0 ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-success">
                      <ShieldCheck className="size-3.5" aria-hidden /> {t("mfaOn")}
                    </span>
                  ) : (
                    <span className="text-warning-strong inline-flex items-center gap-1 font-semibold">
                      <ShieldAlert className="size-3.5" aria-hidden /> {t("noMfa")}
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {user.lastSignInAt
                      ? t("lastSignIn", { date: formatDate(user.lastSignInAt) })
                      : t("neverSignedIn")}
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors group-hover:text-link">
                  <span className="hidden sm:inline">
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
