import { cn } from "@/lib/utils";
import { STAT_ORDER, getStatTemplateRows } from "@/engine";
import type { StatKey } from "@/engine";

const ROW_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * The Role's full STAT template table. `highlightRow` marks a Streetrat row,
 * `highlightCells` marks the per-STAT rows an Edgerunner rolled.
 */
export function StatTemplateTable({
  roleId,
  highlightRow,
  highlightCells,
}: {
  roleId: string;
  highlightRow?: number | null;
  highlightCells?: Partial<Record<StatKey, number>>;
}) {
  const rows = getStatTemplateRows(roleId);
  return (
    <div className="overflow-x-auto border border-border bg-card">
      <table className="w-full border-collapse text-right font-mono text-sm">
        <thead>
          <tr className="border-b border-border text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
            <th className="p-2 text-left font-medium">1d10</th>
            {STAT_ORDER.map((stat) => (
              <th key={stat} className="p-2 font-medium">
                {stat.toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROW_NUMBERS.map((n) => {
            const values = rows[String(n)] ?? {};
            const rowHit = highlightRow === n;
            return (
              <tr
                key={n}
                className={cn(
                  "border-b border-border/60 last:border-0",
                  rowHit && "bg-primary/15 text-foreground",
                )}
              >
                <td
                  className={cn(
                    "p-2 text-left text-muted-foreground",
                    rowHit && "font-bold text-primary",
                  )}
                >
                  {n}
                </td>
                {STAT_ORDER.map((stat) => {
                  const cellHit = highlightCells?.[stat] === n;
                  return (
                    <td
                      key={stat}
                      className={cn(
                        "num p-2 tabular-nums",
                        cellHit && "bg-primary/25 font-bold text-primary",
                      )}
                    >
                      {values[stat]}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
