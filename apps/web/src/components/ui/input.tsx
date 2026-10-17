import { cn } from "@/lib/utils";

/**
 * The one text-field look for the whole app: transparent (no fill), a soft hairline border,
 * rounded-lg corners (buttons are the pills, fields are not), 48px tall for touch. Hover
 * strengthens the border; focus turns it brand blue with a soft ring; errors turn it red with
 * one small shake.
 */
export const inputClass = cn(
  "h-12 w-full min-w-0 rounded-lg border border-input bg-transparent px-3.5 text-base transition-[border-color,box-shadow] duration-(--dur-2) outline-none placeholder:text-muted-foreground/70 hover:border-foreground/30 sm:text-sm",
  "focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/15",
  "aria-invalid:animate-shake aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/15",
  "disabled:cursor-not-allowed disabled:opacity-60",
  "[&:-webkit-autofill]:[-webkit-text-fill-color:var(--foreground)] [&:-webkit-autofill]:[transition:background-color_9999s]",
);

interface InputProps extends React.ComponentProps<"input"> {
  /** Icon or prefix inside the field, before the text (e.g. a mail icon, "RW"). */
  leading?: React.ReactNode;
  /** Icon or button inside the field, after the text (e.g. show password). */
  trailing?: React.ReactNode;
}

/**
 * Text field. `leading`/`trailing` place adornments inside the border; the leading one turns
 * brand blue while the field has focus. All other props (id, aria-*) land on the <input>, so it
 * works with <FieldControl>.
 */
export function Input({ className, type, leading, trailing, ...props }: InputProps) {
  const input = (
    <input
      type={type}
      data-slot="input"
      className={cn(inputClass, leading && "pl-11", trailing && "pr-12", className)}
      {...props}
    />
  );
  if (!leading && !trailing) return input;
  return (
    <div className="group/input relative">
      {leading && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-muted-foreground transition-colors group-focus-within/input:text-link [&_svg]:size-[1.1rem]"
        >
          {leading}
        </span>
      )}
      {input}
      {trailing && (
        <span className="absolute inset-y-0 right-1.5 flex items-center">{trailing}</span>
      )}
    </div>
  );
}
