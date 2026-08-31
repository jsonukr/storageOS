import { useEffect, useState } from "react";
import { checkForUpdate, type UpdateInfo } from "../services/update/UpdateService";

/**
 * Checks for a newer build once on mount. Returns the update info, or null
 * when up to date / the check failed.
 */
export function useUpdateCheck(): UpdateInfo | null {
  const [info, setInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    let alive = true;
    checkForUpdate().then((result) => {
      if (alive && result?.available) setInfo(result);
    });
    return () => {
      alive = false;
    };
  }, []);

  return info;
}
