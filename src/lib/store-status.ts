/** Client-side, cached read of /api/store/status (decided on the server). */
import { useEffect, useState } from "react";

export type StoreStatus = { enabled: boolean; open: boolean; copiesLeft: number; dailyCap?: number; soldOut?: boolean };

let cached: Promise<StoreStatus> | null = null;

export function fetchStoreStatus(fresh = false): Promise<StoreStatus> {
  if (fresh || !cached) {
    cached = fetch("/api/store/status", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<StoreStatus>) : { enabled: false, open: false, copiesLeft: 0 }))
      .catch(() => ({ enabled: false, open: false, copiesLeft: 0 }));
  }
  return cached;
}

export function useStoreStatus(fresh = false): StoreStatus | null {
  const [s, setS] = useState<StoreStatus | null>(null);
  useEffect(() => {
    let live = true;
    void fetchStoreStatus(fresh).then((v) => live && setS(v));
    return () => {
      live = false;
    };
  }, [fresh]);
  return s;
}
