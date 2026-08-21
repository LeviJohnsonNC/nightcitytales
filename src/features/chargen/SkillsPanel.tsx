import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  BASIC_SKILLS,
  SKILLS,
  canAddSkillEntry,
  skillEntryLimits,
  type SkillLimits,
  SKILL_PACKAGE_RULES,
  getSkill,
  getRoleSkillIds,
  rolePackageEntries,
  skillBase,
  skillEntryKey,
  skillEntryName,
  skillPointCost,
  validateSkillEntries,
  type SkillDefinition,
  type SkillEntry,
  type StatKey,
} from "@/engine";
import { readGeneralLifepath } from "./lifepathState";
import { useChargenStore, type ChargenState } from "./store";

/** Rulebook categories, in the order skills.json lists them. */
const CATEGORIES: string[] = [...new Set(SKILLS.map((s) => s.category))];
const EDGERUNNER_RULES = SKILL_PACKAGE_RULES.edgerunner;
const COMPLETE_RULES = SKILL_PACKAGE_RULES.completePackage;

function statValue(state: ChargenState, stat: string): number | null {
  const value = state.stats[stat as StatKey];
  return typeof value === "number" ? value : null;
}

/** The free Cultural Origin Language, granted by the Lifepath step. */
function grantedLanguage(state: ChargenState): SkillEntry | null {
  const language = readGeneralLifepath(state.lifepath.general).language;
  if (!language) return null;
  return {
    skillId: "language",
    specialization: language.value,
    level: language.rank,
    granted: true,
  };
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-l-2 border-ember/70 bg-ember/5 p-3 text-sm text-text-muted">{children}</p>
  );
}

/**
 * The controls make illegal states unreachable, so the only thing left to say
 * is how many points are still unspent.
 */
function Guidance({ remaining }: { remaining: number }) {
  if (remaining === 0) {
    return (
      <p className="border-l-2 border-success bg-success/5 p-3 text-sm text-text-muted">
        Every Skill rule is satisfied — you can move on.
      </p>
    );
  }
  return (
    <p className="border-l-2 border-ember/70 bg-ember/5 p-3 text-sm text-text-muted">
      You have {remaining} Skill {remaining === 1 ? "Point" : "Points"} left to spend.
    </p>
  );
}

function SkillRow({
  entry,
  state,
  readOnly,
  limits,
  onLevel,
  onRemove,
}: {
  entry: SkillEntry;
  state: ChargenState;
  readOnly?: boolean | undefined;
  limits?: SkillLimits | undefined;
  onLevel?: ((level: number) => void) | undefined;
  onRemove?: (() => void) | undefined;
}) {
  const skill = getSkill(entry.skillId);
  const stat = statValue(state, skill.stat);
  const base = stat === null ? null : skillBase(stat, entry.level);
  const cost = skillPointCost(entry.skillId, 0, entry.level);

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-hairline px-4 py-2 last:border-b-0">
      <div className="min-w-52 flex-1">
        <p className="font-medium text-text">
          {skillEntryName(entry)}
          {skill.doubleCost && (
            <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-ember">
              ×2
            </span>
          )}
          {entry.granted && (
            <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-cool">
              granted
            </span>
          )}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim">
          {skill.stat.toUpperCase()} · {skill.category}
          {!entry.granted && ` · ${cost} pts`}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {!readOnly && onLevel && (
          <Button
            variant="outline"
            size="sm"
            disabled={limits ? !limits.canDecrease : false}
            title={limits?.decreaseReason ?? `Lower ${skillEntryName(entry)}`}
            aria-label={`Lower ${skillEntryName(entry)}`}
            onClick={() => onLevel(entry.level - 1)}
          >
            −
          </Button>
        )}
        <span className="num w-10 text-center font-mono text-lg font-semibold tabular-nums text-text">
          {entry.level}
        </span>
        {!readOnly && onLevel && (
          <Button
            variant="outline"
            size="sm"
            disabled={limits ? !limits.canIncrease : false}
            title={limits?.increaseReason ?? `Raise ${skillEntryName(entry)}`}
            aria-label={`Raise ${skillEntryName(entry)}`}
            onClick={() => onLevel(entry.level + 1)}
          >
            +
          </Button>
        )}
      </div>

      <div className="w-28 border border-hairline bg-surface-raised px-3 py-1 text-center">
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-text-dim">Skill Base</p>
        <p className="num font-mono text-2xl font-bold tabular-nums text-ember">{base ?? "—"}</p>
      </div>

      {onRemove && (
        <Button variant="ghost" size="sm" onClick={onRemove}>
          Remove
        </Button>
      )}
    </div>
  );
}

