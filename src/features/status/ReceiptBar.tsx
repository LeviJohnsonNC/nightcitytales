/**
 * What the last turn cost, as cards that fade.
 *
 * The rail is standing state; these are feedback. They appear when something
 * actually moved, and they go away on their own, because a strip that is always
 * lit stops being read.
 *
 * Presentational only: every value arrives already diffed by receipts.ts.
 */
import type { Receipt, ReceiptTone } from "./receipts";
import "./receipts.css";

const TONE: Record<ReceiptTone, string> = {
  good: "text-accent",
  bad: "text-destructive",
  neutral: "text-muted-foreground",
};

export function ReceiptBar({ receipts }: { receipts: Receipt[] }) {
  if (receipts.length === 0) return null;
  return (
    <div
      className="flex flex-wrap gap-2"
      // The player is told what changed; a screen reader should hear it rather
      // than have it appear silently in the tab order.
      role="status"
      aria-live="polite"
    >
      {receipts.map((receipt, i) => (
        <span
          key={receipt.key}
          className="receipt flex items-center gap-2 border border-border bg-card px-2.5 py-1"
          style={{ animationDelay: `${i * 70}ms` }}
        >
          <span className={`num text-xs font-bold ${TONE[receipt.tone]}`}>{receipt.text}</span>
          {receipt.meter && (
            <span className="flex w-10 gap-0.5" aria-hidden>
              {Array.from({ length: receipt.meter.segments }, (_, seg) => (
                <span
                  key={seg}
                  className={`h-1 flex-1 ${
                    seg < (receipt.meter?.filled ?? 0) ? "bg-destructive" : "bg-border"
                  }`}
                />
              ))}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
