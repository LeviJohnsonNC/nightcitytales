import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  PACKAGE_FLAGS,
  PACKAGE_NOTES,
  getGearPackage,
  packageCatalogRow,
  packageCyberwareHumanityRolls,
  packageCyberwareRow,
  variantOptionsFor,
  isChoice,
  type PackageEntry,
} from "@/engine";
import { useLoadoutActions } from "./market";
import { ItemInfo, type ItemKindLabel } from "./ItemInfo";
import { VARIANT_FLAVOR } from "./itemFlavor";
import type { ChargenState } from "./store";

function Row({ children }: { children: React.ReactNode }) {
  return <div className="border border-hairline bg-surface p-4">{children}</div>;
}

/** The "?" modal for a printed package label, when it maps to a catalog row. */
function PackageItemInfo({ label }: { label: string }) {
  const row = packageCatalogRow(label);
  if (row && row.kind !== "fashion") {
    return (
      <ItemInfo kind={row.kind as ItemKindLabel} item={row.item as { id: string; name: string }} />
    );
  }
  const cyber = packageCyberwareRow(label);
  if (cyber) return <ItemInfo kind="cyberware" item={cyber as { id: string; name: string }} />;
  return null;
}

function VariantPicker({ id, label, options }: { id: string; label: string; options: string[] }) {
  const { loadout, setPackageVariant } = useLoadoutActions();
  const picked = loadout.packageVariants?.[id];
  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-dim">
          Pick the specific weapon
        </span>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={picked === option}
            aria-label={`${label}: ${option}`}
            onClick={() => setPackageVariant(id, option)}
            className={cn(
              "border px-2 py-0.5 font-mono text-[11px] tracking-wide transition-colors",
              picked === option
                ? "border-ember bg-ember/10 text-ember"
                : "border-hairline text-text-muted hover:border-ember",
            )}
          >
            {option}
          </button>
        ))}
      </div>
      {picked && VARIANT_FLAVOR[picked] && (
        <p className="mt-1.5 text-xs leading-relaxed text-text-dim">{VARIANT_FLAVOR[picked]}</p>
      )}
    </div>
  );
}

function PackageEntries({
  entries,
  field,
}: {
  entries: PackageEntry[];
  field: "weaponsArmor" | "gear" | "cyberware";
}) {
  const { loadout, setChoice } = useLoadoutActions();
  return (
    <ul className="space-y-2">
      {entries.map((entry, i) => {
        const id = `${field}.${i}`;
        if (isChoice(entry)) {
          const picked = loadout.packageChoices[id];
          const variants = picked ? variantOptionsFor(picked) : [];
          return (
            <li key={id} className="border border-dashed border-ember/60 bg-ember/5 p-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ember">
                Pick exactly one
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {entry.choice.map((option) => (
                  <span key={option} className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant={picked === option ? "default" : "outline"}
                      onClick={() => setChoice(id, option)}
                    >
                      {option}
                    </Button>
                    <PackageItemInfo label={option} />
                  </span>
                ))}
              </div>
              {picked && variants.length > 0 && (
                <VariantPicker id={id} label={picked} options={variants} />
              )}
            </li>
          );
        }
        const variants = variantOptionsFor(entry.item);
        return (
          <li key={`${entry.item}-${i}`} className="text-sm text-text">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                {entry.item}
                <PackageItemInfo label={entry.item} />
              </span>
              <span className="font-mono tabular-nums text-text-dim">×{entry.qty}</span>
            </div>
            {variants.length > 0 && <VariantPicker id={id} label={entry.item} options={variants} />}
          </li>
        );
      })}
    </ul>
  );
}

export function StartingGearPanel({ state }: { state: ChargenState }) {
  if (!state.method || !state.roleId) {
    return (
      <div className="border border-dashed border-hairline bg-surface/50 p-6 text-sm text-text-muted">
        Choose a creation method and a Role first. Starting gear is issued per Role.
      </div>
    );
  }

  const pkg = getGearPackage(state.roleId);
  const flags = PACKAGE_FLAGS.filter((f) => f.role === state.roleId);
  const cyberHumanityLoss = packageCyberwareHumanityRolls(
    state.roleId,
    state.method,
    state.loadout.packageChoices,
  ).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      <div className="border border-hairline bg-surface-raised p-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ember">Issued kit</p>
        <p className="mt-2 text-sm text-text-muted">
          This package is fixed by your Role. Make the picks it offers here — anything you want on
          top of it gets bought on the next step, with the eurobucks the package leaves you.
        </p>
      </div>

      <Row>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-dim">
          Weapons & Armor
        </p>
        <div className="mt-3">
          <PackageEntries entries={pkg.weaponsArmor} field="weaponsArmor" />
        </div>
        <p className="mt-3 text-xs text-text-muted">{PACKAGE_NOTES.armor}</p>
      </Row>
      <Row>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-dim">Gear</p>
        <div className="mt-3">
          <PackageEntries entries={pkg.gear} field="gear" />
        </div>
      </Row>
      <Row>
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-dim">
            Cyberware
          </p>
          {cyberHumanityLoss > 0 ? (
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-danger">
              −{cyberHumanityLoss} Humanity
            </p>
          ) : null}
        </div>
        <div className="mt-3">
          {pkg.cyberware.length > 0 ? (
            <PackageEntries entries={pkg.cyberware} field="cyberware" />
          ) : (
            <p className="text-sm text-text-muted">This Role starts with no cyberware.</p>
          )}
        </div>
        <p className="mt-3 text-xs text-text-muted">
          Applied to your Humanity at creation. Where an entry is a choice, pick exactly one.
        </p>
      </Row>
      <Row>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-dim">Outfit</p>
        <ul className="mt-3 space-y-1 text-sm text-text">
          {pkg.outfit.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-text-muted">{PACKAGE_NOTES.outfit}</p>
      </Row>
      {flags.length > 0 ? (
        <Row>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ember">
            Good to know
          </p>
          {flags.map((f) => (
            <p key={f.item} className="mt-2 text-sm text-text-muted">
              <span className="text-text">{f.item}</span>: {f.issue}
            </p>
          ))}
        </Row>
      ) : null}
    </div>
  );
}
