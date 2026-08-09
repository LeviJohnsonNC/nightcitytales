import { useState } from "react";
import rolesData from "@/data/rules/roles.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  culturalOriginLanguageGrant,
  getLifepathTable,
  languagesForCulturalOrigin,
  pruneRoleLifepathAnswers,
  rollEnemy,
  rollLifepathCount,
  rollLifepathTable,
  visibleRoleLifepathTables,
  type LifepathEntryRecord,
} from "@/engine";
import { BiographyPanel } from "./BiographyPanel";
import { AssembledBiography, type BiographyEditRow } from "./AssembledBiography";
import { LifepathTableCard } from "./LifepathTableCard";
import { RoleLifepathTableCard } from "./RoleLifepathTableCard";
import {
  enemySentences,
  friendSentence,
  languageSentence,
  loveSentence,
  roleLifepathSentences,
  sentenceFor,
} from "./lifepathNarrative";
import {
  SINGLE_LIFEPATH_TABLES,
  readGeneralLifepath,
  type EnemyEntry,
  type GeneralLifepath,
} from "./lifepathState";
import { readRoleLifepath, type RoleLifepath } from "./roleLifepathState";
import { useChargenStore, type ChargenState } from "./store";

const newId = () => Math.random().toString(36).slice(2, 10);

const ROLE_NAMES = rolesData.roles as unknown as Record<string, { name: string }>;

export function LifepathPanel({ state }: { state: ChargenState }) {
  const patch = useChargenStore((s) => s.patch);
  const general = readGeneralLifepath(state.lifepath.general);
  const roleLifepath = readRoleLifepath(state.lifepath.roleSpecific, state.roleId);
  const roleName = state.roleId ? ROLE_NAMES[state.roleId]?.name : undefined;

  function setGeneral(next: GeneralLifepath) {
    patch({ lifepath: { ...state.lifepath, general: next as unknown as Record<string, unknown> } });
  }

  function setRoleLifepath(next: RoleLifepath) {
    patch({
      lifepath: { ...state.lifepath, roleSpecific: next as unknown as Record<string, unknown> },
    });
  }

  /** A changed gate answer clears anything it no longer reveals. */
  function setRoleEntry(entry: LifepathEntryRecord) {
    if (!state.roleId) return;
    const entries = { ...roleLifepath.entries, [entry.tableId]: entry };
    setRoleLifepath({
      roleId: state.roleId,
      entries: pruneRoleLifepathAnswers(state.roleId, entries),
    });
  }

  function setEntry(entry: LifepathEntryRecord) {
    const entries = { ...general.entries, [entry.tableId]: entry };
    // A new Cultural Origin invalidates a language picked from the old region's list.
    const language =
      entry.tableId === "cultural_origin" &&
      general.language?.source === "list" &&
      !languagesForCulturalOrigin(entry.value).includes(general.language.value)
        ? null
        : general.language;
    setGeneral({ ...general, entries, language });
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="space-y-4">
        {SINGLE_LIFEPATH_TABLES.map((tableId) => (
          <div key={tableId} className="space-y-4">
            <LifepathTableCard
              tableId={tableId}
              entry={general.entries[tableId] ?? null}
              onChange={setEntry}
            />
            {tableId === "cultural_origin" && general.entries["cultural_origin"] && (
              <LanguagePicker
                region={general.entries["cultural_origin"]!.value}
                language={general.language}
                onChange={(language) => setGeneral({ ...general, language })}
              />
            )}
          </div>
        ))}

        <RepeatableSection
          title="Friends"
          tableId="friends"
          entries={general.friends}
          onChange={(friends) => setGeneral({ ...general, friends })}
        />

        <EnemySection
          enemies={general.enemies}
          onChange={(enemies) => setGeneral({ ...general, enemies })}
        />

        <RepeatableSection
          title="Tragic Love Affairs"
          tableId="tragic_love"
          entries={general.tragicLove}
          onChange={(tragicLove) => setGeneral({ ...general, tragicLove })}
        />

        {state.roleId ? (
          <section className="border border-hairline/60 bg-surface/40 p-4">
            <header className="flex flex-wrap items-baseline gap-3">
              <h2 className="font-display text-base font-bold uppercase tracking-[0.14em] text-text">
                {roleName} Lifepath
              </h2>
              <p className="text-xs text-text-dim">
                Mixed dice — read each table's own die. Branch tables appear once you answer their
                gate.
              </p>
            </header>
            <div className="mt-4 space-y-3">
              {visibleRoleLifepathTables(state.roleId, roleLifepath.entries).map((table) => (
                <RoleLifepathTableCard
                  key={table.id}
                  roleId={state.roleId!}
                  table={table}
                  entry={roleLifepath.entries[table.id] ?? null}
                  onChange={setRoleEntry}
                />
              ))}
            </div>
          </section>
        ) : (
          <p className="border border-dashed border-hairline p-4 text-sm text-text-dim">
            Pick a Role and its own Lifepath tables appear here.
          </p>
        )}

        <AssembledBiography
          paragraphs={assembledParagraphs(general, roleLifepath, roleName)}
          rows={editRows(general, setGeneral, roleLifepath, setRoleEntry, state.roleId)}
        />
      </div>

      <aside className="xl:sticky xl:top-8 xl:self-start">
        <BiographyPanel
          lifepath={general}
          roleLifepath={roleLifepath}
          {...(roleName ? { roleName } : {})}
        />
      </aside>
    </div>
  );
}

