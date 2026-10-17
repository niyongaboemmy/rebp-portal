import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { Loader2 } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * Flat, physical buttons (ADR-009 v3): no shadows. Feedback is motion and tone — the fill deepens
 * on hover, a press compresses to 97 % and springs back on release, a ripple spreads from the
 * touch point (<Interactions />), and a trailing arrow nudges forward on hover.
 *
 * Hierarchy: `default` = the one main action per view · `outline` = secondary actions and equal
 * alternatives (Cancel, Change, Share, Sign in) · `tonal` = supportive actions inside cards ·
 * `ghost` = tertiary and icon actions · `link` = inline navigation. All buttons are pills;
 * fields are not (see Input).
 */
export const buttonVariants = cva(
  "relative isolate inline-flex shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full text-sm font-semibold whitespace-nowrap transition-[background-color,border-color,color,transform] duration-(--dur-3) ease-spring outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/40 active:scale-[0.97] active:duration-(--dur-1) active:ease-out disabled:pointer-events-none disabled:opacity-55 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&>svg:last-child:not(:first-child)]:transition-transform [&>svg:last-child:not(:first-child)]:duration-(--dur-3) hover:[&>svg:last-child:not(:first-child)]:translate-x-0.5",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-[color-mix(in_oklch,var(--primary)_86%,black)]",
        tonal:
          // Opaque on hover too, so it reads the same over any surface (UX-035).
          "bg-primary-soft text-primary-soft-foreground hover:bg-[color-mix(in_oklch,var(--primary)_14%,var(--primary-soft))] dark:hover:bg-[color-mix(in_oklch,var(--primary)_22%,var(--primary-soft))]",
        secondary: "bg-primary-soft text-primary-soft-foreground hover:bg-primary/15",
        outline:
          "border border-foreground/12 bg-transparent text-foreground hover:border-foreground/20 hover:bg-foreground/[0.04]",
        ghost: "hover:bg-foreground/[0.06]",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-[color-mix(in_oklch,var(--destructive)_86%,black)]",
        accent: "bg-accent text-accent-foreground hover:bg-accent/80",
        link: "h-auto overflow-visible px-0 text-link underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        // Mobile-first: 44 px touch targets (UX-001), slightly denser from `sm` up.
        default: "h-11 px-4 sm:h-10",
        // 44 px on phones (UX-001, WCAG 2.5.8), compact from `sm` up.
        sm: "h-11 px-4 text-sm sm:h-9 sm:px-3.5 sm:text-xs",
        lg: "h-12 px-6 text-base",
        /** Floating action button: the single hero action on a mobile screen. */
        fab: "h-14 px-6 text-base",
        icon: "size-11 sm:size-10",
        "icon-sm": "size-11 sm:size-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && <Loader2 className="animate-spin" aria-hidden />}
          {children}
        </>
      )}
    </Comp>
  );
}
