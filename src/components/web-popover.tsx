import { cn } from "@/utils/tailwind";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { forwardRef } from "react";

/**
 * shadcn-style Popover built on Radix. Web-only — used to present form-sheet
 * routes (e.g. `/attachments`) as anchored popovers instead of full-page
 * navigations. Radix handles portalling, positioning, focus trapping, and
 * dismissal (outside click / Escape).
 */
export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export const PopoverContent = forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "start", side = "top", sideOffset = 8, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      side={side}
      sideOffset={sideOffset}
      collisionPadding={8}
      className={cn(
        "z-50 w-80 overflow-hidden rounded-2xl border border-border/50 bg-card py-2 text-foreground shadow-float outline-none",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        "data-[side=top]:slide-in-from-bottom-2 data-[side=bottom]:slide-in-from-top-2",
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = "PopoverContent";
