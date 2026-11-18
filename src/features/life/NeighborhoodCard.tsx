import { describePosition, getPlace, travelMinutes, type TravelMode } from "@/engine";
import {
  clinicDestination,
  neighborhoodMoment,
  type Neighborhood,
  type NeighborhoodContext,
} from "@/engine/neighborhood";
import { Button } from "@/components/ui/button";

type Props = {
  state: Neighborhood;
  context: NeighborhoodContext;
  location: string;
  travelMode?: TravelMode;
  receipt?: string | null;
  journal?: boolean;
  busy: boolean;
  act: (id: string) => void;
  travel: (place: string) => void;
};

export function NeighborhoodCard({
  state,
  context,
  location,
  receipt,
  travelMode,
  journal = false,
  busy,
  act,
  travel,
}: Props) {
  const moment = neighborhoodMoment(state, context);
  const next = clinicDestination(state);
  const leads = [
    ...(!state.counterResult ? [{ place: "h8", label: "One cart, two addresses" }] : []),
    ...(!state.lanternResult ? [{ place: "h7", label: "Last set at the Lantern" }] : []),
    next,
  ].filter((lead) => lead.place !== context.place);
  function trip(lead: typeof next) {
    return (
      <button
        key={lead.place}
        type="button"
        disabled={busy}
        onClick={() => travel(lead.place)}
        className="block min-h-11 w-full border-t border-border py-2 text-left text-sm hover:text-accent focus-visible:outline-accent disabled:opacity-50"
      >
        <span className="block font-medium">{lead.label}</span>
        <span className="text-xs text-muted-foreground">
          Travel to {getPlace(lead.place)?.name} · {travelMinutes(location, lead.place, travelMode)}{" "}
          min
        </span>
      </button>
    );
  }
  const activeProject = state.keys && !state.lease && next.place !== context.place;
  if (journal)
    return leads.length ? (
      <section className="my-4">
        <h3 className="text-sm font-semibold">Word from Old Japantown</h3>
        {leads.map(trip)}
      </section>
    ) : null;
  if (!moment && !activeProject && !receipt) return null;
  return (
    <section aria-label="Old Japantown neighborhood" className="space-y-2">
      <div role="status">
        {receipt && receipt !== moment?.text && (
          <p className="border-l-2 border-border pl-3 text-sm">{receipt}</p>
        )}
      </div>
      {moment && (
        <article className="space-y-3 border-l-2 border-accent bg-card px-4 py-3">
          <div aria-live="polite" aria-atomic="true">
            <p className="font-mono text-xs text-muted-foreground">
              {getPlace(context.place ?? "")?.name ?? describePosition(location)}
            </p>
            <h3 className="text-lg font-semibold">{moment.title}</h3>
            <p className="mt-1 text-sm leading-relaxed">{moment.text}</p>
          </div>
          {moment.choices.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {moment.choices.map((c) => (
                <Button
                  key={c.id}
                  type="button"
                  variant="outline"
                  disabled={busy || !!c.disabled}
                  onClick={() => act(c.id)}
                  className="h-auto min-h-11 flex-col items-start whitespace-normal px-3 py-2 text-left"
                >
                  <span>{c.label}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {c.minutes} min · {c.cost ? c.cost + "eb" : "free"}
                    {c.heal ? " · +" + c.heal + " HP" : ""}
                    {c.disabled && " · " + c.disabled}
                  </span>
                </Button>
              ))}
            </div>
          )}
        </article>
      )}
      {activeProject && (
        <div className="border border-border px-3">
          <p className="pt-2 font-mono text-xs text-muted-foreground">Stackside Clinic</p>
          {trip(next)}
        </div>
      )}
    </section>
  );
}
