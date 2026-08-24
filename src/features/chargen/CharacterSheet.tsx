/**
 * The full character sheet, laid out in the same order as the printed
 * Cyberpunk RED three-page sheet so a player can cross-reference cell by cell.
 * Display only: every number arrives pre-computed from the engine.
 */
import rolesData from "@/data/rules/roles.json";
import {
  IMPROVEMENT_POINTS,
  REPUTATION,
  getAmmunition,
  getArmor,
  getCyberware,
  getWeapon,
  packageCatalogRow,
  packageCyberwareRow,
} from "@/engine";
import type { AssembledCharacter, CharacterBuild, PackageEntry } from "@/engine";
import { ItemInfo, type ItemKindLabel } from "./ItemInfo";
import { ArtSlot } from "./ArtSlot";
import { portraitArt, portraitById } from "./art";
import { PortraitLightbox } from "./PortraitLightbox";
import { usePortraitUrl } from "./usePortraitUrl";
import { readGeneralLifepath } from "./lifepathState";
import {
  enemySentences,
  friendSentence,
  languageSentence,
  loveSentence,
  roleLifepathSentences,
  sentenceFor,
} from "./lifepathNarrative";
import { readRoleLifepath } from "./roleLifepathState";
import { SINGLE_LIFEPATH_TABLES } from "./lifepathState";
import type { ChargenState } from "./store";

function Panel({
  title,
  note,
  children,
  className,
}: {
  title: string;
  note?: string | undefined;
  children: React.ReactNode;
  className?: string | undefined;
}) {
  return (
    <section className={`sheet-panel border border-hairline bg-surface p-4 ${className ?? ""}`}>
      <header className="mb-3 flex flex-wrap items-baseline gap-x-3 border-b border-hairline pb-2">
        <h2 className="font-display text-[13px] font-bold uppercase tracking-[0.18em] text-text">
          {title}
        </h2>
        {note && (
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-dim">{note}</p>
        )}
      </header>
      {children}
    </section>
  );
}

