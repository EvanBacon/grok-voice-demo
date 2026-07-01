import type React from "react";
import * as LucideWeb from "lucide-react";
import type { LucideIcon } from "lucide-react-native";

/**
 * Web variant of <Icon>. The native version reads a resolved `color` out of the
 * flattened style, but on web uniwind emits CSS classes rather than inline
 * styles, so that lookup falls back to "currentColor" and the SVG renders black.
 *
 * On web we instead render the matching `lucide-react` DOM icon and forward the
 * `className` straight through, so `text-foreground` / `text-muted-foreground`
 * set the CSS `color` and the icon's default `currentColor` stroke resolves.
 */
export function Icon({
  icon,
  className,
  strokeWidth,
  style,
}: {
  icon: LucideIcon;
  className?: string;
  strokeWidth?: number;
  style?: any;
}) {
  const name = (icon as { displayName?: string }).displayName;
  const WebIcon =
    (name && (LucideWeb as unknown as Record<string, React.ComponentType<any>>)[name]) ||
    (icon as unknown as React.ComponentType<any>);

  return <WebIcon className={className} strokeWidth={strokeWidth} style={style} />;
}
