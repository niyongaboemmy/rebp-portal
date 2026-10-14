import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-[background-color,color,box-shadow,transform] duration-(--dur-2) ease-standard outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/40 active:scale-[0.97] active:duration-(--dur-1) disabled:pointer-events-none disabled:opacity-55 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary btn-gloss text-primary-foreground hover:bg-primary/90",
        /** Secondary emphasis: brand-tinted fill (ADR-009 hierarchy). */
        tonal: "bg-primary-soft text-primary-soft-foreground hover:bg-primary-soft/75",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline: "border border-input bg-card hover:bg-muted",
        ghost: "hover:bg-muted",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        accent: "bg-accent text-accent-foreground hover:bg-accent/80",
        link: "h-auto px-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        // Mobile-first: 44 px touch targets (UX-001), slightly denser from `sm` up.
        default: "h-11 px-4 sm:h-10",
        // 44 px on phones (UX-001, WCAG 2.5.8), compact from `sm` up.
        sm: "h-11 rounded-xl px-4 text-sm sm:h-9 sm:rounded-lg sm:px-3 sm:text-xs",
        lg: "h-12 rounded-2xl px-6 text-base",
        /** Floating action button: the single hero action on a mobile screen. */
        fab: "h-14 rounded-2xl px-5 text-base shadow-3",
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
