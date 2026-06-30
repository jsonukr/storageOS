import { forwardRef } from "react";
import type { SpinnerProps } from "./Spinner.types";
import { getSpinnerClasses } from "./Spinner.styles";

export const Spinner = forwardRef<HTMLDivElement, SpinnerProps>(
  function Spinner({ size = "md", label = "Loading", className = "", ...rest }, ref) {
    const classes = getSpinnerClasses(size);

    return (
      <div ref={ref} role="status" aria-label={label} className={className} {...rest}>
        <svg
          className={classes}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <span className="sr-only">{label}</span>
      </div>
    );
  },
);
