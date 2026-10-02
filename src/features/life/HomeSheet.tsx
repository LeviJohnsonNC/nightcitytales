/**
 * Home: where the character lives, what they eat, and what moving would cost.
 *
 * Every number on it is the engine's (`planMove` over the printed rents and
 * Lifestyles, and `moving-house.json`'s deposit and hours). It is a trade-off,
 * not a reward: a better flat is a deposit now and a bigger bill every month,
 * a cheaper one is money back every month and a worse door to come home to.
 */
import { useState } from "react";
import { Home as HomeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  buildingsFor,
  districtOfPlace,
  formatDuration,
  getDistrict,
  getPlace,
  housingById,
  housingChoices,
  LIFESTYLE_OPTIONS,
  lifestyleById,
  type Home,
} from "@/engine";
import { campaignHome } from "@/features/campaign/home";
import { moveVerdict } from "@/features/campaign/moving";
import { formatMoney } from "@/features/status/statusModel";
import { DockTile } from "./hud/DockTile";
import type { useLife } from "./useLife";

type Life = ReturnType<typeof useLife>;

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
      {children}
    </p>
  );
}

function Offer({ life, target, label }: { life: Life; target: Home; label: string }) {
  const bundle = life.bundle!;
  const verdict = moveVerdict(bundle, target);
  const current = campaignHome(bundle.campaign, bundle.character);
  return (
    <li className="flex items-center gap-3 border-b border-border/50 py-2 last:border-b-0">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{label}</span>
        <span className="block font-mono text-[10px] text-muted-foreground">
          {verdict.ok
            ? [
                verdict.plan.deposit > 0 ? `${formatMoney(verdict.plan.deposit)} deposit` : null,
                `${formatMoney(verdict.plan.perMonthAfter)}/month (now ${formatMoney(verdict.plan.perMonthBefore)})`,
                verdict.plan.minutes > 0 ? formatDuration(verdict.plan.minutes) : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : verdict.reason}
        </span>
      </span>
      <Button
        size="sm"
        variant="outline"
        disabled={!verdict.ok || life.moveBusy || bundle.phase !== "life"}
        onClick={() => void life.moveTo(target).catch(() => {})}
      >
        {target.housingId === current.housingId && target.placeKey === current.placeKey
          ? "Switch"
          : "Move"}
      </Button>
    </li>
  );
}

export function HomeSheet({ life }: { life: Life }) {
  const bundle = life.bundle;
  const [kind, setKind] = useState<string | null>(null);
  if (!bundle) return null;

  const home = campaignHome(bundle.campaign, bundle.character);
  const roleId = bundle.character.character.role ?? null;
  const housing = housingById(home.housingId);
  const lifestyle = lifestyleById(home.lifestyleId);
  const place = home.placeKey ? getPlace(home.placeKey) : undefined;
  const district = home.placeKey ? districtOfPlace(home.placeKey) : undefined;
  const choices = housingChoices(roleId);
  const chosen = kind ?? home.housingId;
  const buildings = buildingsFor(chosen);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <DockTile icon={<HomeIcon className="size-6" />} label="Home" />
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle>Home</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          <section className="space-y-1">
            <Label>Where you live</Label>
            <p className="text-sm">
              {housing?.name ?? home.housingId}
              {place ? ` at ${place.name}` : ""}
              {district ? `, ${district.name}` : ""}
            </p>
            <p className="text-sm">
              {lifestyle?.name ?? home.lifestyleId}
              <span className="text-muted-foreground"> — {lifestyle?.entails}</span>
            </p>
          </section>

          <p className="text-xs text-muted-foreground">
            Moving costs a month of the new rent up front and most of a day. New rates are charged
            from the next bill. Nobody moves out owing: settle up first.
          </p>

          <section>
            <Label>Move to</Label>
            <div className="mt-2 flex flex-wrap gap-1">
              {choices.map((h) => (
                <Button
                  key={h.id}
                  size="sm"
                  variant={h.id === chosen ? "default" : "ghost"}
                  onClick={() => setKind(h.id)}
                >
                  {h.name} · {formatMoney(h.rent ?? 0)}
                </Button>
              ))}
            </div>
            <ul className="mt-2">
              {buildings.map((b) => (
                <Offer
                  key={b.key}
                  life={life}
                  target={{ housingId: chosen, lifestyleId: home.lifestyleId, placeKey: b.key }}
                  label={`${b.name}${getDistrict(b.districtKey) ? `, ${getDistrict(b.districtKey)!.name}` : ""}`}
                />
              ))}
            </ul>
          </section>

          <section>
            <Label>What you eat</Label>
            <ul className="mt-1">
              {LIFESTYLE_OPTIONS.filter((l) => l.id !== home.lifestyleId).map((l) => (
                <Offer
                  key={l.id}
                  life={life}
                  target={{ ...home, lifestyleId: l.id }}
                  label={`${l.name} · ${formatMoney(l.monthlyCost)}/month`}
                />
              ))}
            </ul>
          </section>

          {life.moveError && <p className="text-sm text-destructive">{life.moveError.message}</p>}
        </div>
      </SheetContent>
    </Sheet>
  );
}
