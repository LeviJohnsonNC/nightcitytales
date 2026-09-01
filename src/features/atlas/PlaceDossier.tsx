/**
 * The dossier for a piece of Night City: what the atlas says about a district
 * or one of its named locations. Presentation only — every fact comes from the
 * engine's geography module, which reads the official atlas data.
 */
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  areaOf,
  districtOfPlace,
  getDistrict,
  isCombatZone,
  type District,
  type Place,
} from "@/engine";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-sm leading-relaxed">
      <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
        {label}{" "}
      </span>
      <span className="text-foreground/90">{value}</span>
    </p>
  );
}

export function DistrictBody({ district }: { district: District }) {
  const area = areaOf(district.key);
  return (
    <div className="space-y-3">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
          District {district.code}
          {area ? ` · ${area.name}` : ""}
          {isCombatZone(district.key) ? " · Combat Zone" : ""}
        </p>
        <h2 className="text-lg font-bold leading-tight">{district.name}</h2>
      </div>
      <p className="text-sm leading-relaxed text-foreground/90">{district.blurb}</p>
      {district.cityManager ? <Field label="City Manager" value={district.cityManager} /> : null}
      {district.security ? <Field label="Security" value={district.security} /> : null}
      {district.gangs.length ? <Field label="Gangs" value={district.gangs.join(", ")} /> : null}
      {district.locations.length ? (
        <div className="space-y-1 border-t border-hairline pt-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
            Known locations
          </p>
          <ul className="space-y-1">
            {district.locations.map((l) => (
              <li key={l.key} className="text-sm leading-relaxed">
                <span className="font-mono text-[10px] text-accent">{l.code}</span>{" "}
                <span className="font-semibold">{l.name}</span>
                {l.blurb ? <span className="text-foreground/70"> — {l.blurb}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function PlaceBody({ place, district }: { place: Place; district: District }) {
  const area = areaOf(district.key);
  return (
    <div className="space-y-3">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
          {place.code} · {district.name}
          {area ? ` · ${area.name}` : ""}
        </p>
        <h2 className="text-lg font-bold leading-tight">{place.name}</h2>
      </div>
      {place.blurb ? (
        <p className="text-sm leading-relaxed text-foreground/90">{place.blurb}</p>
      ) : null}
      <div className="space-y-2 border-t border-hairline pt-3">
        <p className="text-sm leading-relaxed text-foreground/80">{district.blurb}</p>
        {district.security ? <Field label="Security" value={district.security} /> : null}
        {district.gangs.length ? <Field label="Gangs" value={district.gangs.join(", ")} /> : null}
      </div>
    </div>
  );
}

/** Dossier dialog for either a district key or a location key. */
export function PlaceDossier({
  targetKey,
  open,
  onOpenChange,
  action,
}: {
  targetKey: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Optional footer control, e.g. "Travel here". */
  action?: React.ReactNode;
}) {
  const placeDistrict = districtOfPlace(targetKey);
  const district = placeDistrict ?? getDistrict(targetKey);
  if (!district) return null;
  const place = placeDistrict?.locations.find((l) => l.key === targetKey.toLowerCase());
  const title = place ? place.name : district.name;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-[92vw] overflow-y-auto border border-hairline bg-surface p-5 sm:max-w-lg">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {place ? <PlaceBody place={place} district={district} /> : <DistrictBody district={district} />}
        {action ? <div className="border-t border-hairline pt-3">{action}</div> : null}
        <p className="border-t border-hairline pt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Night City Atlas
        </p>
      </DialogContent>
    </Dialog>
  );
}
