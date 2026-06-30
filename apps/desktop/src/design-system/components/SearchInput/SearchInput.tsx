import { forwardRef } from "react";
import type { SearchInputProps } from "./SearchInput.types";
import { searchInputClasses as styles } from "./SearchInput.styles";
import { getInputClasses } from "../Input/Input.styles";

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput(
    {
      inputSize = "md",
      onClear,
      value,
      className = "",
      ...rest
    },
    ref,
  ) {
    const hasValue = value !== undefined && value !== "";
    const inputClasses = getInputClasses(inputSize, true, hasValue && !!onClear, false);

    return (
      <div className={`${styles.container} ${className}`}>
        <span className={styles.icon} aria-hidden="true">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </span>
        <input
          ref={ref}
          type="search"
          role="searchbox"
          className={inputClasses}
          value={value}
          {...rest}
        />
        {hasValue && onClear && (
          <button
            type="button"
            className={styles.clearButton}
            onClick={onClear}
            aria-label="Clear search"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        )}
      </div>
    );
  },
);
