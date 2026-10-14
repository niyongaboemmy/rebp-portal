import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "@/components/icons";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "flex gap-3 rounded-xl p-4 text-sm [&>svg]:mt-0.5 [&>svg]:size-5 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        info: "bg-info-soft text-foreground [&>svg]:text-info",
        success: "bg-success-soft text-foreground [&>svg]:text-success",
        warning: "bg-warning-soft text-foreground [&>svg]:text-warning",
        danger: "bg-danger-soft text-foreground [&>svg]:text-destructive",
      },
    },
    defaultVariants: { variant: "info" },
  },
);

const ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
} as const;

interface AlertProps
  extends Omit<React.ComponentProps<"div">, "title">, VariantProps<typeof alertVariants> {
  title?: React.ReactNode;
}

export function Alert({ className, variant = "info", title, children, ...props }: AlertProps) {
  const Icon = ICONS[variant ?? "info"];
  return (
    <div
      role={variant === "danger" ? "alert" : "status"}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      <Icon aria-hidden />
      <div className="flex min-w-0 flex-col gap-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && (
          <div className="text-muted-foreground [&_a]:text-link [&_a]:underline">{children}</div>
        )}
      </div>
    </div>
  );
}
