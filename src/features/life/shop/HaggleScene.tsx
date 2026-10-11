/**
 * Talking the price down, as a short scene: how you put it, the dice in your
 * hand, and what the person behind the counter says back.
 *
 * The roll is the printed Haggle — your Trading against theirs, once a visit —
 * with one thing on top: each keeper warms to one pitch (+), is put off by
 * another (−), and shrugs at the third (`hagglePitchModifier`, house rule).
 * A good enough read of people (`haggleRead`) tells you which before you
 * choose. The dice are the same dice every other check is rolled with: you
 * roll yours, then turn theirs over. Presentational: the roll and its record
 * are `useShop`'s.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DiceRoll, type DieTone } from "@/features/chargen/DiceRoll";
import { playClash } from "@/features/dice/fx";
import { RollMath } from "@/features/dice/RollMath";
import {
  HAGGLE_APPROACHES,
  HAGGLE_READ,
  haggleHint,
  haggleReply,
  opposedPercent,
  type HaggleApproach,
} from "@/engine";
import { cn } from "@/lib/utils";
import type { HaggleScene as HaggleResult, ShopController } from "../useShop";
import { KeeperFace } from "./KeeperFace";

function toneOf(critical: "success" | "failure" | null): DieTone {
  return critical === "success" ? "crit" : critical === "failure" ? "fumble" : null;
}

/** The hint a read gives on one pitch, if the read reached it. */
function hintFor(shop: ShopController, approach: HaggleApproach, name: string) {
  const setup = shop.haggleSetup;
  if (!setup) return null;
  if (setup.warms === approach.id)
    return { kind: "warms" as const, text: haggleHint("warms", name) };
  if (setup.cools === approach.id)
    return { kind: "cools" as const, text: haggleHint("cools", name) };
  return null;
}

