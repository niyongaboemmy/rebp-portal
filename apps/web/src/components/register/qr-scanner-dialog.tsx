"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorLike;
  }
}

/** Camera QR scanner for licence certificates (FR-REG-004), using the native BarcodeDetector. */
export default function QrScannerDialog({
  onResult,
  onClose,
}: {
  onResult: (raw: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations("verify");
  return (
    <Dialog open onOpenChange={(value) => !value && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("scanTitle")}</DialogTitle>
          <DialogDescription>{t("scanBody")}</DialogDescription>
        </DialogHeader>
        <QrScanner onResult={onResult} errorLabel={t("scanError")} />
      </DialogContent>
    </Dialog>
  );
}

function QrScanner({
  onResult,
  errorLabel,
}: {
  onResult: (raw: string) => void;
  errorLabel: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (!video.current || stopped) return;
        video.current.srcObject = stream;
        await video.current.play();
        const detector = new window.BarcodeDetector!({ formats: ["qr_code"] });
        const scan = async () => {
          if (stopped || !video.current) return;
          const [code] = await detector.detect(video.current).catch(() => []);
          if (code?.rawValue) return onResult(code.rawValue);
          frame = requestAnimationFrame(scan);
        };
        frame = requestAnimationFrame(scan);
      } catch {
        setFailed(true);
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [onResult]);

  if (failed) return <p className="text-sm font-medium text-destructive">{errorLabel}</p>;
  return (
    <div className="relative aspect-square overflow-hidden rounded-2xl bg-black">
      <video ref={video} muted playsInline className="size-full object-cover" />
      <div
        aria-hidden
        className="absolute inset-[18%] rounded-3xl border-4 border-white/85 shadow-[0_0_0_100vmax_rgb(0_0_0/0.45)]"
      />
      <div aria-hidden className="absolute inset-x-[18%] top-1/2 h-0.5 animate-pulse bg-sun" />
    </div>
  );
}
