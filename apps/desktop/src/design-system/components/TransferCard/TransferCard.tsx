import { forwardRef } from "react";
import type { TransferCardProps } from "./TransferCard.types";
import {
  transferCardClasses as styles,
  statusProgressColor,
} from "./TransferCard.styles";
import { Progress } from "../Progress";
import { Button } from "../Button";

export const TransferCard = forwardRef<HTMLDivElement, TransferCardProps>(
  function TransferCard(
    {
      fileName,
      fileIcon,
      status,
      direction,
      progress,
      source,
      destination,
      size,
      speed,
      onPause,
      onResume,
      onCancel,
      onRetry,
      className = "",
      ...rest
    },
    ref,
  ) {
    const metaParts = [
      direction,
      size,
      status === "in_progress" && speed ? speed : null,
    ].filter(Boolean);

    return (
      <div ref={ref} className={`${styles.container} ${className}`} {...rest}>
        <div className={styles.header}>
          {fileIcon && (
            <span className={styles.fileIcon} aria-hidden="true">
              {fileIcon}
            </span>
          )}
          <div className={styles.content}>
            <span className={styles.fileName}>{fileName}</span>
            <span className={styles.meta}>
              {metaParts.join(" · ")}
              {source && destination && ` · ${source} → ${destination}`}
            </span>
          </div>
          <div className={styles.actions}>
            {status === "in_progress" && onPause && (
              <Button variant="ghost" size="sm" onClick={onPause} aria-label="Pause transfer">
                Pause
              </Button>
            )}
            {status === "paused" && onResume && (
              <Button variant="ghost" size="sm" onClick={onResume} aria-label="Resume transfer">
                Resume
              </Button>
            )}
            {status === "failed" && onRetry && (
              <Button variant="ghost" size="sm" onClick={onRetry} aria-label="Retry transfer">
                Retry
              </Button>
            )}
            {(status === "in_progress" || status === "paused" || status === "pending") && onCancel && (
              <Button variant="ghost" size="sm" onClick={onCancel} aria-label="Cancel transfer">
                Cancel
              </Button>
            )}
          </div>
        </div>
        {progress !== undefined && (
          <Progress
            value={progress}
            size="sm"
            color={statusProgressColor[status]}
            showValue={status === "in_progress"}
          />
        )}
      </div>
    );
  },
);