/** Same chrome as Panel, but folded away until the reader opens it. */
function CollapsiblePanel({
  title,
  note,
  children,
}: {
  title: string;
  note?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <details className="sheet-panel border border-hairline bg-surface p-4">
      <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-3">
        <h2 className="font-display text-[13px] font-bold uppercase tracking-[0.18em] text-text">
          {title}
        </h2>
        {note && (
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-dim">{note}</p>
        )}
      </summary>
      <div className="mt-3 border-t border-hairline pt-3">{children}</div>
    </details>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm italic text-text-dim">{children}</p>;
}

function Box({ label, value, sub }: { label: string; value: string; sub?: string | undefined }) {
  return (
    <div className="border border-hairline bg-surface-raised px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-dim">{label}</p>
      <p className="num text-2xl font-bold leading-tight text-text">{value}</p>
      {sub && <p className="font-mono text-[10px] tracking-wide text-text-dim">{sub}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hairline/60 py-1 text-sm">
      <span className="text-text-muted">{label}</span>
      <span className="num text-right text-text">{value}</span>
    </div>
  );
}

/** The "?" info modal for a catalog line already on the sheet. */
function CatalogInfo({ kind, itemId }: { kind: ItemKindLabel; itemId: string }) {
  const item =
    kind === "weapon"
      ? getWeapon(itemId)
      : kind === "armor"
        ? getArmor(itemId)
        : kind === "ammunition"
          ? getAmmunition(itemId)
          : getCyberware(itemId);
  return <ItemInfo kind={kind} item={item as never} />;
}

/** The "?" info modal for a printed Role-package label, when it resolves. */
function PackageInfo({ label }: { label: string }) {
  const row = packageCatalogRow(label);
  if (!row) return null;
  return <ItemInfo kind={row.kind as ItemKindLabel} item={row.item as never} />;
}

export function CharacterSheet({
  state,
  build,
  sheet,
  improvementPoints,
}: {
  state: ChargenState;
  build: CharacterBuild;
  sheet: AssembledCharacter;
  /** The saved career I.P. total; omitted during creation, where it is 0. */
  improvementPoints?: number;
}) {
  const roles = rolesData.roles as unknown as Record<string, { name: string }>;
  const role = build.roleId ? (roles[build.roleId] ?? null) : null;
  const portrait = build.portraitId ? portraitById(build.portraitId) : undefined;
  const generatedPortrait = usePortraitUrl(build.portraitPath);
  const general = readGeneralLifepath(state.lifepath.general);
  const roleLifepath = readRoleLifepath(state.lifepath.roleSpecific, build.roleId);

  const generalLines: string[] = [
    ...SINGLE_LIFEPATH_TABLES.map((id) => general.entries[id])
      .filter(Boolean)
      .map((e) => sentenceFor(e!)),
    ...(general.language ? [languageSentence(general.language)] : []),
    ...general.friends.map(friendSentence),
    ...general.tragicLove.map(loveSentence),
    ...general.enemies.flatMap(enemySentences),
  ];
  const roleLines = build.roleId ? roleLifepathSentences(build.roleId, roleLifepath.entries) : [];

  // Role-package weapons/armor arrive on one printed list; the sheet keeps
  // armor in the Armor panel and weapons in the Weapons panel.
  const packageWeaponsArmorLines = sheet.packageWeaponsArmor.map((entry, index) => ({
    index,
    label: packageLineLabel(sheet, "weaponsArmor", entry, index),
    text: packageLineText(sheet, "weaponsArmor", entry, index),
  }));
  const isArmorLabel = (label: string) => packageCatalogRow(label)?.kind === "armor";
  const packageArmor = packageWeaponsArmorLines.filter((l) => isArmorLabel(l.label));
  const packageWeapons = packageWeaponsArmorLines.filter((l) => !isArmorLabel(l.label));

  return (
    <div className="sheet space-y-4">
      {/* 1 — Identity */}
      <section className="sheet-page-1 grid gap-4 border border-hairline bg-surface p-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <div className="neon-frame aspect-[3/4] w-full overflow-hidden">
          {generatedPortrait ? (
            <PortraitLightbox
              src={generatedPortrait}
              alt={`${build.name || "Character"} portrait`}
              subtitle={build.handle ? `"${build.handle}"` : undefined}
              className="h-full w-full"
            >
              <img
                src={generatedPortrait}
                alt={`${build.name || "Character"} portrait`}
                className="h-full w-full object-cover"
              />
            </PortraitLightbox>
          ) : portrait ? (
            <PortraitLightbox
              src={portraitArt(portrait).src}
              alt={`${build.name || "Character"} portrait`}
              subtitle={build.handle ? `"${build.handle}"` : undefined}
              className="h-full w-full"
            >
              <ArtSlot art={portraitArt(portrait)} label={build.name || "Portrait"} />
            </PortraitLightbox>
          ) : (
            <div className="flex h-full items-center justify-center border border-dashed border-hairline text-center font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim">
              No portrait
            </div>
          )}
        </div>
        <div className="min-w-0 space-y-1">
          <p className="font-display text-lg font-bold uppercase tracking-[0.22em] text-ember">
            {role ? role.name : "No Role"}
          </p>
          <h1 className="font-display text-3xl font-bold leading-tight text-text">
            {build.name || "Unnamed"}
          </h1>
          <p className="text-sm text-text-muted">
            {build.handle ? `"${build.handle}"` : "no handle"}
          </p>
          {build.roleAbility && (
            <p className="mt-3 font-mono text-xs uppercase tracking-[0.14em] text-text-muted">
              Role Ability — {build.roleAbility.name}{" "}
              <span className="num text-ember">Rank {build.roleAbility.rank}</span>
            </p>
          )}
          {build.selfDescription && (
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-text-muted">
              {build.selfDescription}
            </p>
          )}
        </div>
      </section>

      {/* 2 — STATs */}
      <Panel title="STATs" note="current / maximum">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {sheet.statOrder.map((stat) => {
            const value = sheet.stats[stat];
            const isEmp = stat === "emp";
            const current = isEmp ? sheet.empCurrent : (value ?? null);
            return (
              <Box
                key={stat}
                label={stat.toUpperCase()}
                value={current === null || current === undefined ? "—" : String(current)}
                sub={isEmp && value !== undefined ? `max ${value}` : undefined}
              />
            );
          })}
        </div>
      </Panel>

      {/* 3 — Derived */}
      <Panel title="Derived STATs" note="engine computed">
        {sheet.derived === null ? (
          <Empty>STATs are incomplete, so nothing derives yet.</Empty>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Box
                label="Hit Points"
                value={`${sheet.derived.hpMax}`}
                sub={`max ${sheet.derived.hpMax}`}
              />
              <Box label="Seriously Wounded" value={`${sheet.derived.seriouslyWoundedThreshold}`} />
              <Box label="Death Save" value={`${sheet.derived.deathSave}`} />
              <Box
                label="Humanity"
                value={`${sheet.humanity ? sheet.humanity.humanitySheet : sheet.derived.humanityMax}`}
                sub={`max ${sheet.derived.humanityMax}`}
              />
            </div>
            {sheet.humanity?.cyberpsychosisRisk && (
              <p className="border-l-2 border-danger bg-danger/10 p-2 text-sm text-text">
                Humanity is at or past the cyberpsychosis threshold.
              </p>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="min-h-20 border border-dashed border-hairline p-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-dim">
                  Critical Injuries
                </p>
              </div>
              <div className="min-h-20 border border-dashed border-hairline p-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-dim">
                  Addictions
                </p>
              </div>
            </div>
          </div>
        )}
      </Panel>

      {/* 4 — Skills */}
      <Panel title="Skills" note="Skill Base — hover a row for Level and STAT">
        {sheet.skills.length === 0 ? (
          <Empty>No skills on the sheet yet.</Empty>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {sheet.skillsByCategory.map((group) => (
              <div key={group.category}>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ember">
                  {group.category}
                </p>
                <table className="mt-1 w-full table-fixed text-sm">
                  <tbody>
                    {group.lines.map((line) => (
                      <tr
                        key={line.key}
                        className="border-b border-hairline/60"
                        title={`Level ${line.level} · ${line.stat.toUpperCase()}${
                          line.statValue !== null ? ` ${line.statValue}` : ""
                        } · Skill Base ${line.base ?? "—"}`}
                      >
                        <td className="py-1 pr-2 text-text">
                          {line.name}
                          {line.doubleCost && <span className="text-text-dim"> (x2)</span>}
                          {line.granted && (
                            <span className="ml-1 font-mono text-[10px] uppercase text-text-dim">
                              free
                            </span>
                          )}
                        </td>
                        <td className="num w-12 py-1 text-right font-bold tabular-nums text-ember">
                          {line.base ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* 5 — Weapons and Armor */}
      <Panel title="Weapons" note="damage · magazine · ROF">
        {sheet.weapons.length === 0 && packageWeapons.length === 0 ? (
          <Empty>No weapons carried.</Empty>
        ) : (
          <div className="space-y-3">
            {sheet.weapons.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-dim">
                    <th className="pb-1 text-left">Weapon</th>
                    <th className="pb-1 text-left">Skill</th>
                    <th className="pb-1 text-right">DMG</th>
                    <th className="pb-1 text-right">Mag</th>
                    <th className="pb-1 text-right">ROF</th>
                    <th className="pb-1 text-right">Hands</th>
                  </tr>
                </thead>
                <tbody>
                  {sheet.weapons.map((w) => (
                    <tr key={w.lineId} className="border-t border-hairline/60">
                      <td className="py-1 text-text">
                        <span className="inline-flex items-center gap-1.5">
                          <span>
                            {w.name}
                            {w.qty > 1 ? ` ×${w.qty}` : ""}
                          </span>
                          <CatalogInfo kind="weapon" itemId={w.itemId} />
                        </span>
                        {w.notes && <span className="block text-xs text-text-dim">{w.notes}</span>}
                      </td>
                      <td className="py-1 text-text-muted">{w.skill}</td>
                      <td className="num py-1 text-right">{w.damage}</td>
                      <td className="num py-1 text-right">{w.magazine ?? "—"}</td>
                      <td className="num py-1 text-right">{w.rof}</td>
                      <td className="num py-1 text-right">{w.handsRequired}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {packageWeapons.length > 0 && (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-dim">
                  From your Role package, as printed
                </p>
                <ul className="mt-1 space-y-0.5 text-sm text-text-muted">
                  {packageWeapons.map((line) => (
                    <li key={line.index} className="flex items-center gap-1.5">
                      <span>{line.text}</span>
                      <PackageInfo label={line.label} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Panel>

      <Panel title="Armor" note="SP and penalty by location">
        {sheet.armor.length === 0 && packageArmor.length === 0 ? (
          <Empty>Nothing worn.</Empty>
        ) : (
          <div className="space-y-3">
            {sheet.armor.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-dim">
                    <th className="pb-1 text-left">Location</th>
                    <th className="pb-1 text-left">Armor</th>
                    <th className="pb-1 text-right">SP</th>
                    <th className="pb-1 text-right">Current SP</th>
                    <th className="pb-1 text-right">Penalty</th>
                  </tr>
                </thead>
                <tbody>
                  {sheet.armor.map((a) => (
                    <tr key={a.lineId} className="border-t border-hairline/60">
                      <td className="py-1 uppercase text-text-muted">{a.location}</td>
                      <td className="py-1 text-text">
                        <span className="inline-flex items-center gap-1.5">
                          <span>{a.name}</span>
                          <CatalogInfo kind="armor" itemId={a.itemId} />
                        </span>
                      </td>
                      <td className="num py-1 text-right">{a.sp ?? "—"}</td>
                      <td className="num py-1 text-right">{a.currentSp ?? "—"}</td>
                      <td className="num py-1 text-right">
                        {a.penalty ? JSON.stringify(a.penalty).replace(/[{}"]/g, "") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {packageArmor.length > 0 && (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-dim">
                  From your Role package, as printed
                </p>
                <ul className="mt-1 space-y-0.5 text-sm text-text-muted">
                  {packageArmor.map((line) => (
                    <li key={line.index} className="flex items-center gap-1.5">
                      <span>{line.text}</span>
                      <PackageInfo label={line.label} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Panel>

      {/* 6 — Improvement Points and Reputation */}
      <Panel title="Improvement Points & Reputation">
        <div className="grid grid-cols-2 gap-3">
          <Box
            label="Improvement Points"
            value={String(improvementPoints ?? IMPROVEMENT_POINTS.startingValue)}
          />
          <Box label="Reputation Level" value={String(REPUTATION.startingValue)} />
        </div>
        <p className="mt-3 text-sm leading-relaxed text-text-muted">{REPUTATION.note}</p>
        <details className="mt-3 border border-hairline bg-surface-raised p-3">
          <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.18em] text-text-dim">
            Reputation ladder (reference for play)
          </summary>
          <p className="mt-2 text-sm text-text-muted">{REPUTATION.encounterRule}</p>
          <ul className="mt-2 space-y-1 text-sm text-text">
            {REPUTATION.levels.map((l) => (
              <li key={l.level} className="flex gap-3">
                <span className="num w-6 shrink-0 text-right text-text-dim">{l.level}</span>
                <span>{l.whoKnows}</span>
              </li>
            ))}
          </ul>
        </details>
      </Panel>

      {/* 7 — General Lifepath */}
      <CollapsiblePanel title="General Lifepath">
        {generalLines.length === 0 ? (
          <Empty>No Lifepath answers yet.</Empty>
        ) : (
          <ul className="space-y-1 text-sm leading-relaxed text-text">
            {generalLines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        )}
      </CollapsiblePanel>

      {/* 8 — Role Lifepath */}
      <CollapsiblePanel title="Role-Specific Lifepath" note={role?.name}>
        {roleLines.length === 0 ? (
          <Empty>No Role Lifepath answers yet.</Empty>
        ) : (
          <ul className="space-y-1 text-sm leading-relaxed text-text">
            {roleLines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        )}
      </CollapsiblePanel>

      {/* 9 — Outfit, ammo, cash, housing */}
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Outfit & Fashion">
          {sheet.packageOutfit.length > 0 && (
            <ul className="mb-3 space-y-0.5 text-sm text-text-muted">
              {sheet.packageOutfit.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
          {sheet.fashion.length > 0 ? (
            <table className="w-full text-sm">
              <tbody>
                {sheet.fashion.map((f) => (
                  <tr key={f.lineId} className="border-b border-hairline/60">
                    <td className="py-1 text-text">
                      {f.name}
                      {f.qty > 1 ? ` ×${f.qty}` : ""}
                    </td>
                    <td className="num py-1 text-right text-text-muted">{f.cost}eb</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            sheet.packageOutfit.length === 0 && <Empty>No outfit recorded.</Empty>
          )}
        </Panel>

        <Panel title="Ammunition, Cash & Gear">
          {sheet.ammunition.length > 0 && (
            <table className="mb-3 w-full text-sm">
              <tbody>
                {sheet.ammunition.map((a) => (
                  <tr key={a.lineId} className="border-b border-hairline/60">
                    <td className="py-1 text-text">
                      <span className="inline-flex items-center gap-1.5">
                        <span>
                          {a.name}
                          {a.qty > 1 ? ` ×${a.qty}` : ""}
                        </span>
                        <CatalogInfo kind="ammunition" itemId={a.itemId} />
                      </span>
                    </td>
                    <td className="num py-1 text-right text-text-muted">{a.cost}eb</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {sheet.packageGear.length > 0 && (
            <ul className="mb-3 space-y-0.5 text-sm text-text-muted">
              {sheet.packageGear.map((entry, i) => (
                <li key={i}>{packageLineText(sheet, "gear", entry, i)}</li>
              ))}
            </ul>
          )}
          <Row label="Cash on hand" value={`${sheet.finance.eurobucks}eb`} />
        </Panel>

        <Panel title="Housing & Lifestyle">
          <Row label="Housing" value={sheet.finance.housing} />
          {sheet.finance.location && <Row label="Location" value={sheet.finance.location} />}
          <Row label="Rent" value={`${sheet.finance.rent}eb / ${sheet.finance.plan.rentPeriod}`} />
          <Row label="Lifestyle" value={sheet.finance.lifestyle} />
          <Row
            label="Lifestyle cost"
            value={`${sheet.finance.lifestyleCost}eb / ${sheet.finance.plan.lifestyleCostPeriod}`}
          />
          {sheet.finance.plan.firstMonthFree && (
            <p className="mt-2 text-xs text-text-dim">{sheet.finance.plan.firstMonthNote}</p>
          )}
          {sheet.finance.plan.rentNote && (
            <p className="mt-2 text-xs text-text-dim">{sheet.finance.plan.rentNote}</p>
          )}
          {sheet.finance.plan.lifestyleNote && (
            <p className="mt-2 text-xs text-text-dim">{sheet.finance.plan.lifestyleNote}</p>
          )}
        </Panel>

        {/* 10 — Cyberware */}
        <Panel title="Cyberware" note="by install location">
          {sheet.cyberware.length === 0 && sheet.packageCyberware.length === 0 ? (
            <Empty>No cyberware installed.</Empty>
          ) : (
            <div className="space-y-3">
              {sheet.cyberware.map((location) => (
                <div key={location.install}>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ember">
                    {location.install} — {location.humanityLoss} Humanity
                  </p>
                  <ul className="mt-1 space-y-1 text-sm">
                    {location.installs.map((install) => (
                      <li key={install.lineId}>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="text-text">{install.item.name}</span>
                          <ItemInfo kind="cyberware" item={install.item as never} />
                        </span>
                        {install.slots !== null && (
                          <span className="num ml-2 font-mono text-[11px] text-text-dim">
                            {install.slotsUsed}/{install.slots} slots
                          </span>
                        )}
                        {install.options.length > 0 && (
                          <ul className="ml-4 space-y-1 text-text-muted">
                            {install.options.map((option) => (
                              <li key={option.lineId} className="flex items-center gap-1.5">
                                <span>{option.item.name}</span>
                                <ItemInfo kind="cyberware" item={option.item as never} />
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {sheet.packageCyberware.length > 0 && (
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-dim">
                    From your Role package, as printed
                  </p>
                  <ul className="mt-1 space-y-0.5 text-sm text-text-muted">
                    {sheet.packageCyberware.map((entry, i) => {
                      const picked =
                        "item" in entry
                          ? entry.item
                          : (sheet.packageChoices.find((c) => c.id === `cyberware.${i}`)?.picked ??
                            null);
                      const row = picked ? packageCyberwareRow(picked) : null;
                      return (
                        <li key={i} className="flex items-center gap-1.5">
                          <span>
                            {"item" in entry
                              ? `${entry.item}${entry.qty > 1 ? ` ×${entry.qty}` : ""}`
                              : (picked ?? entry.choice.join(" or "))}
                          </span>
                          {row && <ItemInfo kind="cyberware" item={row as never} />}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

/**
 * How a Role-package line reads on the sheet: the option that was picked, the
 * specific weapon when one was chosen, and the printed quantity.
 */
function packageLineText(
  sheet: AssembledCharacter,
  field: "weaponsArmor" | "gear",
  entry: PackageEntry,
  index: number,
): string {
  const id = `${field}.${index}`;
  const variant = sheet.packageVariants[id];
  if (!("item" in entry)) {
    const picked = sheet.packageChoices.find((c) => c.id === id)?.picked;
    if (!picked) return entry.choice.join(" or ");
    return variant ? `${variant} (${picked})` : picked;
  }
  const name = variant ? `${variant} (${entry.item})` : entry.item;
  return `${name}${entry.qty > 1 ? ` ×${entry.qty}` : ""}`;
}

/** The printed catalog label behind a package line, before variants/quantity. */
function packageLineLabel(
  sheet: AssembledCharacter,
  field: "weaponsArmor" | "gear",
  entry: PackageEntry,
  index: number,
): string {
  if ("item" in entry) return entry.item;
  const id = `${field}.${index}`;
  return sheet.packageChoices.find((c) => c.id === id)?.picked ?? entry.choice[0] ?? "";
}
