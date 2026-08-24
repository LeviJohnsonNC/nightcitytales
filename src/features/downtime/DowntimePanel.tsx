/**
 * The after-action: the half of a session that happens once the shooting stops.
 *
 * Patch up, settle with the landlord, hit the Night Market, and put the job's
 * Improvement Points into a Skill. Every number shown here comes from the engine
 * through useDowntime — this file renders and asks, it never calculates.
 */
import { useMemo, useState } from "react";
import { AMMUNITION, ARMOR, GEAR, WEAPONS, itemCost, type ItemKind } from "@/engine";
import { Button } from "@/components/ui/button";
import { SpendIpCard } from "@/features/roster/SpendIpCard";
import type { FullCharacter } from "@/lib/backend";
import { useDowntime } from "./useDowntime";
import type { RepairableArmor } from "./downtimeModel";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
      {children}
    </p>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 border border-border bg-card p-4">
      <Label>{title}</Label>
      {children}
    </section>
  );
}

/** Lying low: days in, HP back, and the rent that lands while you do it. */
function RestSection({ downtime }: { downtime: ReturnType<typeof useDowntime> }) {
  const view = downtime.view;
  if (!view) return null;
  const { rest, restToFull } = view;
  const after = downtime.billsAfterRest;
  const whole = view.hpCurrent >= view.hpMax;

  return (
    <Section title="Lie low">
      <p className="text-sm">
        HP <span className="num font-bold">{view.hpCurrent}</span>/{view.hpMax}
        {view.body > 0 && (
          <span className="text-muted-foreground"> · BODY {view.body} back per day of rest</span>
        )}
      </p>

      {whole ? (
        <p className="text-sm text-muted-foreground">You are whole. Nothing to sleep off.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0"
              disabled={downtime.busy || downtime.restDays <= 1}
              aria-label="One day fewer"
              onClick={() => downtime.setRestDays(Math.max(1, downtime.restDays - 1))}
            >
              −
            </Button>
            <span className="num min-w-[5rem] text-center text-sm font-bold">
              {rest.days} day{rest.days === 1 ? "" : "s"}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0"
              disabled={downtime.busy || rest.days >= restToFull.days}
              aria-label="One day more"
              onClick={() => downtime.setRestDays(downtime.restDays + 1)}
            >
              +
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={downtime.busy || restToFull.days === 0}
              onClick={() => downtime.setRestDays(restToFull.days)}
            >
              Until whole ({restToFull.days}d)
            </Button>
          </div>

          <p className="text-sm">
            Heals <span className="num font-bold">{rest.hpHealed}</span> HP → {rest.hpAfter}/
            {view.hpMax}
          </p>
          {after && after.total > view.bills.total && (
            <p className="text-xs text-destructive">
              The month turns while you rest: {after.total}eb will be owed, not {view.bills.total}
              eb.
            </p>
          )}
          <Button
            size="sm"
            disabled={downtime.busy || rest.days <= 0}
            onClick={() => downtime.rest(rest.days)}
          >
            {downtime.busy ? "…" : `Lie low ${rest.days} day${rest.days === 1 ? "" : "s"}`}
          </Button>
        </>
      )}
    </Section>
  );
}

/** Rent and Lifestyle, and what happens if they go unpaid. */
function BillsSection({ downtime }: { downtime: ReturnType<typeof useDowntime> }) {
  const view = downtime.view;
  if (!view) return null;
  const { bills, rates } = view;

  return (
    <Section title="Rent and Lifestyle">
      <p className="text-sm">
        {rates.housingName} · {rates.lifestyleName}
        {rates.granted ? (
          <span className="text-muted-foreground"> — provided by your Role</span>
        ) : (
          <span className="text-muted-foreground">
            {" "}
            — {rates.perMonth}eb a month ({rates.rent} rent + {rates.lifestyleCost} lifestyle)
          </span>
        )}
      </p>
      <p className="num text-sm">
        Day {view.day} · {view.eurobucks}eb in hand
      </p>

      {bills.total > 0 ? (
        <>
          <p className="text-sm font-semibold text-destructive">
            {bills.months} month{bills.months === 1 ? "" : "s"} due: {bills.total}eb
          </p>
          <p className="text-xs text-muted-foreground">
            Unpaid Lifestyle gives you a week, and then a Death Save at the start of every unpaid
            day.
          </p>
          <Button
            size="sm"
            disabled={downtime.busy || view.eurobucks < bills.total}
            onClick={() => downtime.payBills()}
          >
            {view.eurobucks < bills.total ? "Not enough eb" : `Pay ${bills.total}eb`}
          </Button>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Square with the landlord
          {rates.perMonth > 0 ? ` — next ${rates.perMonth}eb in ${view.daysToNextBill} days` : ""}.
        </p>
      )}
    </Section>
  );
}

