import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";

/** Licence flags the holder must act on (BR-050, FR-F-010, FR-REN-002). */
export const LICENCE_FLAGS = [
  "SUPERVISION_REQUIRED",
  "AFFILIATION_REQUIRED",
  "RENEWAL_PENDING",
] as const;
export type LicenceFlag = (typeof LICENCE_FLAGS)[number];

export const knownFlags = (flags: readonly string[]): LicenceFlag[] =>
  LICENCE_FLAGS.filter((f) => flags.includes(f));

/** One warning alert per known flag; renders nothing when there are none. */
export function LicenceFlags({ flags }: { flags: readonly string[] }) {
  const t = useTranslations("wallet.flags");
  const shown = knownFlags(flags);
  if (shown.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {shown.map((flag) => (
        <Alert key={flag} variant="warning" title={t(`${flag}.title`)}>
          {t(`${flag}.body`)}
        </Alert>
      ))}
    </div>
  );
}
