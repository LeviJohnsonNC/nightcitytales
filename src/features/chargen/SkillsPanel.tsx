import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  BASIC_SKILLS,
  HOME_AREA,
  SKILLS,
  canAddSkillEntry,
  isAreaScoped,
  isHomeArea,
  matchingPreset,
  readLifestyle,
  skillEntryLimits,
  specializationOptions,
  STAT_ORDER,
  type SkillLimits,
  SKILL_PACKAGE_RULES,
  getSkill,
  getRoleSkillIds,
  rolePackageEntries,
  skillBase,
  skillEntryKey,
  skillEntryName,
  skillPointCost,
  suggestedHome,
  validateSkillEntries,
  type SkillDefinition,
  type SkillEntry,
  type StatKey,
} from "@/engine";
import { displayValue, readGeneralLifepath } from "./lifepathState";
import { SkillInfo } from "./SkillInfo";
import { AreaPicker, SpecializationPicker } from "./SkillPickers";
import { FineTune, OddsBar, WaysToWork, WhatYouCanDo } from "./SkillWays";
import { taskOdds } from "./skillTasks";
import { useChargenStore, type ChargenState } from "./store";

/** Rulebook categories, in the order skills.json lists them. */
const CATEGORIES: string[] = [...new Set(SKILLS.map((s) => s.category))];

/**
 * The neighbourhood the character lives in, if they have got that far.
 *
 * The printed creation order puts Skills before housing — `steps.ts` says that
 * order is a rules value and must not be reordered — so at the Skills step this
 * is usually null, and "Local Expert (Your Home)" is a deliberate deferral
 * rather than a blank. It resolves on screen the moment the Outfit & Lifestyle
 * step names an address.
 */
function homeDistrictOf(state: ChargenState): string | null {
  return readLifestyle(state.lifestyle).districtKey;
}

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