/** Armor that took hits, and what patching it costs. */
function RepairSection({ downtime }: { downtime: ReturnType<typeof useDowntime> }) {
  const view = downtime.view;
  if (!view || view.repairs.length === 0) return null;

  return (
    <Section title="Repairs">
      <ul className="space-y-2">
        {view.repairs.map((piece: RepairableArmor) => (
          <li key={piece.inventoryId} className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm">
              {piece.name}{" "}
              <span className="num text-muted-foreground">
                SP {piece.currentSp}/{piece.maxSp}
              </span>
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={downtime.busy || view.eurobucks < piece.cost}
              onClick={() => downtime.repair(piece)}
            >
              Patch to SP{piece.maxSp} · {piece.cost}eb
            </Button>
          </li>
        ))}
      </ul>
    </Section>
  );
}

const SHOP_KINDS: { kind: ItemKind; label: string; items: { id: string; name: string }[] }[] = [
  { kind: "ammunition", label: "Ammo", items: AMMUNITION },
  { kind: "armor", label: "Armor", items: ARMOR },
  { kind: "weapon", label: "Weapons", items: WEAPONS },
  { kind: "gear", label: "Gear", items: GEAR },
];

/** The Night Market: what the job's take will actually buy. */
function MarketSection({ downtime }: { downtime: ReturnType<typeof useDowntime> }) {
  const view = downtime.view;
  const [kind, setKind] = useState<ItemKind>("ammunition");
  const [quantity, setQuantity] = useState(1);

  const group = useMemo(() => SHOP_KINDS.find((k) => k.kind === kind) ?? SHOP_KINDS[0]!, [kind]);
  const affordable = useMemo(
    () =>
      [...group.items]
        .map((item) => ({ ...item, cost: itemCost(group.kind, item.id) }))
        .sort((a, b) => a.cost - b.cost),
    [group],
  );
  if (!view) return null;

  const stackable = kind === "ammunition" || kind === "gear";

  return (
    <Section title="Night Market">
      <div className="flex flex-wrap gap-1">
        {SHOP_KINDS.map((k) => (
          <Button
            key={k.kind}
            size="sm"
            variant={k.kind === kind ? "default" : "outline"}
            onClick={() => {
              setKind(k.kind);
              setQuantity(1);
            }}
            disabled={downtime.busy}
          >
            {k.label}
          </Button>
        ))}
      </div>

      {stackable && (
        <div className="flex items-center gap-2">
          <Label>Quantity</Label>
          <Button
            size="sm"
            variant="outline"
            className="h-7 w-7 p-0"
            disabled={downtime.busy || quantity <= 1}
            aria-label="One fewer"
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
          >
            −
          </Button>
          <span className="num w-6 text-center text-sm font-bold">{quantity}</span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 w-7 p-0"
            disabled={downtime.busy}
            aria-label="One more"
            onClick={() => setQuantity(quantity + 1)}
          >
            +
          </Button>
        </div>
      )}

      <ul className="max-h-72 space-y-1 overflow-y-auto pr-1">
        {affordable.map((item) => {
          const cost = item.cost * (stackable ? quantity : 1);
          const canBuy = view.eurobucks >= cost;
          return (
            <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">{item.name}</span>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0"
                disabled={downtime.busy || !canBuy}
                onClick={() =>
                  downtime.buy({
                    kind: group.kind,
                    itemId: item.id,
                    quantity: stackable ? quantity : 1,
                  })
                }
              >
                {cost}eb
              </Button>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

export function DowntimePanel({
  campaignId,
  character,
}: {
  campaignId: string;
  character: FullCharacter;
}) {
  const downtime = useDowntime(campaignId);

  if (downtime.isPending) {
    return <p className="text-sm text-muted-foreground">Counting the take…</p>;
  }
  if (downtime.error) {
    return <p className="text-sm text-destructive">{downtime.error.message}</p>;
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-bold leading-tight">Downtime</h3>
        <p className="text-sm text-muted-foreground">
          Patch up, settle up, gear up. Days spent here are days Night City keeps charging you for.
        </p>
      </div>

      {downtime.actionError && (
        <p className="text-sm text-destructive">{downtime.actionError.message}</p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <RestSection downtime={downtime} />
        <BillsSection downtime={downtime} />
        <RepairSection downtime={downtime} />
        <MarketSection downtime={downtime} />
        <div className="md:col-span-2">
          <SpendIpCard
            character={character}
            improvementPoints={character.finance?.improvement_points ?? 0}
          />
        </div>
      </div>
    </div>
  );
}
