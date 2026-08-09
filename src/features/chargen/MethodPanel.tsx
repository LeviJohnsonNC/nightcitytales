import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CREATION_METHODS } from "@/engine";
import type { CreationMethod } from "@/engine";
import { METHOD_COPY } from "./copy";
import type { ChargenState } from "./store";

const LABELS: Record<CreationMethod, string> = {
  streetrat: CREATION_METHODS.streetrat.label,
  edgerunner: CREATION_METHODS.edgerunner.label,
  complete_package: CREATION_METHODS.completePackage.label,
};

export function MethodPanel({
  state,
  onRequestMethod,
}: {
  state: ChargenState;
  onRequestMethod: (method: CreationMethod) => void;
}) {
  const locked = Boolean(state.roleId);

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
                "flex flex-col border border-border bg-card p-5 transition-colors",
                selected ? "border-accent bg-accent/10" : "hover:border-accent/50",
              )}
            >
              <h2 className="text-lg font-bold tracking-tight">{LABELS[method.id]}</h2>
              <p className="mt-1 text-sm font-semibold text-accent">{method.headline}</p>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                {method.body}
              </p>

              <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3">
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Choice level
                  </dt>
                  <dd className="font-mono text-sm font-bold uppercase text-foreground">
                    {method.choice}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Time
                  </dt>
                  <dd className="font-mono text-sm font-bold text-foreground">{method.time}</dd>
                </div>
              </dl>

              <Button
                className="mt-4"
                variant={selected ? "default" : "outline"}
                aria-pressed={selected}
                onClick={() => onRequestMethod(method.id)}
              >
                {selected ? "Selected" : locked ? "Switch & restart" : "Choose this method"}
              </Button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
