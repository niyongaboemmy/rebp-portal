import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-transparent bg-secondary text-secondary-foreground",
        // "OK" is the primary family app-wide (UX-031): soft blue, never green.
        success: "border-transparent bg-primary-soft text-primary-soft-foreground",
        warning: "text-warning-strong border-transparent bg-warning-soft",
        danger: "border-transparent bg-danger-soft text-destructive",
        info: "border-transparent bg-info-soft text-info",
        neutral: "border-transparent bg-muted text-muted-foreground",
        outline: "text-muted-foreground",
        accent: "border-transparent bg-accent text-accent-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
