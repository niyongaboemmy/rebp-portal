"use client";

import { Button, type ButtonProps } from "./button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

/**
 * Icon-only button. `label` is required: it becomes the accessible name and the tooltip, so an
 * icon is never the only description of an action (WCAG 2.5.3, 4.1.2).
 */
export function IconButton({
  label,
  tooltip = true,
  size = "icon",
  variant = "ghost",
  ...props
}: Omit<ButtonProps, "aria-label"> & { label: string; tooltip?: boolean }) {
  const button = <Button size={size} variant={variant} aria-label={label} {...props} />;
  if (!tooltip) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
