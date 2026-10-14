"use client";

import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Cake,
  ClipboardCheck,
  GraduationCap,
  Hourglass,
  MapPin,
  PenLine,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  CATEGORY_INFO,
  CATEGORY_REQUIREMENTS,
  PRECHECK_DOCUMENTS,
  type Category,
} from "@rebp/contracts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Requirements sheet for one category, loaded on the first tap of a ladder rung. */
export default function CategoryDetailDialog({
  category,
  onClose,
}: {
  category: Category | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={category !== null} onOpenChange={(value) => !value && onClose()}>
      <DialogContent>{category && <CategoryDetail category={category} />}</DialogContent>
    </Dialog>
  );
}

function CategoryDetail({ category }: { category: Category }) {
  const t = useTranslations("ladder");
  const tc = useTranslations("categories");
  const td = useTranslations("eligibility.documents");
  const r = CATEGORY_REQUIREMENTS[category];
  const isFirm = category === "REBF";
  const rows = [
    r.adult && { icon: Cake, title: t("req.adult") },
    r.education && { icon: GraduationCap, title: t(`education.${r.education}`) },
    r.training && { icon: ClipboardCheck, title: t("req.training") },
    r.exam && { icon: PenLine, title: t("req.examFull") },
    r.experience && {
      icon: Hourglass,
      title: t("req.experience", {
        years: r.experience.years,
        category: CATEGORY_INFO[r.experience.as].abbreviation,
      }),
    },
    r.prerequisite && {
      icon: BadgeCheck,
      title: t("req.licence", { category: tc(`items.${r.prerequisite}.name`) }),
    },
    r.supervised && { icon: UserCheck, title: t("req.supervisedFull") },
    isFirm && { icon: Building2, title: t("req.firm") },
    category === "FSLA" && { icon: MapPin, title: t("req.territory") },
  ].filter(Boolean) as { icon: typeof Cake; title: string }[];

  return (
    <>
      <DialogHeader>
        <span className="font-mono text-xs font-bold text-link">
          {CATEGORY_INFO[category].section} · {CATEGORY_INFO[category].abbreviation}
        </span>
        <DialogTitle>{tc(`items.${category}.name`)}</DialogTitle>
        <DialogDescription>{tc(`items.${category}.summary`)}</DialogDescription>
      </DialogHeader>
      <ul className="flex flex-col gap-2">
        {rows.map(({ icon: Icon, title }, i) => (
          <li
            key={title}
            className="flex animate-rise items-center gap-3 rounded-xl bg-surface-2 p-3 text-sm font-medium"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
              <Icon className="size-[1.1rem]" aria-hidden />
            </span>
            {title}
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
          {t("prepare")}
        </span>
        <ul className="flex flex-wrap gap-1.5">
          {PRECHECK_DOCUMENTS[category].map((doc) => (
            <li key={doc} className="rounded-full border px-2.5 py-1 text-xs font-medium">
              {td(doc)}
            </li>
          ))}
        </ul>
      </div>
      <Button asChild size="lg">
        <Link href="/eligibility">
          {t("check")} <ArrowRight />
        </Link>
      </Button>
    </>
  );
}
