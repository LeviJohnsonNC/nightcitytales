import {
  FASHION_RULES,
  FASHION_SLOTS,
  FASHION_STYLES,
  LIFESTYLE_FAILURE_NOTE,
  fashionItemId,
  getFashion,
  getGearPackage,
  lineCost,
  startingLifestylePlan,
} from "@/engine";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { readGeneralLifepath, displayValue } from "./lifepathState";
import { BudgetBars, FashionWarning, PurchaseError, eb, useLoadoutActions } from "./market";
import { useState } from "react";
import { useChargenStore, type ChargenState } from "./store";

const LOOK_TABLES = [
  { id: "clothing_style", label: "Clothing Style" },
  { id: "hairstyle", label: "Hairstyle" },
  { id: "affectation", label: "Affectation" },
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-text-dim">{children}</p>
  );
}

/** Clothing Style, Hairstyle and Affectation, straight from the Lifepath answers. */
function LookSummary({ state }: { state: ChargenState }) {
  const general = readGeneralLifepath(state.lifepath.general);
  const rows = LOOK_TABLES.map((t) => ({
    ...t,
    entry: general.entries[t.id],
  }));
  return (
    <div className="border border-hairline bg-surface p-4">
      <SectionTitle>The look your Lifepath gave you</SectionTitle>
      <dl className="mt-3 grid gap-3 sm:grid-cols-3">
        {rows.map((row) => (
          <div key={row.id}>
            <dt className="font-mono text-[11px] uppercase tracking-[0.15em] text-text-dim">
              {row.label}
            </dt>
            <dd className="text-sm text-text">
              {row.entry ? displayValue(row.entry) : "Not answered in the Lifepath step yet."}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function PackageOutfit({ state }: { state: ChargenState }) {
  if (!state.roleId) return null;
  const pkg = getGearPackage(state.roleId);
  return (
    <div className="border border-hairline bg-surface p-4">
      <SectionTitle>Your standard outfit</SectionTitle>
      <ul className="mt-3 space-y-1">
        {pkg.outfit.map((line) => (
          <li key={line} className="font-mono text-sm text-text">
            {line}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-text-muted">
        Printed as Fashion-style groupings. This outfit comes with your package — no fashion money
        is spent, and nothing here is bought piece by piece.
      </p>
    </div>
  );
}

function FashionShop({ state }: { state: ChargenState }) {
  const { buy, remove, check, error } = useLoadoutActions();
  const bought = state.loadout.lines.filter((l) => l.kind === "fashion");

  return (
    <div className="space-y-4">
      <BudgetBars state={state} />
      <FashionWarning state={state} />
      <PurchaseError error={error} />

      <div className="border border-hairline bg-surface">
        <div className="border-b border-hairline px-4 py-3">
          <SectionTitle>Fashion — priced per garment slot</SectionTitle>
          <p className="mt-1 text-sm text-text-muted">{FASHION_RULES._note}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-hairline">
                <th className="px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em] text-text-dim">
                  Style
                </th>
                {FASHION_SLOTS.map((slot) => (
                  <th
                    key={slot}
                    className="px-2 py-2 font-mono text-[11px] uppercase tracking-[0.15em] text-text-dim"
                  >
                    {slot}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FASHION_STYLES.map((style) => (
                <tr key={style.id} className="border-b border-hairline/60">
                  <th className="whitespace-nowrap px-4 py-2 text-sm font-medium text-text">
                    {style.name}
                  </th>
                  {FASHION_SLOTS.map((slot) => {
                    const itemId = fashionItemId(style.id, slot);
                    const price = style.prices[slot];
                    if (price === undefined) {
                      return (
                        <td key={slot} className="px-2 py-2 font-mono text-[11px] text-text-dim">
                          —
                        </td>
                      );
                    }
                    const allowed = check({ kind: "fashion", itemId, budget: "fashion" });
                    return (
                      <td key={slot} className="px-2 py-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!allowed.ok}
                          title={allowed.reason ?? undefined}
                          onClick={() => buy({ kind: "fashion", itemId, budget: "fashion" })}
                          className="w-full font-mono tabular-nums"
                        >
                          {eb(price)}
                        </Button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border border-hairline bg-surface">
        <p className="border-b border-hairline px-4 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-text-dim">
          Wardrobe — {bought.length} piece{bought.length === 1 ? "" : "s"}
        </p>
        {bought.length === 0 ? (
          <p className="px-4 py-6 text-sm text-text-muted">
            Nothing bought yet. Unspent fashion money is lost when you leave this step.
          </p>
        ) : (
          <ul className="divide-y divide-hairline">
            {bought.map((line) => (
              <li key={line.lineId} className="flex items-center justify-between gap-3 px-4 py-2">
                <span className="text-sm text-text">{getFashion(line.itemId).name}</span>
                <span className="flex items-center gap-3">
                  <span className="font-mono text-sm tabular-nums text-text-muted">
                    {eb(lineCost(line))}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => remove(line.lineId)}>
                    Remove
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function HousingCard({ state }: { state: ChargenState }) {
  const patch = useChargenStore((s) => s.patch);
  const plan = startingLifestylePlan(state.roleId);
  return (
    <div className="border border-hairline bg-surface p-4">
      <SectionTitle>Housing &amp; Lifestyle</SectionTitle>
      {plan.grantedByRoleAbility ? (
        <>
          <p className="mt-2 text-sm text-text">
            Your Role Ability hands you a <span className="text-ember">{plan.housingName}</span> at{" "}
            <span className="text-ember">{eb(plan.rent)}</span> rent — no location roll, no
            neighbourhood choice.
          </p>
          {plan.grantRule ? <p className="mt-2 text-sm text-text-muted">{plan.grantRule}</p> : null}
          {plan.rentNote ? <p className="mt-2 text-sm text-text-muted">{plan.rentNote}</p> : null}
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-text">
            You start in a rented <span className="text-ember">{plan.housingName}</span> on a{" "}
            <span className="text-ember">{plan.lifestyleName}</span> Lifestyle. Pick where it sits.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {plan.locations.map((location) => {
              const selected = state.lifestyle.location === location;
              return (
                <button
                  key={location}
                  type="button"
                  onClick={() => patch({ lifestyle: { location } })}
                  aria-pressed={selected}
                  className={`border p-4 text-left transition-colors duration-200 ${
                    selected
                      ? "border-ember bg-ember/10"
                      : "border-hairline bg-surface-raised hover:border-ember/60"
                  }`}
                >
                  <span className="font-mono text-sm uppercase tracking-[0.15em] text-text">
                    {location}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="border border-hairline bg-surface-raised p-3">
          <dt className="font-mono text-[11px] uppercase tracking-[0.15em] text-text-dim">
            Rent — {plan.housingName}
          </dt>
          <dd className="mt-1 font-mono text-sm tabular-nums text-text">
            {eb(plan.rent)} / {plan.rentPeriod}
          </dd>
        </div>
        <div className="border border-hairline bg-surface-raised p-3">
          <dt className="font-mono text-[11px] uppercase tracking-[0.15em] text-text-dim">
            Lifestyle — {plan.lifestyleName}
          </dt>
          <dd className="mt-1 font-mono text-sm tabular-nums text-text">
            {eb(plan.lifestyleCost)} / {plan.lifestyleCostPeriod}
          </dd>
        </div>
      </dl>

      {plan.lifestyleOption ? (
        <p className="mt-3 text-sm text-text-muted">{plan.lifestyleOption.entails}</p>
      ) : null}

      {plan.firstMonthFree ? (
        <p className="mt-3 text-sm text-text">
          <span className="text-ember">First month is free.</span> Payment starts in month two.{" "}
          {plan.firstMonthNote}
        </p>
      ) : null}

      {plan.lifestyleNote ? (
        <p className="mt-3 border border-cool/60 bg-cool/10 p-3 text-sm text-text">
          {plan.lifestyleNote} Free housing is not free everything — the {eb(plan.lifestyleCost)} /{" "}
          {plan.lifestyleCostPeriod} {plan.lifestyleName} Lifestyle is still yours to pay.
        </p>
      ) : null}

      <p className="mt-3 text-sm text-text-muted">{LIFESTYLE_FAILURE_NOTE}</p>
    </div>
  );
}

export function LifestylePanel({ state }: { state: ChargenState }) {
  return (
    <div className="space-y-6">
      <LookSummary state={state} />
      {state.method === "complete_package" ? (
        <FashionShop state={state} />
      ) : (
        <PackageOutfit state={state} />
      )}
      <HousingCard state={state} />
    </div>
  );
}
