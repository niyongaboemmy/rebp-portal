"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

export function Toaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="top-center"
      richColors
      closeButton
      offset={20}
      toastOptions={{
        classNames: {
          toast:
            "rounded-2xl! font-sans! backdrop-blur-2xl! shadow-[0_20px_44px_-16px_oklch(0.3_0.12_264/0.4)]! border-0! gap-3! px-4! py-3!",
          title: "font-semibold!",
          // Success in the primary family, never green (UX-036: primary colours only).
          success:
            "bg-primary-soft! text-primary-soft-foreground! [&_[data-icon]]:text-link! ring-1! ring-primary/20!",
          closeButton: "border-0! bg-card!",
        },
      }}
    />
  );
}
