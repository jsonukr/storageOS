import { forwardRef } from "react";
import type { ProgressProps } from "./Progress.types";
import { getTrackClasses, getBarClasses } from "./Progress.styles";

export const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  function Progress(
    {
      value,
      max = 100,
      size = "md",
      color = "accent",
      label,
      showValue = false,
      className = "",
      ...rest
    },
    ref,
  ) {
    const percent = Math.min(100, Math.max(0, (value / max) * 100));
    const trackClasses = getTrackClasses(size);
    const barClasses = getBarClasses(color);

    return (
      <div ref={ref} className={`flex flex-col gap-1 ${className}`} {...rest}>
        {(label || showValue) && (
          <div className="flex items-center justify-between text-sm">
            {label && (
              <span className="text-text-secondary">{label}</span>
            )}
            {showValue && (
              <span className="text-text-secondary tabular-nums">
                {Math.round(percent)}%
              </span>
            )}
          </div>
        )}
        <div
          className={trackClasses}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-label={label}
        >
          <div
            className={barClasses}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    );
  },
);
