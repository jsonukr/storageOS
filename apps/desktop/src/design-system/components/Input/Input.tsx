import { forwardRef, useId } from "react";
import type { InputProps } from "./Input.types";
import { getInputClasses } from "./Input.styles";

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    inputSize = "md",
    label,
    error,
    hint,
    leadingIcon,
    trailingIcon,
    className = "",
    id: externalId,
    "aria-describedby": ariaDescribedBy,
    ...rest
  },
  ref,
) {
  const generatedId = useId();
  const id = externalId ?? generatedId;
  const errorId = error ? `${id}-error` : undefined;
  const hintId = hint && !error ? `${id}-hint` : undefined;
  const describedBy =
    ariaDescribedBy ?? errorId ?? hintId ?? undefined;

  const classes = getInputClasses(
    inputSize,
    !!leadingIcon,
    !!trailingIcon,
    !!error,
  );

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={id}
          className="text-sm font-medium text-text-primary"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {leadingIcon && (
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none"
            aria-hidden="true"
          >
            {leadingIcon}
          </span>
        )}
        <input
          ref={ref}
          id={id}
          className={`${classes} ${className}`}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          {...rest}
        />
        {trailingIcon && (
          <span
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none"
            aria-hidden="true"
          >
            {trailingIcon}
          </span>
        )}
      </div>
      {error && (
        <p id={errorId} className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={hintId} className="text-sm text-text-secondary">
          {hint}
        </p>
      )}
    </div>
  );
});
