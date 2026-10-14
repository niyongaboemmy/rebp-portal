import { SketchUnderline } from "@/components/motion/sketch-underline";

interface AuthCardProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * Content of an auth page inside the layout's glass card: an optional gradient icon tile, the
 * title with the landing page's Sun underline, one line, the form, and a footer link.
 */
export function AuthCard({ title, description, icon, children, footer }: AuthCardProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        {icon && (
          <span className="mb-2 inline-flex size-14 animate-pop items-center justify-center rounded-2xl bg-[linear-gradient(140deg,var(--primary),color-mix(in_oklch,var(--primary)_65%,var(--sky)))] text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_12px_24px_-12px_oklch(0.45_0.2_264/0.6)] [&_svg]:size-7">
            {icon}
          </span>
        )}
        <h1 className="text-[clamp(1.6rem,1.3rem+1.2vw,2.1rem)] leading-tight font-bold tracking-[-0.025em]">
          {title}
        </h1>
        <SketchUnderline className="-mt-1 h-2 w-24 sm:h-2.5 sm:w-28" />
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      {children}
      {footer && (
        <div className="-mx-2 rounded-2xl bg-foreground/[0.035] px-4 py-3 text-center text-sm text-muted-foreground dark:bg-white/[0.04]">
          {footer}
        </div>
      )}
    </div>
  );
}
