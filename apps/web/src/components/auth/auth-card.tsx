interface AuthCardProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthCard({ title, description, icon, children, footer }: AuthCardProps) {
  return (
    <div className="flex animate-rise flex-col gap-6">
      <div className="flex flex-col gap-2">
        {icon && (
          <span className="mb-2 inline-flex size-14 animate-pop items-center justify-center rounded-2xl bg-primary-soft text-primary-soft-foreground [&_svg]:size-7">
            {icon}
          </span>
        )}
        <h1 className="text-[clamp(1.6rem,1.3rem+1.2vw,2.2rem)]">{title}</h1>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      {children}
      {footer && <div className="text-center text-sm text-muted-foreground">{footer}</div>}
    </div>
  );
}
