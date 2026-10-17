import { useTranslations } from "next-intl";
import {
  APPLICATION_STATUS_TONES,
  LICENSE_STATUS_TONES,
  PAYMENT_STATUS_TONES,
  type ApplicationStatus,
  type LicenseStatus,
  type PaymentStatus,
} from "@rebp/contracts";
import { StatusBadge } from "@/components/ui/status-badge";

/** Status chips with the contract tone + icon + translated label (ADR-009, WCAG 1.4.1). */
export function ApplicationStatusBadge({
  status,
  size,
  className,
}: {
  status: ApplicationStatus;
  size?: "sm" | "lg";
  className?: string;
}) {
  const t = useTranslations("status.application");
  return (
    <StatusBadge
      tone={APPLICATION_STATUS_TONES[status]}
      label={t(status)}
      size={size}
      className={className}
    />
  );
}

export function LicenceStatusBadge({
  status,
  size,
  className,
}: {
  status: LicenseStatus;
  size?: "sm" | "lg";
  className?: string;
}) {
  const t = useTranslations("status.licence");
  return (
    <StatusBadge
      tone={LICENSE_STATUS_TONES[status]}
      label={t(status)}
      size={size}
      className={className}
    />
  );
}

export function PaymentStatusBadge({
  status,
  className,
}: {
  status: PaymentStatus;
  className?: string;
}) {
  const t = useTranslations("payment.status");
  return (
    <StatusBadge tone={PAYMENT_STATUS_TONES[status]} label={t(status)} className={className} />
  );
}