function assembledParagraphs(
  general: GeneralLifepath,
  roleLifepath: RoleLifepath,
  roleName: string | undefined,
): string[] {
  const opening = SINGLE_LIFEPATH_TABLES.filter((id) => id !== "life_goals")
    .map((id) => general.entries[id])
    .filter(Boolean)
    .map((entry) => sentenceFor(entry!));
  if (general.language) opening.push(languageSentence(general.language));

  const people = [
    ...general.friends.map(friendSentence),
    ...general.enemies.flatMap(enemySentences),
    ...general.tragicLove.map(loveSentence),
  ];

  const goal = general.entries["life_goals"];
  const role = roleLifepath.roleId
    ? roleLifepathSentences(roleLifepath.roleId, roleLifepath.entries)
    : [];

  const paragraphs: string[] = [];
  if (opening.length) paragraphs.push(opening.join(" "));
  if (people.length) paragraphs.push(people.join(" "));
  if (goal) paragraphs.push(sentenceFor(goal));
  if (role.length) paragraphs.push(`${roleName ?? "Your Role"}: ${role.join(" ")}`);
  return paragraphs;
}

function editRows(
  general: GeneralLifepath,
  setGeneral: (next: GeneralLifepath) => void,
  roleLifepath: RoleLifepath,
  setRoleEntry: (entry: LifepathEntryRecord) => void,
  roleId: string | null,
): BiographyEditRow[] {
  const rows: BiographyEditRow[] = [];

  for (const tableId of SINGLE_LIFEPATH_TABLES) {
    const entry = general.entries[tableId];
    if (!entry) continue;
    rows.push({
      key: tableId,
      label: getLifepathTable(tableId).label,
      entry,
      onChange: (next) => setGeneral({ ...general, entries: { ...general.entries, [tableId]: next } }),
    });
  }

  general.friends.forEach((entry, i) =>
    rows.push({
      key: `friend-${i}`,
      label: `Friend ${i + 1}`,
      entry,
      onChange: (next) =>
        setGeneral({ ...general, friends: general.friends.map((e, j) => (j === i ? next : e)) }),
    }),
  );

  general.tragicLove.forEach((entry, i) =>
    rows.push({
      key: `love-${i}`,
      label: `Tragic Love ${i + 1}`,
      entry,
      onChange: (next) =>
        setGeneral({
          ...general,
          tragicLove: general.tragicLove.map((e, j) => (j === i ? next : e)),
        }),
    }),
  );

  if (roleId) {
    for (const table of visibleRoleLifepathTables(roleId, roleLifepath.entries)) {
      const entry = roleLifepath.entries[table.id];
      if (!entry) continue;
      rows.push({ key: `role-${table.id}`, label: table.label, entry, onChange: setRoleEntry });
    }
  }

  return rows;
}

function LanguagePicker({
  region,
  language,
  onChange,
}: {
  region: string;
  language: GeneralLifepath["language"];
  onChange: (language: GeneralLifepath["language"]) => void;
}) {
  const grant = culturalOriginLanguageGrant();
  const options = languagesForCulturalOrigin(region);
  const [custom, setCustom] = useState(language?.source === "custom" ? language.value : "");

  return (
    <div className="border border-hairline bg-surface p-4">
      <h3 className="font-display text-sm font-bold uppercase tracking-[0.14em] text-text">
        Free Language — {grant.skill} at Rank {grant.level}
      </h3>
      <p className="mt-1 text-xs text-text-muted">{grant.note}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() =>
              onChange({ value: option, rank: grant.level, free: true, source: "list" })
            }
            className={cn(
              "border border-hairline px-3 py-1.5 font-mono text-xs uppercase tracking-[0.12em] transition-colors duration-200 hover:border-ember",
              language?.value === option
                ? "border-ember bg-ember/10 text-ember"
                : "text-text-muted",
            )}
          >
            {option}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Input
          className="max-w-xs"
          value={custom}
          placeholder="A language outside the list"
          onChange={(e) => setCustom(e.target.value)}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={!custom.trim()}
          onClick={() =>
            onChange({ value: custom.trim(), rank: grant.level, free: true, source: "custom" })
          }
        >
          Use this language
        </Button>
      </div>
    </div>
  );
}

function CountRoll({ label, onRoll }: { label: string; onRoll: (count: number) => void }) {
  const [note, setNote] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          const { count, result } = rollLifepathCount(Math.random);
          setNote(`${result.rolls[0]} − 7 → ${count} ${label.toLowerCase()}`);
          onRoll(count);
        }}
      >
        Roll how many
      </Button>
      {note && <span className="font-mono text-[11px] text-text-dim num">{note}</span>}
    </div>
  );
}

