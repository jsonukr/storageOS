import { forwardRef } from "react";
import type { BadgeProps } from "./Badge.types";
import { getBadgeClasses } from "./Badge.styles";

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  {
    variant = "subtle",
    color = "default",
    size = "sm",
    children,
    className = "",
    ...rest
  },
  ref,
) {
  const classes = getBadgeClasses(variant, color, size);

  return (
    <span ref={ref} className={`${classes} ${className}`} {...rest}>
      {children}
    </span>
  );
});
