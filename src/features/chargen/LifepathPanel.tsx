import { useState, type ReactNode } from "react";
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
  rollChoiceOnlyRoleLifepathTable,
  rollLifepathCount,
  rollLifepathTable,
  rollRoleLifepathTable,
  visibleRoleLifepathTables,
  type LifepathEntryRecord,
} from "@/engine";
import { BackgroundPanel } from "./BackgroundPanel";
import { DiceRoll } from "./DiceRoll";
import { LifepathTableCard } from "./LifepathTableCard";
import { RoleLifepathTableCard } from "./RoleLifepathTableCard";
import { buildBackgroundInput } from "./lifepathBackground";
import {
  SINGLE_LIFEPATH_TABLES,
  generalLifepathComplete,
  readGeneralLifepath,
  type EnemyEntry,
  type GeneralLifepath,
} from "./lifepathState";
import { readRoleLifepath, roleLifepathComplete, type RoleLifepath } from "./roleLifepathState";
import { useChargenStore, type ChargenState } from "./store";
import { findNpc, npcArtwork } from "@/features/cast/npcDirectory";
import { fixerChapterLine, type LifepathChapterId } from "./interview";
import { PeoplePicker } from "./PeoplePicker";
import { PronounPicker } from "./PronounPicker";
import { Backdrop } from "./Backdrop";
import { uploadedAsset } from "./art";
import "./interview.css";

const newId = () => Math.random().toString(36).slice(2, 10);

const ROLE_NAMES = rolesData.roles as unknown as Record<string, { name: string }>;

/**
 * The Lifepath, asked as an interview in chapters.
 *
 * It used to be every table at once, in collapsible rows, with a "Roll all
 * remaining" button inviting the player to skip the most dramatic part of
 * making a character. Now it is five conversations with the fixer, one at a
 * time: where you come from, who you are, who is still out there (where the
 * people the dice roll become faces the player can choose), what you want, and
 * how you came to the work. The tables, rolls and rules underneath are the
 * same; only the order of asking changed.
 */
type Chapter = { id: LifepathChapterId; title: string; ids: string[] };

