import { forwardRef } from "react";
import type { StorageCardProps } from "./StorageCard.types";
import {
  storageCardClasses as styles,
  statusColors,
} from "./StorageCard.styles";
import { Progress } from "../Progress";

export const StorageCard = forwardRef<HTMLDivElement, StorageCardProps>(
  function StorageCard(
    {
      name,
      icon,
      status,
      usedSpace,
      totalSpace,
      usagePercent,
      className = "",
      ...rest
    },
    ref,
  ) {
    return (
      <div ref={ref} className={`${styles.container} ${className}`} {...rest}>
        <div className={styles.header}>
          <div className={styles.titleRow}>
            {icon && (
              <span className={styles.icon} aria-hidden="true">
                {icon}
              </span>
            )}
            <span className={styles.name}>{name}</span>
          </div>
          <span
            className={`inline-block h-2 w-2 rounded-full ${statusColors[status]}`}
            role="status"
            aria-label={status}
          />
        </div>
        {usagePercent !== undefined && (
          <Progress
            value={usagePercent}
            size="sm"
            color={usagePercent > 90 ? "error" : usagePercent > 75 ? "warning" : "accent"}
          />
        )}
        {(usedSpace || totalSpace) && (
          <p className={styles.usage}>
            {usedSpace && totalSpace
              ? `${usedSpace} of ${totalSpace} used`
              : usedSpace ?? totalSpace}
          </p>
        )}
      </div>
    );
  },
);
