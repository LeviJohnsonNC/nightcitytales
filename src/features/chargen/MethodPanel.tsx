import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { METHOD_COPY } from "./copy";
import type { ChargenState } from "./store";
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

const ART: Record<CreationMethod, { url: string }> = {
  streetrat: streetratArt,
  edgerunner: edgerunnerArt,
  complete_package: completePackageArt,
};

export function MethodPanel({
  state,
  onRequestMethod,
}: {
  state: ChargenState;
  onRequestMethod: (method: CreationMethod) => void;
}) {
  const locked = Boolean(state.roleId);
  const [info, setInfo] = useState<CreationMethod | null>(null);
  const infoCopy = METHOD_COPY.find((m) => m.id === info) ?? null;

  return (
    <div className="space-y-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        {locked
          ? "Role locked — switching method now restarts the character"
          : "Switch freely until you lock a Role"}
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        {METHOD_COPY.map((method) => {
          const selected = state.method === method.id;
          return (
            <article
              key={method.id}
              className={cn(
                "flex flex-col border border-border bg-card transition-colors",
                selected ? "border-accent bg-accent/10" : "hover:border-accent/50",
              )}
            >
              <div className="aspect-[4/5] w-full overflow-hidden">
                <img
                  src={ART[method.id].url}
                  alt={`${LABELS[method.id]} key art`}
                  loading="lazy"
                  className={cn(
                    "h-full w-full object-cover",
                    // Edgerunner art frames its subject further back; zoom to match the others.
                    method.id === "edgerunner" && "scale-[1.35] origin-[35%_60%]",
                  )}
                />
              </div>

              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold tracking-tight">{LABELS[method.id]}</h2>
                  <button
                    type="button"
                    onClick={() => setInfo(method.id)}
                    aria-label={`About ${LABELS[method.id]}`}
                    className="text-muted-foreground transition-colors hover:text-accent"
                  >
                    <HelpCircle className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                <p className="mt-1 flex-1 text-sm font-semibold text-accent">{method.headline}</p>

                <Button
                  className="mt-4"
                  variant={selected ? "default" : "outline"}
                  aria-pressed={selected}
                  onClick={() => onRequestMethod(method.id)}
                >
                  {selected ? "Selected" : locked ? "Switch & restart" : "Choose this method"}
                </Button>
              </div>
            </article>
          );
        })}
      </div>

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