const CHAPTERS: Chapter[] = [
  {
    id: "origin",
    title: "Where you come from",
    ids: ["cultural_origin", "family_background", "childhood_environment", "family_crisis"],
  },
  {
    id: "self",
    title: "Who you are",
    ids: [
      "personality",
      "clothing_style",
      "hairstyle",
      "affectation",
      "value_most",
      "feel_about_people",
      "most_valued_person",
      "most_valued_possession",
    ],
  },
  { id: "people", title: "Who is still out there", ids: [] },
  { id: "drive", title: "What you want", ids: ["life_goals"] },
  { id: "work", title: "About the work", ids: [] },
];

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
    const language =
      entry.tableId === "cultural_origin" &&
      general.language?.source === "list" &&
      !languagesForCulturalOrigin(entry.value).includes(general.language.value)
        ? null
        : general.language;
    setGeneral({ ...general, entries, language });
  }

  // ---- progress ----------------------------------------------------------
  const roleTables = state.roleId
    ? visibleRoleLifepathTables(state.roleId, roleLifepath.entries)
    : [];
  const generalAnswered = SINGLE_LIFEPATH_TABLES.filter((id) => general.entries[id]).length;
  const languageAnswered = general.language ? 1 : 0;
  const roleAnswered = roleTables.filter((t) => roleLifepath.entries[t.id]).length;
  const answered = generalAnswered + languageAnswered + roleAnswered;
  const total = SINGLE_LIFEPATH_TABLES.length + 1 + roleTables.length;
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;

  // ---- background generation gate ---------------------------------------
  const roleAbilityName = state.roleAbility?.name ?? undefined;
  const unanswered = total - answered;
  const missing = [
    ...generalLifepathComplete(general),
    ...(state.roleId ? roleLifepathComplete(roleLifepath) : []),
    // Every visible table must be answered (rolled or chosen) before weaving.
    ...(unanswered > 0
      ? [`${unanswered} Lifepath ${unanswered === 1 ? "answer" : "answers"} left`]
      : []),
  ];
  const ready = missing.length === 0;

  /**
   * Fill unanswered rollable tables (leaves choices like enemies alone): the
   * general ones named, and the Role's own when asked.
   */
  function rollRemaining(ids: string[], includeRole: boolean) {
    const entries = { ...general.entries };
    for (const id of ids) {
      if (!entries[id]) entries[id] = rollLifepathTable(id, Math.random).entry;
    }
    let language = general.language;
    const region = entries["cultural_origin"]?.value;
    if (!language && region) {
      const opts = languagesForCulturalOrigin(region);
      if (opts.length) {
        const grant = culturalOriginLanguageGrant();
        const pick = opts[Math.floor(Math.random() * opts.length)]!;
        language = { value: pick, rank: grant.level, free: true, source: "list" };
      }
    }
    const nextGeneral: GeneralLifepath = { ...general, entries, language };

    let nextRole = roleLifepath;
    if (state.roleId && includeRole) {
      const rEntries = { ...roleLifepath.entries };
      // Two passes: rolling a gate can reveal a dependent table.
      for (let pass = 0; pass < 2; pass++) {
        for (const t of visibleRoleLifepathTables(state.roleId, rEntries)) {
          if (rEntries[t.id]) continue;
          rEntries[t.id] = t.die
            ? rollRoleLifepathTable(state.roleId, t.id, Math.random).entry
            : rollChoiceOnlyRoleLifepathTable(state.roleId, t.id, Math.random).entry;
        }
      }
      nextRole = {
        roleId: state.roleId,
        entries: pruneRoleLifepathAnswers(state.roleId, rEntries),
      };
    }

    patch({
      lifepath: {
        ...state.lifepath,
        general: nextGeneral as unknown as Record<string, unknown>,
        roleSpecific: nextRole as unknown as Record<string, unknown>,
      },
    });
  }

  // Any single table not placed in a chapter still gets asked, with who you are.
  const placed = new Set(CHAPTERS.flatMap((c) => c.ids));
  const leftover = SINGLE_LIFEPATH_TABLES.filter((id) => !placed.has(id));
  const chapters = CHAPTERS.map((c) =>
    c.id === "self" ? { ...c, ids: [...c.ids, ...leftover] } : c,
  );

  const done: Record<LifepathChapterId, boolean> = {
    origin: chapters[0]!.ids.every((id) => general.entries[id]) && Boolean(general.language),
    self: chapters[1]!.ids.every((id) => general.entries[id]),
    people: general.enemies.every((enemy) => enemy.injuredParty),
    drive: chapters[3]!.ids.every((id) => general.entries[id]),
    work: roleTables.length > 0 && roleAnswered >= roleTables.length,
  };
  const firstOpen = chapters.find((c) => !done[c.id])?.id ?? "origin";
  const [chapterId, setChapterId] = useState<LifepathChapterId>(firstOpen);
  const index = chapters.findIndex((c) => c.id === chapterId);
  const chapter = chapters[index]!;
  const next = chapters[index + 1];
  const fixer = state.castPlan?.picks.fixer ?? null;

  function goTo(id: LifepathChapterId) {
    setChapterId(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-4">
      {/* Sticky progress header */}
      <div className="sticky top-14 z-10 flex items-center justify-between gap-3 border border-hairline bg-surface/90 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-surface/70">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim">
            Your story
          </p>
          <p className="text-sm font-semibold text-text num">
            {answered} of {total} answered
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden h-1.5 w-36 overflow-hidden rounded-full bg-hairline sm:block">
            <div
              className="h-full bg-ember transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => rollRemaining(SINGLE_LIFEPATH_TABLES, true)}
          >
            Roll everything left
          </Button>
        </div>
      </div>

      <nav aria-label="Chapters" className="grid grid-cols-5 gap-1">
        {chapters.map((c, i) => (
          <button
            key={c.id}
            type="button"
            onClick={() => goTo(c.id)}
            aria-current={c.id === chapterId ? "step" : undefined}
            className={cn(
              "border-t-2 px-1 pt-2 text-left transition-colors",
              c.id === chapterId
                ? "border-ember text-text"
                : done[c.id]
                  ? "border-accent/60 text-text-muted hover:text-text"
                  : "border-hairline text-text-dim hover:text-text",
            )}
          >
            <span className="block font-mono text-[10px] tracking-[0.2em]">
              {String(i + 1).padStart(2, "0")}
              {done[c.id] ? " ✓" : ""}
            </span>
            <span className="block truncate text-xs font-semibold sm:text-sm">{c.title}</span>
          </button>
        ))}
      </nav>

      <section key={chapter.id} className="cg-say space-y-4">
        <ChapterLine fixer={fixer} chapter={chapter.id} title={chapter.title} />

        {chapter.id === "self" && <PronounPicker state={state} />}

        {chapter.ids.length > 0 && (
          <GeneralGroup
            title="Roll the dice, or choose"
            ids={chapter.ids}
            general={general}
            onEntry={setEntry}
            onLanguage={(language) => setGeneral({ ...general, language })}
          />
        )}

        {chapter.id === "people" && (
          <div className="space-y-6">
            <div className="space-y-4 border border-hairline/60 bg-surface/40 p-4">
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
            </div>
            <PeoplePicker state={state} />
          </div>
        )}

        {chapter.id === "work" &&
          (state.roleId ? (
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                {roleTables.map((table) => (
                  <RoleLifepathTableCard
                    key={table.id}
                    roleId={state.roleId!}
                    table={table}
                    entry={roleLifepath.entries[table.id] ?? null}
                    onChange={setRoleEntry}
                  />
                ))}
              </div>
              <BackgroundPanel
                ready={ready}
                missing={missing}
                buildInput={() =>
                  buildBackgroundInput(general, roleLifepath, roleName, roleAbilityName)
                }
                value={state.background}
                onChange={(text) => patch({ background: text })}
              />
            </div>
          ) : (
            <p className="border border-dashed border-hairline p-4 text-sm text-text-dim">
              Pick a Role and the questions about your work appear here.
            </p>
          ))}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
          {chapter.id !== "people" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => rollRemaining(chapter.ids, chapter.id === "work")}
              disabled={done[chapter.id]}
            >
              Roll this chapter
            </Button>
          ) : (
            <span />
          )}
          {next && (
            <Button size="sm" onClick={() => goTo(next.id)}>
              Next: {next.title} →
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}

/** The fixer opening a chapter, face and all. */
function ChapterLine({
  fixer,
  chapter,
  title,
}: {
  fixer: string | null;
  chapter: LifepathChapterId;
  title: string;
}) {
  const line = fixerChapterLine(fixer, chapter);
  const npc = fixer ? findNpc(fixer) : null;
  const art = npc ? npcArtwork(npc) : null;
  return (
    <header className="relative overflow-hidden">
      <Backdrop name={`chapter-${chapter}`} text="left" />
      <div
        className={cn(
          "relative flex items-start gap-3",
          uploadedAsset(`chapter-${chapter}`) && "min-h-32 border border-hairline p-4",
        )}
      >
        {art && line && (
          <img
            src={art.srcSet.split(" ")[0]}
            alt={fixer ?? ""}
            className="h-12 w-12 shrink-0 border border-hairline object-cover object-top"
          />
        )}
        <div className="space-y-1">
          <h3 className="font-display text-sm font-bold uppercase tracking-[0.14em] text-text">
            {title}
          </h3>
          {line && <p className="text-base italic leading-snug text-text-muted">“{line}”</p>}
        </div>
      </div>
    </header>
  );
}

function GeneralGroup({
  title,
  ids,
  general,
  onEntry,
  onLanguage,
}: {
  title: string;
  ids: string[];
  general: GeneralLifepath;
  onEntry: (entry: LifepathEntryRecord) => void;
  onLanguage: (language: GeneralLifepath["language"]) => void;
}) {
  const count = ids.filter((id) => general.entries[id]).length;
  const showLanguage =
    ids.includes("cultural_origin") && Boolean(general.entries["cultural_origin"]);

  return (
    <CollapsibleSection title={title} count={count} total={ids.length} defaultOpen>
      <div className="grid gap-2 sm:grid-cols-2">
        {ids.map((id) => (
          <LifepathTableCard
            key={id}
            tableId={id}
            entry={general.entries[id] ?? null}
            onChange={onEntry}
          />
        ))}
      </div>
      {showLanguage && (
        <div className="mt-2">
          <LanguagePicker
            region={general.entries["cultural_origin"]!.value}
            language={general.language}
            onChange={onLanguage}
          />
        </div>
      )}
    </CollapsibleSection>
  );
}

function CollapsibleSection({
  title,
  note,
  count,
  total,
  countLabel,
  defaultOpen = true,
  children,
}: {
  title: string;
  note?: string;
  count?: number;
  total?: number;
  countLabel?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const complete = total !== undefined && count !== undefined && count >= total;

  return (
    <section className="border border-hairline/60 bg-surface/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex min-w-0 items-baseline gap-3">
          <span className="font-display text-sm font-bold uppercase tracking-[0.14em] text-text">
            {title}
          </span>
          {note && <span className="truncate text-xs text-text-dim">{note}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {count !== undefined && (
            <span
              className={cn(
                "font-mono text-[10px] uppercase tracking-[0.18em] num",
                complete ? "text-cool" : "text-text-dim",
              )}
            >
              {total !== undefined ? `${count}/${total}` : `${count} ${countLabel ?? ""}`.trim()}
            </span>
          )}
          <span
            aria-hidden
            className={cn("text-text-dim transition-transform", open && "rotate-90")}
          >
            ›
          </span>
        </span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
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
    <div className="border border-hairline bg-surface p-3">
      <h4 className="font-display text-xs font-bold uppercase tracking-[0.12em] text-text">
        Free Language: {grant.skill} at Rank {grant.level}
      </h4>
      <p className="mt-1 text-xs text-text-muted">{grant.note}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() =>
              onChange({ value: option, rank: grant.level, free: true, source: "list" })
            }
            className={cn(
              "border border-hairline px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors duration-200 hover:border-ember",
              language?.value === option
                ? "border-ember bg-ember/10 text-ember"
                : "text-text-muted",
            )}
          >
            {option}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
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
          Use this
        </Button>
      </div>
    </div>
  );
}

function CountRoll({ label, onRoll }: { label: string; onRoll: (count: number) => void }) {
  const [note, setNote] = useState<string | null>(null);
  const [face, setFace] = useState<number | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <DiceRoll
        sides={10}
        size={36}
        value={face}
        label={`Roll how many ${label.toLowerCase()}`}
        roll={() => {
          const { count, result } = rollLifepathCount(Math.random);
          const rolled = result.rolls[0] ?? 1;
          return {
            face: rolled,
            commit: () => {
              setFace(rolled);
              setNote(`minus 7 gives ${count} ${label.toLowerCase()}`);
              onRoll(count);
            },
          };
        }}
      />
      <span className="font-mono text-[11px] text-text-dim num">{note ?? "Roll how many"}</span>
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
    <section className="border border-hairline bg-surface p-3">
      <header className="flex flex-wrap items-baseline gap-3">
        <h3 className="font-display text-sm font-bold uppercase tracking-[0.14em] text-text">
          {title}
        </h3>
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

      <div className="mt-3 space-y-2">
        {entries.map((entry, i) => (
          <LifepathTableCard
            key={`${tableId}-${i}`}
            tableId={tableId}
            titleOverride={`${title.replace(/s$/, "")} ${i + 1}`}
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
    <section className="border border-hairline bg-surface p-3">
      <header className="flex flex-wrap items-baseline gap-3">
        <h3 className="font-display text-sm font-bold uppercase tracking-[0.14em] text-text">
          Enemies
        </h3>
        <p className="text-xs text-text-dim">Who, what caused it, what they can throw at you.</p>
        <div className="ml-auto">
          <CountRoll
            label="Enemies"
            onRoll={(count) =>
              onChange(
                Array.from({ length: count }, () => ({ ...rollEnemy(Math.random), id: newId() })),
              )
            }
          />
        </div>
      </header>

      <div className="mt-3 space-y-3">
        {enemies.map((enemy, i) => (
          <div key={enemy.id} className="border border-hairline bg-surface-raised p-3">
            <div className="flex items-baseline gap-3">
              <h4 className="font-display text-xs font-bold uppercase tracking-[0.14em] text-text">
                Enemy {i + 1}
              </h4>
              <button
                type="button"
                onClick={() => onChange(enemies.filter((e) => e.id !== enemy.id))}
                className="ml-auto font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim hover:text-danger"
              >
                remove
              </button>
            </div>

            <div className="mt-2 space-y-2">
              <LifepathTableCard
                tableId="enemy_who"
                entry={enemy.who}
                onChange={(who) => update(enemy.id, { who })}
              />
              <LifepathTableCard
                tableId="enemy_cause"
                entry={enemy.cause}
                onChange={(cause) => update(enemy.id, { cause })}
              />
              <div className="flex flex-wrap items-center gap-2 border border-hairline bg-surface px-3 py-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-dim">
                  Injured party
                </span>
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
                      "border border-hairline px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors duration-200 hover:border-ember",
                      enemy.injuredParty === option.key
                        ? "border-ember bg-ember/10 text-ember"
                        : "text-text-muted",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <LifepathTableCard
                tableId="enemy_throw"
                entry={enemy.throwAtYou}
                onChange={(throwAtYou) => update(enemy.id, { throwAtYou })}
              />
              <LifepathTableCard
                tableId="sweet_revenge"
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
