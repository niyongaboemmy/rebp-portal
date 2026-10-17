import Link from "next/link";
import { ProgressRing } from "@/components/data/progress-ring";
import { initials } from "@/lib/utils";

/**
 * The profile photo in its completion ring, as the Security and My access heroes show it
 * (UX-013): the same frame as the profile page's editable avatar, linking there. Accounts without
 * a personal profile (staff, organisations) get their initials in a full ring and no percentage.
 */
export function AccountAvatar({
  name,
  percent,
  photoHref,
  label,
}: {
  name: string;
  /** Profile completion, or null when the account keeps no personal profile. */
  percent: number | null;
  photoHref: string | null;
  label: string;
}) {
  const ring = (
    <span className="relative block size-20 @md/main:size-24 @3xl/main:size-28">
      <ProgressRing
        value={percent ?? 100}
        total={100}
        thickness={3}
        className="absolute inset-0 size-full"
      />
      <span className="absolute inset-[15%] grid place-items-center overflow-hidden rounded-full bg-primary-soft text-lg font-bold text-primary-soft-foreground @md/main:text-xl">
        {photoHref ? (
          // eslint-disable-next-line @next/next/no-img-element -- authorised, per-user file
          <img src={photoHref} alt="" className="size-full object-cover" />
        ) : (
          <span aria-hidden>{initials(name)}</span>
        )}
      </span>
    </span>
  );
  return (
    <div className="relative shrink-0">
      {percent === null ? (
        <span role="img" aria-label={label} className="block">
          {ring}
        </span>
      ) : (
        <Link
          href="/settings/profile"
          aria-label={label}
          className="block rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
        >
          {ring}
        </Link>
      )}
      {percent !== null && (
        <span
          aria-hidden
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2 py-0.5 text-[0.7rem] font-bold num text-primary-foreground shadow-[0_4px_10px_-4px_var(--primary)]"
        >
          {percent}%
        </span>
      )}
    </div>
  );
}
