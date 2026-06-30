import { forwardRef } from "react";
import type { DividerProps } from "./Divider.types";
import { getDividerClasses } from "./Divider.styles";

export const Divider = forwardRef<HTMLDivElement, DividerProps>(
  function Divider(
    { orientation = "horizontal", spacing = "md", className = "", ...rest },
    ref,
  ) {
    const classes = getDividerClasses(orientation, spacing);

    return (
      <div
        ref={ref}
        role="separator"
        aria-orientation={orientation}
        className={`${classes} ${className}`}
        {...rest}
      />
    );
  },
);