function SkillRow({
  entry,
  state,
  readOnly,
  limits,
  onLevel,
  onRemove,
  basicMin,
}: {
  entry: SkillEntry;
  state: ChargenState;
  readOnly?: boolean | undefined;
  limits?: SkillLimits | undefined;
  onLevel?: ((level: number) => void) | undefined;
  onRemove?: (() => void) | undefined;
  /** Set on a Basic Skill that can be raised but never removed: the floor it must keep. */
  basicMin?: number | undefined;
}) {
  const skill = getSkill(entry.skillId);
  const stat = statValue(state, skill.stat);
  const base = stat === null ? null : skillBase(stat, entry.level);
  const cost = skillPointCost(entry.skillId, 0, entry.level);
  const odds = taskOdds(entry, state.stats);
  const home = homeDistrictOf(state);
  const label = skillEntryName(entry, home);
  // A place-scoped line still holding the printed placeholder: say where it
  // gets decided, rather than leaving "Your Home" on the sheet looking unfilled.
  const awaitingHome = isAreaScoped(entry.skillId) && isHomeArea(entry.specialization) && !home;

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-hairline px-4 py-2 last:border-b-0">
      <div className="min-w-52 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium text-text">
            {label}
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
          <SkillInfo skillId={entry.skillId} />
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim">
          {skill.stat.toUpperCase()} · {skill.category}
          {!entry.granted && ` · ${cost} pts`}
        </p>
        {odds && (
          <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-text-muted">
            <span>{odds.task}</span>
            <OddsBar percent={odds.percent} />
          </p>
        )}
        {awaitingHome && (
          <p className="mt-1 text-xs text-text-muted">
            Your own neighbourhood — it becomes the district you pick at Outfit &amp; Lifestyle.
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {!readOnly && onLevel && (
          <Button
            variant="outline"
            size="sm"
            disabled={limits ? !limits.canDecrease : false}
            title={limits?.decreaseReason ?? `Lower ${label}`}
            aria-label={`Lower ${label}`}
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
            title={limits?.increaseReason ?? `Raise ${label}`}
            aria-label={`Raise ${label}`}
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

      {onRemove ? (
        <Button variant="ghost" size="sm" onClick={onRemove}>
          Remove
        </Button>
      ) : (
        basicMin !== undefined && (
          <span
            title={`A Basic Skill: every character keeps it at ${basicMin} or better`}
            className="w-24 whitespace-nowrap text-right font-mono text-[10px] uppercase tracking-[0.15em] text-text-dim"
          >
            Basic · min {basicMin}
          </span>
        )
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
  removable,
  onRemove,
  basicMin,
}: {
  entries: SkillEntry[];
  state: ChargenState;
  readOnly?: boolean | undefined;
  limitsFor?: ((entry: SkillEntry) => SkillLimits) | undefined;
  onLevel?: ((entry: SkillEntry, level: number) => void) | undefined;
  /** Which lines may be removed; a line it rejects shows no Remove button. */
  removable?: ((entry: SkillEntry) => boolean) | undefined;
  onRemove?: ((entry: SkillEntry) => void) | undefined;
  basicMin?: number | undefined;
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
                  onRemove={
                    onRemove && (!removable || removable(entry)) ? () => onRemove(entry) : undefined
                  }
                  basicMin={
                    onRemove && removable && !entry.granted && !removable(entry)
                      ? basicMin
                      : undefined
                  }
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** The one place the points left are said. Zero reads as done rather than as a number. */
function Budget({ remaining }: { remaining: number }) {
  const done = remaining === 0;
  return (
    <div
      className={cn(
        "flex flex-wrap items-baseline justify-between gap-3 border bg-surface p-4",
        done ? "border-success/60" : "border-hairline",
      )}
    >
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-dim">
          Skill Points remaining
        </p>
        <p
          className={cn(
            "num font-mono text-4xl font-bold tabular-nums",
            remaining < 0 ? "text-danger" : done ? "text-success" : "text-text",
          )}
        >
          {remaining}
        </p>
      </div>
      <p className="text-sm text-text-muted">
        {done ? "Every Skill rule is satisfied — you can move on." : "Spend them all to go on."}
      </p>
    </div>
  );
}

/** What the bar beside each Skill on the sheet is. */
function OddsKey() {
  return (
    <p className="text-xs text-text-dim">
      The bar is your chance at the sample task beside each Skill.
    </p>
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
        Streetrat takes the Role's printed Skill package exactly as written — no points to spend and
        nothing to adjust. Your free Cultural Origin Language sits alongside it at Rank 4, granted
        rather than purchased.
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
      <Budget remaining={result.pointsRemaining} />
      <OddsKey />
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
  const [roleOnly, setRoleOnly] = useState(false);
  const [showChosen, setShowChosen] = useState(false);
  const [openStats, setOpenStats] = useState<ReadonlySet<string>>(new Set());
  const [spec, setSpec] = useState<Record<string, string>>({});

  const roleSkillIds = useMemo(
    () => new Set(state.roleId ? getRoleSkillIds(state.roleId) : []),
    [state.roleId],
  );

  /**
   * Districts the character's childhood points at. A highlight in the picker,
   * never a filter — the same house rule the home picker already prints.
   */
  const childhoodDistricts = useMemo(() => {
    const entry = readGeneralLifepath(state.lifepath.general).entries["childhood_environment"];
    const answer = entry ? displayValue(entry) : null;
    return suggestedHome(answer)?.districts ?? [];
  }, [state.lifepath.general]);

  /**
   * The 13 Basic Skills must be present, so seed them at the minimum.
   *
   * Local Expert is seeded too, on the printed "Your Home" placeholder. It is a
   * Basic Skill like the rest, and leaving it out because it takes a
   * specialization meant the rules minimum was unsatisfiable until the player
   * typed a location into a free-text box by hand — so the one Skill everybody
   * has was also the one the wizard made them invent. Language stays out: the
   * Lifepath grants a Cultural Origin one, and `grantedLanguage` supplies it.
   */
  useEffect(() => {
    if (state.skills.length > 0) return;
    patch({
      skills: BASIC_SKILLS.filter(
        (id) => !getSkill(id).requiresSpecialization || isAreaScoped(id),
      ).map((id) => ({
        skillId: id,
        specialization: isAreaScoped(id) ? HOME_AREA : null,
        level: COMPLETE_RULES.basicSkillMinimum,
      })),
    });
  }, [state.skills.length, patch]);

  const result = validateSkillEntries({ method: "complete_package", entries: state.skills });

  const limitsFor = (entry: SkillEntry) =>
    skillEntryLimits({ method: "complete_package", entries: state.skills, entry });

  /** Level a newly added Skill starts at, and what it costs. */
  const ADD_LEVEL = COMPLETE_RULES.basicSkillMinimum;

  /** A Skill with one line only is "chosen" once it is on the sheet. */
  const isChosen = (skill: SkillDefinition) =>
    !skill.requiresSpecialization && state.skills.some((e) => e.skillId === skill.id);
  const chosenCount = SKILLS.filter(isChosen).length;

  /**
   * The specialization the controls are currently offering for this Skill.
   *
   * A place-scoped Skill defaults to the printed placeholder rather than to
   * nothing, so its picker always has a legal value selected and "Add" is never
   * disabled for a Skill the player has not picked from.
   */
  function chosenSpec(skill: SkillDefinition): string | null {
    if (!skill.requiresSpecialization) return null;
    const typed = (spec[skill.id] ?? "").trim();
    if (typed) return typed;
    return isAreaScoped(skill.id) ? HOME_AREA : null;
  }

  function addability(skill: SkillDefinition) {
    return canAddSkillEntry({
      method: "complete_package",
      entries: state.skills,
      skillId: skill.id,
      specialization: chosenSpec(skill),
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
    const entry: SkillEntry = {
      skillId: skill.id,
      specialization: chosenSpec(skill),
      level: ADD_LEVEL,
    };
    patch({ skills: [...state.skills, entry] });
    if (skill.requiresSpecialization) {
      setSpec((s) => ({ ...s, [skill.id]: isAreaScoped(skill.id) ? HOME_AREA : "" }));
    }
  }

  function removeSkill(target: SkillEntry) {
    patch({
      skills: state.skills.filter((e) => skillEntryKey(e) !== skillEntryKey(target)),
    });
  }

  /** Basic Skills and the granted Language are the sheet's floor; everything else may go. */
  const removable = (entry: SkillEntry) => !entry.granted && !BASIC_SKILLS.includes(entry.skillId);

  const needle = query.trim().toLowerCase();
  const searching = needle !== "";
  const groups = STAT_ORDER.map((stat) => {
    const skills = SKILLS.filter((skill) => {
      if (skill.stat !== stat) return false;
      if (searching && !skill.name.toLowerCase().includes(needle)) return false;
      if (roleOnly && !roleSkillIds.has(skill.id)) return false;
      if (!showChosen && isChosen(skill)) return false;
      return true;
    }).sort(
      (a, b) =>
        Number(roleSkillIds.has(b.id)) - Number(roleSkillIds.has(a.id)) ||
        a.name.localeCompare(b.name),
    );
    return { stat, skills };
  }).filter((group) => group.skills.length > 0);

  function toggleStat(stat: string) {
    setOpenStats((current) => {
      const next = new Set(current);
      if (!next.delete(stat)) next.add(stat);
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <Budget remaining={result.pointsRemaining} />

      <section className="space-y-3">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.25em] text-ember">Your sheet</h3>
        <OddsKey />
        <CategoryGroups
          entries={granted ? [...state.skills, granted] : state.skills}
          state={state}
          limitsFor={limitsFor}
          onLevel={(entry, level) => !entry.granted && setLevel(entry, level)}
          removable={removable}
          onRemove={removeSkill}
          basicMin={COMPLETE_RULES.basicSkillMinimum}
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
          <Chip active={showChosen} onClick={() => setShowChosen(!showChosen)}>
            Show chosen ({chosenCount})
          </Chip>
        </div>

        <div className="space-y-2">
          {groups.map(({ stat, skills }) => {
            const open = searching || openStats.has(stat);
            const suggested = skills.filter((skill) => roleSkillIds.has(skill.id)).length;
            return (
              <section key={stat} className="border border-hairline bg-surface">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => toggleStat(stat)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left hover:bg-surface-raised"
                >
                  <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-text">
                    {stat.toUpperCase()}
                    <span className="ml-3 text-text-dim">{skills.length}</span>
                    {suggested > 0 && (
                      <span className="ml-3 text-cool">{suggested} for your Role</span>
                    )}
                  </span>
                  <span aria-hidden className="font-mono text-text-dim">
                    {open ? "−" : "+"}
                  </span>
                </button>
                {open && (
                  <div className="border-t border-hairline">
                    {skills.map((skill) => (
                      <MasterRow
                        key={skill.id}
                        skill={skill}
                        state={state}
                        isRole={roleSkillIds.has(skill.id)}
                        chosen={isChosen(skill)}
                        add={addability(skill)}
                        spec={spec[skill.id] ?? (isAreaScoped(skill.id) ? HOME_AREA : "")}
                        childhoodDistricts={childhoodDistricts}
                        onSpec={(value) => setSpec((s) => ({ ...s, [skill.id]: value }))}
                        onAdd={() => addSkill(skill)}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
          {groups.length === 0 && (
            <p className="border border-hairline bg-surface p-4 text-sm text-text-muted">
              No Skill matches those filters.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function MasterRow({
  skill,
  state,
  isRole,
  chosen,
  add,
  spec,
  childhoodDistricts,
  onSpec,
  onAdd,
}: {
  skill: SkillDefinition;
  state: ChargenState;
  isRole: boolean;
  chosen: boolean;
  add: { allowed: boolean; reason: string | null };
  spec: string;
  childhoodDistricts: string[];
  onSpec: (value: string) => void;
  onAdd: () => void;
}) {
  const options = specializationOptions(skill.id);
  const lines = state.skills.filter((e) => e.skillId === skill.id).length;
  const specLabel = skill.specializationLabel ?? "specialization";
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-hairline px-4 py-2 last:border-b-0">
      <div className="min-w-52 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-text">
            {skill.name}
            {skill.doubleCost && (
              <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-ember">
                ×2
              </span>
            )}
            {isRole && (
              <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-cool">
                Role
              </span>
            )}
          </p>
          <SkillInfo skillId={skill.id} />
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim">
          {skill.category}
          {lines > 0 && skill.requiresSpecialization && ` · ${lines} chosen`}
        </p>
      </div>
      {skill.requiresSpecialization &&
        (isAreaScoped(skill.id) ? (
          <AreaPicker
            value={spec || HOME_AREA}
            onChange={onSpec}
            suggested={childhoodDistricts}
            label={`${skill.name} ${specLabel}`}
          />
        ) : options ? (
          <SpecializationPicker
            skillId={skill.id}
            options={options}
            value={spec}
            onChange={onSpec}
            taken={state.skills}
            label={`${skill.name} ${specLabel}`}
            placeholder={`Pick ${specLabel}`}
          />
        ) : (
          <Input
            className="w-48"
            value={spec}
            onChange={(e) => onSpec(e.target.value)}
            placeholder={specLabel}
            aria-label={`${skill.name} ${specLabel}`}
          />
        ))}
      <Button
        variant="outline"
        size="sm"
        disabled={chosen || !add.allowed}
        title={chosen ? "Already on your sheet" : (add.reason ?? `Add ${skill.name}`)}
        onClick={onAdd}
      >
        {chosen ? "Chosen" : "Add"}
      </Button>
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

/**
 * The Skills step, asked the way somebody who has never opened the book can
 * answer it.
 *
 * It used to open straight onto eighty-six points and twenty rows of plus and
 * minus, and it was the step where a new player stopped caring. Now it asks how
 * you work (three legal presets per Role), shows what that means as tasks with
 * your real odds, and keeps every Level by hand in a drawer for the player who
 * wants it. The drawer is the same editor as before, with the same validators;
 * nothing a preset writes could not have been written by hand.
 */
export function SkillsPanel({ state }: { state: ChargenState }) {
  if (!state.method) {
    return <p className="text-sm text-text-muted">Choose how you build first.</p>;
  }
  if (!state.roleId) {
    return (
      <p className="text-sm text-text-muted">
        Pick a Role first. Your Skills are read from what that Role does.
      </p>
    );
  }
  const granted = grantedLanguage(state);
  const home = homeDistrictOf(state);

  if (state.method === "streetrat") {
    const fixed = rolePackageEntries(state.roleId);
    return (
      <div className="space-y-6">
        <WhatYouCanDo state={state} entries={granted ? [...fixed, granted] : fixed} home={home} />
        <FineTune open={false}>
          <StreetratBranch state={state} />
        </FineTune>
      </div>
    );
  }

  const method = state.method;
  const shown = granted ? [...state.skills, granted] : state.skills;
  const handBuilt =
    state.skills.length > 0 &&
    !matchingPreset({ method, roleId: state.roleId, entries: state.skills });
  return (
    <div className="space-y-6">
      <WaysToWork state={state} method={method} />
      <WhatYouCanDo state={state} entries={shown} home={home} />
      <FineTune open={handBuilt}>
        {method === "edgerunner" ? (
          <EdgerunnerBranch state={state} />
        ) : (
          <CompletePackageBranch state={state} />
        )}
      </FineTune>
    </div>
  );
}
