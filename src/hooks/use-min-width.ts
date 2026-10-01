import { useSyncExternalStore } from "react";

/**
 * Whether the viewport is at least `px` wide, tracking the breakpoint as it is
 * crossed. For choosing which of two copies of something to MOUNT — a class
 * like `lg:hidden` only hides one, and a player that is hidden still runs.
 * False wherever there is no window, so nothing renders it on the server.
 */
export function useMinWidth(px: number): boolean {
  const query = `(min-width: ${px}px)`;
  return useSyncExternalStore(
    (notify) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", notify);
      return () => mql.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
