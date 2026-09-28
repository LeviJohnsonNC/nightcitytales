/**
 * The terms: how this character's STATs, Skills and gear get made.
 *
 * Three cards, art behind the words, and the whole card is the choice: one
 * click takes those terms and moves on to the story, with the fixer's reaction
 * opening it. What each way decides is on the card in plain words — the body,
 * the skills, the gear — because that, not a name like "Complete Package", is
 * what a player is actually choosing between. The numbers stay one click away
 * under the ?, for the player who wants them.
 */
import { useState } from "react";
import { HelpCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { CREATION_METHODS } from "@/engine";
import type { CreationMethod } from "@/engine";
import { uploadedAsset } from "./art";
import { METHOD_COPY, type MethodCopy } from "./copy";
import type { ChargenState } from "./store";
import "./interview.css";
import streetratArt from "@/assets/method-streetrat.png.asset.json";
import edgerunnerArt from "@/assets/method-edgerunner.png.asset.json";
import completePackageArt from "@/assets/method-complete_package.png.asset.json";

/** Rules labels carry a parenthetical nickname; the wizard shows the bare name. */
function bareLabel(label: string) {
  return label.replace(/\s*\(.*\)\s*$/, "");
}

const LABELS: Record<CreationMethod, string> = {
  streetrat: bareLabel(CREATION_METHODS.streetrat.label),
  edgerunner: bareLabel(CREATION_METHODS.edgerunner.label),
  complete_package: bareLabel(CREATION_METHODS.completePackage.label),
};

/** The newer card art (docs/art-style.md), by the file name it is saved under. */
const CARD_ART: Record<CreationMethod, string> = {
  streetrat: "terms-fast",
  edgerunner: "terms-dice",
  complete_package: "terms-full",
};

/** The art the cards shipped with, until the newer art is uploaded. */
const FALLBACK_ART: Record<CreationMethod, { url: string }> = {
  streetrat: streetratArt,
  edgerunner: edgerunnerArt,
  complete_package: completePackageArt,
};

const LEVEL_LABEL: Record<MethodCopy["level"], string> = {
  1: "Fewest choices",
  2: "Some choices",
  3: "Every choice",
};

export function MethodPanel({
  state,
  onRequestMethod,
}: {
  state: ChargenState;
  onRequestMethod: (method: CreationMethod, advance?: boolean) => void;
}) {
  const [info, setInfo] = useState<CreationMethod | null>(null);
  const infoCopy = METHOD_COPY.find((m) => m.id === info) ?? null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        {METHOD_COPY.map((method, i) => (
          <MethodCard
            key={method.id}
            method={method}
            selected={state.method === method.id}
            delay={i * 120}
            onChoose={() => onRequestMethod(method.id, true)}
            onInfo={() => setInfo(method.id)}
          />
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        This only changes how your STATs, Skills and gear are made. Switching later clears just
        those; your Role, your story and your name stay.
      </p>

      <Dialog open={info !== null} onOpenChange={(open) => !open && setInfo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{info ? LABELS[info] : ""}</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              {infoCopy?.body}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MethodCard({
  method,
  selected,
  delay,
  onChoose,
  onInfo,
}: {
  method: MethodCopy;
  selected: boolean;
  delay: number;
  onChoose: () => void;
  onInfo: () => void;
}) {
  const fresh = uploadedAsset(CARD_ART[method.id]);
  const src = fresh ?? FALLBACK_ART[method.id].url;
  const rows: [string, string][] = [
    ["Body", method.decides.body],
    ["Skills", method.decides.skills],
    ["Gear", method.decides.gear],
  ];

  return (
    <article
      style={{ animationDelay: `${delay}ms` }}
      className={cn(
        "cg-arrive group relative flex min-h-[25rem] flex-col justify-end overflow-hidden border bg-card transition-[border-color,box-shadow] duration-300 sm:min-h-[27rem]",
        selected
          ? "border-accent shadow-[0_0_0_1px_var(--color-accent),0_0_40px_-10px_var(--color-accent)]"
          : "border-border hover:border-accent/60",
      )}
    >
      <img
        src={src}
        alt=""
        aria-hidden
        loading="lazy"
        className={cn(
          "absolute inset-0 h-full w-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.04]",
          // The first Edgerunner art frames its subject further back; zoom to match the others.
          !fresh && method.id === "edgerunner" && "scale-[1.35] origin-[35%_40%]",
        )}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/85 via-45% to-transparent" />

      {/* The whole card is the choice. */}
      <button
        type="button"
        onClick={onChoose}
        aria-pressed={selected}
        aria-label={`${method.plain}: ${method.headline}`}
        className="absolute inset-0 z-10 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      />
      <button
        type="button"
        onClick={onInfo}
        aria-label={`About ${LABELS[method.id]}: the numbers`}
        className="absolute right-3 top-3 z-20 grid size-8 place-items-center rounded-full border border-border bg-background/70 text-muted-foreground backdrop-blur transition-colors hover:border-accent hover:text-accent"
      >
        <HelpCircle className="size-4" aria-hidden />
      </button>
      {selected && (
        <span className="absolute left-3 top-3 z-20 bg-accent px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-background">
          Your terms
        </span>
      )}

      <div className="pointer-events-none relative space-y-3 p-5">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {LABELS[method.id]}
          </p>
          <h2 className="text-2xl font-bold tracking-tight">{method.plain}</h2>
          <p className="mt-1 text-sm font-semibold leading-snug text-accent">{method.headline}</p>
        </div>

        <dl className="space-y-1 border-t border-border/70 pt-3 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-3">
              <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {label}
              </dt>
              <dd className="text-right text-foreground">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="flex items-center justify-between gap-3">
          <span className="flex gap-1" aria-hidden>
            {[1, 2, 3].map((n) => (
              <span
                key={n}
                className={cn("h-1.5 w-5", n <= method.level ? "bg-accent" : "bg-border")}
              />
            ))}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {LEVEL_LABEL[method.level]}
          </span>
        </div>

        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground transition-colors group-hover:text-accent">
          {selected ? "Continue →" : "These terms →"}
        </p>
      </div>
    </article>
  );
}
