/**
 * The full character sheet, laid out in the same order as the printed
 * Cyberpunk RED three-page sheet so a player can cross-reference cell by cell.
 * Display only: every number arrives pre-computed from the engine.
 */
import { getRole, type AssembledCharacter, type CharacterBuild } from "@/engine";
import { ArtSlot } from "./ArtSlot";
import { portraitArt, portraitById } from "./art";
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
  note?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`sheet-panel border border-hairline bg-surface p-4 ${className ?? ""}`}>
      <header className="mb-3 flex flex-wrap items-baseline gap-x-3 border-b border-hairline pb-2">
        <h2 className="font-display text-[13px] font-bold uppercase tracking-[0.18em] text-text">
          {title}
        </h2>
        {note && <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-dim">{note}</p>}
      </header>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm italic text-text-dim">{children}</p>;
}

function Box({ label, value, sub }: { label: string; value: string; sub?: string }) {
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

export function CharacterSheet({
  state,
  build,
  sheet,
}: {
  state: ChargenState;
  build: CharacterBuild;
  sheet: AssembledCharacter;
}) {
  const role = build.roleId ? getRole(build.roleId) : null;
  const portrait = build.portraitId ? portraitById(build.portraitId) : undefined;
  const general = readGeneralLifepath(state.lifepath.general);
  const roleLifepath = readRoleLifepath(state.lifepath.roleSpecific, build.roleId);

  const generalLines: string[] = [
    ...SINGLE_LIFEPATH_TABLES.map((id) => general.entries[id]).filter(Boolean).map((e) => sentenceFor(e!)),
    ...(general.language ? [languageSentence(general.language)] : []),
    ...general.friends.map(friendSentence),
    ...general.tragicLove.map(loveSentence),
    ...general.enemies.flatMap(enemySentences),
  ];
  const roleLines = build.roleId ? roleLifepathSentences(build.roleId, roleLifepath.entries) : [];

  return (
    <div className="sheet space-y-4">
      {/* 1 — Identity */}
      <section className="sheet-page-1 grid gap-4 border border-hairline bg-surface p-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <div className="aspect-[3/4] w-full">
          {portrait ? (
            <ArtSlot art={portraitArt(portrait)} label={build.name || "Portrait"} />
          ) : (
            <div className="flex h-full items-center justify-center border border-dashed border-hairline text-center font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim">
              No portrait
            </div>
          )}
        </div>
        <div className="min-w-0 space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ember">
            {role ? role.name : "No Role"}
          </p>
          <h1 className="font-display text-3xl font-bold leading-tight text-text">
            {build.name || "Unnamed"}
          </h1>
          <p className="text-sm text-text-muted">
            {build.handle ? `"${build.handle}"` : "no handle"}
            {build.pronouns ? ` · ${build.pronouns}` : ""}
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
              <div className="border border-dashed border-hairline p-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-dim">
                  Critical Injuries
                </p>
                <p className="mt-2 text-sm italic text-text-dim">None at creation. Space for play.</p>
              </div>
              <div className="border border-dashed border-hairline p-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-dim">
                  Addictions
                </p>
                <p className="mt-2 text-sm italic text-text-dim">None at creation. Space for play.</p>
              </div>
            </div>
          </div>
        )}
      </Panel>

      {/* 4 — Skills */}
      <Panel title="Skills" note="Level · STAT · Skill Base">
        {sheet.skills.length === 0 ? (
          <Empty>No skills on the sheet yet.</Empty>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {sheet.skillsByCategory.map((group) => (
              <div key={group.category}>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ember">
                  {group.category}
                </p>
                <table className="mt-1 w-full text-sm">
                  <tbody>
                    {group.lines.map((line) => (
                      <tr key={line.key} className="border-b border-hairline/60">
                        <td className="py-1 pr-2 text-text">
                          {line.name}
                          {line.doubleCost && <span className="text-text-dim"> (x2)</span>}
                          {line.granted && (
                            <span className="ml-1 font-mono text-[10px] uppercase text-text-dim">
                              free
                            </span>
                          )}
                        </td>
                        <td className="num py-1 text-right text-text-muted">{line.level}</td>
                        <td className="num py-1 pl-2 text-right font-mono text-[11px] uppercase text-text-dim">
                          {line.stat}
                          {line.statValue !== null ? ` ${line.statValue}` : ""}
                        </td>
                        <td className="num py-1 pl-3 text-right font-bold text-ember">
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
        {sheet.weapons.length === 0 && sheet.packageWeaponsArmor.length === 0 ? (
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
                        {w.name}
                        {w.qty > 1 ? ` ×${w.qty}` : ""}
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
            {sheet.packageWeaponsArmor.length > 0 && (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-dim">
                  From your Role package, as printed
                </p>
                <ul className="mt-1 space-y-0.5 text-sm text-text-muted">
                  {sheet.packageWeaponsArmor.map((entry, i) => (
                    <li key={i}>
                      {"item" in entry ? `${entry.item}${entry.qty > 1 ? ` ×${entry.qty}` : ""}` : entry.choice.join(" or ")}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Panel>

      <Panel title="Armor" note="SP and penalty by location">
        {sheet.armor.length === 0 ? (
          <Empty>Nothing worn.</Empty>
        ) : (
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
                  <td className="py-1 text-text">{a.name}</td>
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
      </Panel>

      {/* 6 — Improvement Points and Reputation */}
      <Panel title="Improvement Points & Reputation">
        <p className="border-l-2 border-ember bg-ember/10 p-3 text-sm text-text-muted">
          Rules data missing: src/data/rules/creation-rules.json has no
          <span className="font-mono"> improvementPoints </span>
          or
          <span className="font-mono"> reputation </span>
          entry, so no starting values can be printed here. Add those fields and this box fills
          itself in.
        </p>
      </Panel>

      {/* 7 — General Lifepath */}
      <Panel title="General Lifepath">
        {generalLines.length === 0 ? (
          <Empty>No Lifepath answers yet.</Empty>
        ) : (
          <ul className="space-y-1 text-sm leading-relaxed text-text">
            {generalLines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        )}
      </Panel>

      {/* 8 — Role Lifepath */}
      <Panel title="Role-Specific Lifepath" note={role?.name}>
        {roleLines.length === 0 ? (
          <Empty>No Role Lifepath answers yet.</Empty>
        ) : (
          <ul className="space-y-1 text-sm leading-relaxed text-text">
            {roleLines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        )}
      </Panel>

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
                      {a.name}
                      {a.qty > 1 ? ` ×${a.qty}` : ""}
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
                <li key={i}>
                  {"item" in entry ? `${entry.item}${entry.qty > 1 ? ` ×${entry.qty}` : ""}` : entry.choice.join(" or ")}
                </li>
              ))}
            </ul>
          )}
          <Row label="Cash on hand" value={`${sheet.finance.eurobucks}eb`} />
        </Panel>

        <Panel title="Housing & Lifestyle">
          <Row label="Housing" value={sheet.finance.housing} />
          {sheet.finance.location && <Row label="Location" value={sheet.finance.location} />}
          <Row
            label="Rent"
            value={`${sheet.finance.rent}eb / ${sheet.finance.plan.rentPeriod}`}
          />
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
                        <span className="text-text">{install.item.name}</span>
                        {install.slots !== null && (
                          <span className="num ml-2 font-mono text-[11px] text-text-dim">
                            {install.slotsUsed}/{install.slots} slots
                          </span>
                        )}
                        {install.options.length > 0 && (
                          <ul className="ml-4 list-disc text-text-muted">
                            {install.options.map((option) => (
                              <li key={option.lineId}>{option.item.name}</li>
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
                    {sheet.packageCyberware.map((entry, i) => (
                      <li key={i}>
                        {"item" in entry ? `${entry.item}${entry.qty > 1 ? ` ×${entry.qty}` : ""}` : entry.choice.join(" or ")}
                      </li>
                    ))}
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
