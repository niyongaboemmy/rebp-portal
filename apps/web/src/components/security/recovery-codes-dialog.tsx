"use client";

import { Copy, Download } from "@/components/icons";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCopyToClipboard } from "@/hooks/use-copy";

/** Shows freshly generated recovery codes once, with copy and download. Lazy-loaded. */
export default function RecoveryCodesDialog({
  codes,
  onClose,
}: {
  codes: string[] | null;
  onClose: () => void;
}) {
  const t = useTranslations();
  const { copied, copy } = useCopyToClipboard();
  const text = codes?.join("\n") ?? "";

  const download = () => {
    const blob = new Blob([`${t("security.recovery.fileHeader")}\n\n${text}\n`], {
      type: "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: "rebp-recovery-codes.txt",
    });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={Boolean(codes)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("security.recovery.dialogTitle")}</DialogTitle>
          <DialogDescription>{t("security.recovery.dialogBody")}</DialogDescription>
        </DialogHeader>
        <ul
          className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-4 font-mono text-sm"
          data-testid="recovery-codes"
        >
          {codes?.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={() => copy(text)}>
            <Copy /> {copied ? t("common.copied") : t("common.copy")}
          </Button>
          <Button variant="outline" onClick={download}>
            <Download /> {t("common.download")}
          </Button>
          <Button onClick={onClose}>{t("security.recovery.saved")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
