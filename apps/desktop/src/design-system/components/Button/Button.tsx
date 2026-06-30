import { forwardRef } from "react";
import type { ButtonProps } from "./Button.types";
import { getButtonClasses } from "./Button.styles";
import { Spinner } from "../Spinner";

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      icon,
      iconPosition = "left",
      loading = false,
      fullWidth = false,
      disabled,
      children,
      className = "",
      ...rest
    },
    ref,
  ) {
    const classes = getButtonClasses(variant, size, fullWidth);

    return (
      <button
        ref={ref}
        className={`${classes} ${className}`}
        disabled={disabled || loading}
        aria-busy={loading}
        {...rest}
      >
        {loading ? (
          <Spinner size="sm" />
        ) : (
          icon && iconPosition === "left" && (
            <span className="shrink-0" aria-hidden="true">
              {icon}
            </span>
          )
        )}
        {children && <span>{children}</span>}
        {!loading && icon && iconPosition === "right" && (
          <span className="shrink-0" aria-hidden="true">
            {icon}
          </span>
        )}
      </button>
    );
  },
);