function Pitches({
  shop,
  name,
  onPick,
}: {
  shop: ShopController;
  name: string;
  onPick: (a: HaggleApproach) => void;
}) {
  const setup = shop.haggleSetup;
  const read = setup ? setup.warms !== null || setup.cools !== null : false;
  return (
    <>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">
        How do you put it?
      </p>
      {setup && (
        <p className="text-xs text-text-muted">
          {read ? (
            <>
              Your <b className="text-text">{setup.readSkill}</b> ({setup.readLevel}) reads {name}
              {setup.cools ? " well." : " a little."}
            </>
          ) : (
            <>
              Every keeper warms to one of these and is put off by another. A better read of people
              ({setup.readSkill} {HAGGLE_READ.one}+) would tell you which.
            </>
          )}
        </p>
      )}
      <ul className="space-y-2">
        {HAGGLE_APPROACHES.map((a) => {
          const hint = hintFor(shop, a, name);
          return (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => onPick(a)}
                className={cn(
                  "w-full border p-3 text-left hover:bg-accent/5",
                  hint?.kind === "warms"
                    ? "border-success/60 hover:border-success"
                    : hint?.kind === "cools"
                      ? "border-danger/50 hover:border-danger"
                      : "border-hairline hover:border-accent/60",
                )}
              >
                <span className="block font-display font-bold">{a.label}</span>
                <span className="block text-sm italic text-text-muted">{a.line}</span>
                {hint && (
                  <span
                    className={cn(
                      "mt-1 block font-mono text-[11px]",
                      hint.kind === "warms" ? "text-success" : "text-danger",
                    )}
                  >
                    {hint.kind === "warms" ? "▲ " : "▼ "}
                    {hint.text}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Roll({
  shop,
  name,
  pitch,
  onDone,
}: {
  shop: ShopController;
  name: string;
  pitch: HaggleApproach;
  onDone: () => void;
}) {
  const setup = shop.haggleSetup!;
  const [rolled, setRolled] = useState<HaggleResult | null>(null);
  const [theirsShown, setTheirsShown] = useState(false);
  const [clash, setClash] = useState(false);
  const [decided, setDecided] = useState(false);
  // What the pitch did is only known once it is put: it is on the roll's own
  // modifiers, the one place it is ever decided.
  const pitchMod = rolled?.yours.modifiers.find((m) => m.label === pitch.label)?.value ?? 0;
  const myCrit = rolled && rolled.yours.rolls.length > 1 ? rolled.yours.rolls[1]! : null;
  const theirCrit = rolled && rolled.theirs.rolls.length > 1 ? rolled.theirs.rolls[1]! : null;

  return (
    <div className="space-y-4">
      <p className="text-sm italic text-text-muted">{pitch.line}</p>
      {!rolled && (
        <p className="text-xs text-text-muted">
          You roll 1d10 at +{setup.base}; {name} rolls at +{setup.against}. Beat their total — a tie
          goes to the counter. Chance before the pitch:{" "}
          <b className="num text-text">{opposedPercent(setup.base, setup.against)}%</b>.
        </p>
      )}
      {rolled && (
        <p
          className={cn(
            "font-mono text-[11px] uppercase tracking-[0.14em]",
            pitchMod > 0 ? "text-success" : pitchMod < 0 ? "text-danger" : "text-text-muted",
          )}
        >
          {pitchMod > 0
            ? `${name} warms to it: +${pitchMod}`
            : pitchMod < 0
              ? `That put ${name} off: ${pitchMod}`
              : `${name} neither likes it nor minds it`}
        </p>
      )}

      <div
        className={cn("flex flex-wrap items-center justify-center gap-5", clash && "dice-clash")}
      >
        <div className="flex items-center gap-2">
          <span className="clash-left inline-block">
            <DiceRoll
              sides={10}
              value={rolled?.yours.rolls[0] ?? null}
              label="Roll your 1d10 for Trading"
              size={56}
              disabled={rolled !== null}
              tone={decided ? (rolled?.won ? "win" : "lose") : null}
              roll={() => {
                const next = shop.rollHaggle(pitch.id);
                return {
                  face: next.yours.rolls[0] ?? 1,
                  tone: toneOf(next.yours.critical),
                  commit: () => setRolled(next),
                };
              }}
            />
          </span>
          {myCrit !== null && (
            <DiceRoll sides={10} value={myCrit} size={38} autoRoll="mount" delay={150} />
          )}
          <div>
            <p className="text-sm font-semibold">You</p>
            <p className="num text-sm text-text-muted">{rolled ? rolled.yours.total : "—"}</p>
          </div>
        </div>

        <p className="clash-vs font-mono text-xs uppercase tracking-[0.2em] text-text-muted">vs</p>

        <div className="flex items-center gap-2">
          <span className="clash-right inline-block">
            <DiceRoll
              sides={10}
              value={theirsShown ? (rolled?.theirs.rolls[0] ?? null) : null}
              label={`Roll ${name}'s 1d10`}
              size={56}
              disabled={rolled === null || theirsShown}
              tone={decided ? (rolled?.won ? "lose" : "win") : null}
              roll={() => {
                if (!rolled) throw new Error("Roll your own die first.");
                return {
                  face: rolled.theirs.rolls[0] ?? 1,
                  tone: toneOf(rolled.theirs.critical),
                  commit: () => {
                    setTheirsShown(true);
                    setClash(true);
                    window.setTimeout(
                      () => {
                        setDecided(true);
                        playClash();
                      },
                      theirCrit !== null ? 900 : 260,
                    );
                  },
                };
              }}
            />
          </span>
          {theirsShown && theirCrit !== null && (
            <DiceRoll sides={10} value={theirCrit} size={38} autoRoll="mount" delay={150} />
          )}
          <div>
            <p className="text-sm font-semibold">{name}</p>
            <p className="num text-sm text-text-muted">
              {theirsShown && rolled ? rolled.theirs.total : "—"}
            </p>
          </div>
        </div>
      </div>

      {!rolled && (
        <p className="text-center text-xs text-text-muted">
          Roll your die, then turn theirs over. Rolling spends tonight&apos;s one try.
        </p>
      )}
      {rolled && !theirsShown && (
        <p className="text-center text-xs text-text-muted">
          You have {rolled.yours.total}. Roll {name}&apos;s die to see if it holds.
        </p>
      )}

      {rolled && theirsShown && (
        <div className="space-y-3">
          <RollMath
            rolls={rolled.yours.rolls}
            modifiers={rolled.yours.modifiers}
            total={rolled.yours.total}
            target={{ kind: "vs", total: rolled.theirs.total, name }}
            success={rolled.won}
            margin={rolled.tie ? null : rolled.margin}
            tie={rolled.tie}
            words={{ success: "Beat them", failure: "They hold" }}
            delay={theirCrit !== null ? 1100 : 450}
          />
          <p className="border-l-2 border-accent/60 pl-3 text-[15px] leading-relaxed">
            {haggleReply({
              won: rolled.won,
              seed: rolled.yours.total * 31 + rolled.theirs.total,
              name,
            })}
          </p>
          <p
            className={cn(
              "font-mono text-[11px] uppercase tracking-[0.14em]",
              rolled.won ? "text-success" : "text-text-muted",
            )}
          >
            {rolled.won
              ? `${rolled.percent}% off everything here this visit`
              : rolled.tie
                ? "A tie, and a tie goes to the counter. That was your one try tonight."
                : "That was your one try tonight."}
          </p>
          <details className="font-mono text-[10px] text-text-muted">
            <summary className="cursor-pointer">The rolls</summary>
            <p className="mt-1">{rolled.yours.formula}</p>
            <p>{rolled.theirs.formula}</p>
          </details>
          <Button className="w-full" variant="outline" onClick={onDone}>
            Back to the counter
          </Button>
        </div>
      )}
    </div>
  );
}

export function HaggleScene({
  shop,
  open,
  onOpenChange,
}: {
  shop: ShopController;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [pitch, setPitch] = useState<HaggleApproach | null>(null);
  const name = shop.keeper?.name ?? shop.vendor.label;
  const close = (next: boolean) => {
    if (!next) setPitch(null);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[92vh] max-w-lg gap-0 overflow-y-auto border-accent/40 bg-surface p-0 sm:rounded-none">
        <div className="flex items-center gap-3 border-b border-hairline p-4 pr-12">
          <KeeperFace keeper={shop.keeper} fallback={shop.vendor.label} className="size-14" />
          <div className="min-w-0">
            <DialogTitle className="font-display text-xl font-extrabold">
              Talk {name} down
            </DialogTitle>
            <DialogDescription className="text-xs text-text-muted">
              Your Trading against theirs, once a visit. Win and everything here is{" "}
              {shop.hagglePercent}% cheaper until you leave.
            </DialogDescription>
          </div>
        </div>

        <div className="space-y-3 p-4">
          {pitch && shop.haggleSetup ? (
            <Roll shop={shop} name={name} pitch={pitch} onDone={() => close(false)} />
          ) : (
            <Pitches shop={shop} name={name} onPick={setPitch} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