function CategoryGroups({
  entries,
  state,
  readOnly,
  limitsFor,
  onLevel,
  onRemove,
}: {
  entries: SkillEntry[];
  state: ChargenState;
  readOnly?: boolean | undefined;
  limitsFor?: ((entry: SkillEntry) => SkillLimits) | undefined;
  onLevel?: ((entry: SkillEntry, level: number) => void) | undefined;
  onRemove?: ((entry: SkillEntry) => void) | undefined;
}) {
  return (
    <div className="space-y-4">
      {CATEGORIES.map((category) => {
        const rows = entries.filter((e) => getSkill(e.skillId).category === category);
        if (rows.length === 0) return null;
        return (
          <section key={category}>
            <h3 className="mb-1 font-mono text-[11px] uppercase tracking-[0.25em] text-accent-foreground/80 text-ember">
              {category}
            </h3>
            <div className="border border-hairline bg-surface">
              {rows.map((entry) => (
                <SkillRow
                  key={skillEntryKey(entry)}
                  entry={entry}
                  state={state}
                  readOnly={readOnly}
                  limits={limitsFor ? limitsFor(entry) : undefined}
                  onLevel={onLevel ? (level) => onLevel(entry, level) : undefined}
                  onRemove={onRemove ? () => onRemove(entry) : undefined}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Budget({
  spent,
  remaining,
  budget,
}: {
  spent: number;
  remaining: number;
  budget: number;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3 border border-hairline bg-surface p-4">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-dim">
          Skill Points remaining
        </p>
        <p
          className={cn(
            "num font-mono text-4xl font-bold tabular-nums",
            remaining < 0 ? "text-danger" : "text-text",
          )}
        >
          {remaining}
        </p>
      </div>
      <p className="font-mono text-[11px] text-text-dim">
        {spent} of {budget} spent · ×2 Skills cost 2 points per Level
      </p>
    </div>
  );
}

function StreetratBranch({ state }: { state: ChargenState }) {
  const patch = useChargenStore((s) => s.patch);
  const roleId = state.roleId!;
  const granted = grantedLanguage(state);
  const entries = useMemo(() => rolePackageEntries(roleId), [roleId]);
  const all = granted ? [...entries, granted] : entries;

  // The fixed package is what gets written to the sheet, so store it as-is.
  useEffect(() => {
    if (state.skills.length === 0) patch({ skills: entries });
  }, [entries, state.skills.length, patch]);

  return (
    <div className="space-y-4">
      <Notice>
        Streetrat takes the Role's printed Skill package exactly as written — no points to
        spend and nothing to adjust. Your free Cultural Origin Language sits alongside it at
        Rank 4, granted rather than purchased.
      </Notice>
      <CategoryGroups entries={all} state={state} readOnly />
    </div>
  );
}

function EdgerunnerBranch({ state }: { state: ChargenState }) {
  const patch = useChargenStore((s) => s.patch);
  const roleId = state.roleId!;
  const granted = grantedLanguage(state);

  // Every Role Skill starts at the rules floor, never at zero.
  useEffect(() => {
    if (state.skills.length > 0) return;
    patch({
      skills: rolePackageEntries(roleId).map((entry) => ({
        ...entry,
        level: EDGERUNNER_RULES.minLevel,
      })),
    });
  }, [roleId, state.skills.length, patch]);

  const result = validateSkillEntries({ method: "edgerunner", roleId, entries: state.skills });

  const limitsFor = (entry: SkillEntry) =>
    skillEntryLimits({ method: "edgerunner", roleId, entries: state.skills, entry });

  function setLevel(target: SkillEntry, level: number) {
    // Clamp as a second line of defence — the buttons already prevent this.
    const limits = limitsFor(target);
    const clamped = Math.min(limits.max, Math.max(limits.min, level));
    patch({
      skills: state.skills.map((e) =>
        skillEntryKey(e) === skillEntryKey(target) ? { ...e, level: clamped } : e,
      ),
    });
  }


  return (
    <div className="space-y-4">
      <Notice>
        Only this Role's listed Skills are available to an Edgerunner, each starting at the floor of{" "}
        {EDGERUNNER_RULES.minLevel} and capped at {EDGERUNNER_RULES.maxLevel}. The Skill Base
        on the right is the number you actually roll in play: STAT + Skill Level.
      </Notice>
      <Budget
        spent={result.pointsSpent}
        remaining={result.pointsRemaining}
        budget={EDGERUNNER_RULES.skillPoints}
      />
      <Guidance remaining={result.pointsRemaining} />
      <CategoryGroups
        entries={granted ? [...state.skills, granted] : state.skills}
        state={state}
        limitsFor={limitsFor}
        onLevel={(entry, level) => !entry.granted && setLevel(entry, level)}
      />
    </div>
  );
}

function CompletePackageBranch({ state }: { state: ChargenState }) {
  const patch = useChargenStore((s) => s.patch);
  const granted = grantedLanguage(state);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [stat, setStat] = useState<string | null>(null);
  const [roleOnly, setRoleOnly] = useState(false);
  const [spec, setSpec] = useState<Record<string, string>>({});

  const roleSkillIds = useMemo(
    () => new Set(state.roleId ? getRoleSkillIds(state.roleId) : []),
    [state.roleId],
  );

  // The 13 Basic Skills must be present, so seed them at the minimum.
  useEffect(() => {
    if (state.skills.length > 0) return;
    patch({
      skills: BASIC_SKILLS.filter((id) => !getSkill(id).requiresSpecialization).map((id) => ({
        skillId: id,
        specialization: null,
        level: COMPLETE_RULES.basicSkillMinimum,
      })),
    });
  }, [state.skills.length, patch]);

  const result = validateSkillEntries({ method: "complete_package", entries: state.skills });

  const stats = [...new Set(SKILLS.map((s) => s.stat))];
  const visible = SKILLS.filter((skill) => {
    if (query && !skill.name.toLowerCase().includes(query.toLowerCase())) return false;
    if (category && skill.category !== category) return false;
    if (stat && skill.stat !== stat) return false;
    if (roleOnly && !roleSkillIds.has(skill.id)) return false;
    return true;
  });

  const limitsFor = (entry: SkillEntry) =>
    skillEntryLimits({ method: "complete_package", entries: state.skills, entry });

  /** Level a newly added Skill starts at, and what it costs. */
  const ADD_LEVEL = COMPLETE_RULES.basicSkillMinimum;

  function addability(skill: SkillDefinition) {
    return canAddSkillEntry({
      method: "complete_package",
      entries: state.skills,
      skillId: skill.id,
      specialization: skill.requiresSpecialization ? (spec[skill.id] ?? "").trim() || null : null,
      level: ADD_LEVEL,
    });
  }

  function setLevel(target: SkillEntry, level: number) {
    // Clamp as a second line of defence — the buttons already prevent this.
    const limits = limitsFor(target);
    const clamped = Math.min(limits.max, Math.max(limits.min, level));
    patch({
      skills: state.skills.map((e) =>
        skillEntryKey(e) === skillEntryKey(target) ? { ...e, level: clamped } : e,
      ),
    });
  }

  function addSkill(skill: SkillDefinition) {
    if (!addability(skill).allowed) return;
    const specialization = skill.requiresSpecialization ? (spec[skill.id] ?? "").trim() : null;
    const entry: SkillEntry = { skillId: skill.id, specialization, level: ADD_LEVEL };
    patch({ skills: [...state.skills, entry] });
    if (skill.requiresSpecialization) setSpec((s) => ({ ...s, [skill.id]: "" }));
  }

  function removeSkill(target: SkillEntry) {
    patch({
      skills: state.skills.filter((e) => skillEntryKey(e) !== skillEntryKey(target)),
    });
  }

  return (
    <div className="space-y-5">
      <Notice>
        The whole Master Skill List is open to you — {COMPLETE_RULES.skillPoints} points, no
        Skill above {COMPLETE_RULES.maxLevel}, and the 13 Basic Skills at{" "}
        {COMPLETE_RULES.basicSkillMinimum} or better. The "Suggested for your Role" chip only
        filters the list; it never restricts what you may buy.
      </Notice>
      <Budget
        spent={result.pointsSpent}
        remaining={result.pointsRemaining}
        budget={COMPLETE_RULES.skillPoints}
      />
      <Guidance remaining={result.pointsRemaining} />

      <section className="space-y-3">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.25em] text-ember">
          Your sheet
        </h3>
        <CategoryGroups
          entries={granted ? [...state.skills, granted] : state.skills}
          state={state}
          limitsFor={limitsFor}
          onLevel={(entry, level) => !entry.granted && setLevel(entry, level)}
          onRemove={(entry) =>
            !entry.granted && !BASIC_SKILLS.includes(entry.skillId) ? removeSkill(entry) : undefined
          }
        />
      </section>

      <section className="space-y-3">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.25em] text-ember">
          Master Skill List
        </h3>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search skills…"
          aria-label="Search skills"
        />
        <div className="flex flex-wrap gap-2">
          <Chip active={roleOnly} onClick={() => setRoleOnly(!roleOnly)}>
            Suggested for your Role
          </Chip>
          {CATEGORIES.map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(category === c ? null : c)}>
              {c}
            </Chip>
          ))}
          {stats.map((s) => (
            <Chip key={s} active={stat === s} onClick={() => setStat(stat === s ? null : s)}>
              {s.toUpperCase()}
            </Chip>
          ))}
        </div>

        <div className="border border-hairline bg-surface">
          {visible.map((skill) => {
            const taken = state.skills.some(
              (e) => e.skillId === skill.id && !skill.requiresSpecialization,
            );
            const add = addability(skill);
            return (
              <div
                key={skill.id}
                className="flex flex-wrap items-center gap-3 border-b border-hairline px-4 py-2 last:border-b-0"
              >
                <div className="min-w-52 flex-1">
                  <p className="text-text">
                    {skill.name}
                    {skill.doubleCost && (
                      <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-ember">
                        ×2
                      </span>
                    )}
                    {roleSkillIds.has(skill.id) && (
                      <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-cool">
                        Role
                      </span>
                    )}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim">
                    {skill.stat.toUpperCase()} · {skill.category}
                  </p>
                </div>
                {skill.requiresSpecialization && (
                  <Input
                    className="w-48"
                    value={spec[skill.id] ?? ""}
                    onChange={(e) => setSpec((s) => ({ ...s, [skill.id]: e.target.value }))}
                    placeholder={skill.specializationLabel ?? "specialization"}
                    aria-label={`${skill.name} ${skill.specializationLabel ?? "specialization"}`}
                  />
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={taken || !add.allowed}
                  title={taken ? "Already on your sheet" : (add.reason ?? `Add ${skill.name}`)}
                  onClick={() => addSkill(skill)}
                >
                  {taken ? "On sheet" : "Add"}
                </Button>
              </div>
            );
          })}
          {visible.length === 0 && (
            <p className="p-4 text-sm text-text-muted">No Skill matches those filters.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.15em] transition-colors duration-200",
        active
          ? "border-ember bg-ember/15 text-ember"
          : "border-hairline text-text-dim hover:text-text",
      )}
    >
      {children}
    </button>
  );
}

export function SkillsPanel({ state }: { state: ChargenState }) {
  if (!state.method) {
    return <p className="text-sm text-text-muted">Choose a creation method first.</p>;
  }
  if (state.method !== "complete_package" && !state.roleId) {
    return (
      <p className="text-sm text-text-muted">
        Pick a Role first — the Skill package is read from that Role's list.
      </p>
    );
  }
  if (state.method === "streetrat") return <StreetratBranch state={state} />;
  if (state.method === "edgerunner") return <EdgerunnerBranch state={state} />;
  return <CompletePackageBranch state={state} />;
}