function RepeatableSection({
  title,
  tableId,
  entries,
  onChange,
}: {
  title: string;
  tableId: string;
  entries: LifepathEntryRecord[];
  onChange: (entries: LifepathEntryRecord[]) => void;
}) {
  const table = getLifepathTable(tableId);
  const add = () => onChange([...entries, rollLifepathTable(tableId, Math.random).entry]);

  return (
    <section className="border border-hairline/60 bg-surface/40 p-4">
      <header className="flex flex-wrap items-baseline gap-3">
        <h2 className="font-display text-base font-bold uppercase tracking-[0.14em] text-text">
          {title}
        </h2>
        <p className="text-xs text-text-dim">{table.prompt}</p>
        <div className="ml-auto">
          <CountRoll
            label={title}
            onRoll={(count) =>
              onChange(
                Array.from({ length: count }, () => rollLifepathTable(tableId, Math.random).entry),
              )
            }
          />
        </div>
      </header>

      <div className="mt-4 space-y-3">
        {entries.map((entry, i) => (
          <LifepathTableCard
            key={`${tableId}-${i}`}
            tableId={tableId}
            titleOverride={`${title.replace(/s$/, "")} ${i + 1}`}
            compact
            entry={entry}
            onChange={(next) => onChange(entries.map((e, j) => (j === i ? next : e)))}
            onRemove={() => onChange(entries.filter((_, j) => j !== i))}
          />
        ))}
        <Button size="sm" variant="outline" onClick={add}>
          Add another
        </Button>
      </div>
    </section>
  );
}

function EnemySection({
  enemies,
  onChange,
}: {
  enemies: EnemyEntry[];
  onChange: (enemies: EnemyEntry[]) => void;
}) {
  const add = () => onChange([...enemies, { ...rollEnemy(Math.random), id: newId() }]);
  const update = (id: string, next: Partial<EnemyEntry>) =>
    onChange(enemies.map((e) => (e.id === id ? { ...e, ...next } : e)));

  return (
    <section className="border border-hairline/60 bg-surface/40 p-4">
      <header className="flex flex-wrap items-baseline gap-3">
        <h2 className="font-display text-base font-bold uppercase tracking-[0.14em] text-text">
          Enemies
        </h2>
        <p className="text-xs text-text-dim">
          Who, what caused it, what they can throw at you, and what happens when you meet.
        </p>
        <div className="ml-auto">
          <CountRoll
            label="Enemies"
            onRoll={(count) =>
              onChange(Array.from({ length: count }, () => ({ ...rollEnemy(Math.random), id: newId() })))
            }
          />
        </div>
      </header>

      <div className="mt-4 space-y-4">
        {enemies.map((enemy, i) => (
          <div key={enemy.id} className="border border-hairline bg-surface p-4">
            <div className="flex items-baseline gap-3">
              <h3 className="font-display text-sm font-bold uppercase tracking-[0.14em] text-text">
                Enemy {i + 1}
              </h3>
              <button
                type="button"
                onClick={() => onChange(enemies.filter((e) => e.id !== enemy.id))}
                className="ml-auto font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim hover:text-danger"
              >
                remove
              </button>
            </div>

            <div className="mt-3 space-y-3">
              <LifepathTableCard
                tableId="enemy_who"
                compact
                entry={enemy.who}
                onChange={(who) => update(enemy.id, { who })}
              />
              <LifepathTableCard
                tableId="enemy_cause"
                compact
                entry={enemy.cause}
                onChange={(cause) => update(enemy.id, { cause })}
              />
              <div className="border border-hairline bg-surface-raised p-4">
                <h4 className="font-display text-sm font-bold uppercase tracking-[0.14em] text-text">
                  Who was the injured party?
                </h4>
                <p className="mt-1 text-xs text-text-dim">A choice, not a roll.</p>
                <div className="mt-3 flex gap-2">
                  {(
                    [
                      { key: "you", label: "You were wronged" },
                      { key: "them", label: "They were wronged" },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => update(enemy.id, { injuredParty: option.key })}
                      className={cn(
                        "border border-hairline px-3 py-1.5 font-mono text-xs uppercase tracking-[0.12em] transition-colors duration-200 hover:border-ember",
                        enemy.injuredParty === option.key
                          ? "border-ember bg-ember/10 text-ember"
                          : "text-text-muted",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <LifepathTableCard
                tableId="enemy_throw"
                compact
                entry={enemy.throwAtYou}
                onChange={(throwAtYou) => update(enemy.id, { throwAtYou })}
              />
              <LifepathTableCard
                tableId="sweet_revenge"
                compact
                entry={enemy.revenge}
                onChange={(revenge) => update(enemy.id, { revenge })}
              />
            </div>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={add}>
          Add another enemy
        </Button>
      </div>
    </section>
  );
}
