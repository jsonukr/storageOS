import { forwardRef } from "react";
import type { CardProps } from "./Card.types";
import { getCardClasses } from "./Card.styles";

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  {
    variant = "default",
    padding = "md",
    header,
    footer,
    children,
    className = "",
    ...rest
  },
  ref,
) {
  const classes = getCardClasses(variant, padding);
  const hasHeaderOrFooter = header || footer;

  return (
    <div ref={ref} className={`${classes} ${className}`} {...rest}>
      {hasHeaderOrFooter ? (
        <>
          {header && (
            <div className="px-4 py-3 border-b border-border">{header}</div>
          )}
          <div className={padding === "none" ? "" : "p-4"}>{children}</div>
          {footer && (
            <div className="px-4 py-3 border-t border-border">{footer}</div>
          )}
        </>
      ) : (
        children
      )}
    </div>
  );
});
