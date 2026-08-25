/**
 * Your Role, at the table.
 *
 * A Solo divides their Combat Awareness pool here — the one decision that makes
 * a Solo play like a Solo rather than like a character sheet with a gun. Every
 * other Role gets its ability named with what it is currently doing for them,
 * so the panel never pretends a Role has nothing.
 *
 * The numbers and the option list come from the rules data through the engine;
 * this file lays them out and posts the division back.
 */
import { useEffect, useState } from "react";
import {
  BELIEVABILITY_FORBIDS_LUCK,
  CHARISMATIC_AUDIENCES,
  COMBAT_AWARENESS_OPTIONS,
  LOYALTY_GAINS,
  LOYALTY_LOSSES,
  MAKER_SPECIALTIES,
  MEDICINE_SPECIALTIES,
  RUMOR_TIERS,
  SYNTHESIS_DV,
  SYNTHESIS_MATERIALS_COST,
  TEAM_MEMBER_CLASSES,
  believabilityCheck,
  charismaticFavor,
  combatAwarenessEffects,
  combatAwarenessValue,
  credibilityFor,
  evidenceBonus,
  execPerks,
  loyaltyAfter,
  loyaltySave,
  medicineSkillLevels,
  medicineSpecialtyCap,
  rollTeamMember,
  synthesisDoses,
  unlockedDrugs,
  type BackupCall,
  type BelievabilityResult,
  type CharismaticImpactResult,
  type CombatAwarenessOption,
} from "@/engine";
import { Button } from "@/components/ui/button";
import { describeOutlook } from "./outlook";
import { DiceRoll } from "@/features/chargen/DiceRoll";
import type { usePlay } from "./usePlay";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
      {children}
    </p>
  );
}

/** The cost of the next step up in a stepped option, or one point for a scaling one. */
function nextCost(option: CombatAwarenessOption, points: number): number | null {
  if (option.perPoint) return points + 1;
  const steps = option.steps ?? [];
  const next = steps.find((step) => step.cost > points);
  return next ? next.cost : null;
}

/** The cost of dropping back a step, or null when it is already empty. */
function prevCost(option: CombatAwarenessOption, points: number): number | null {
  if (points <= 0) return null;
  if (option.perPoint) return points - 1;
  const steps = option.steps ?? [];
  const below = [...steps].reverse().find((step) => step.cost < points);
  return below ? below.cost : 0;
}

function OptionRow({
  option,
  points,
  remaining,
  disabled,
  onChange,
}: {
  option: CombatAwarenessOption;
  points: number;
  remaining: number;
  disabled: boolean;
  onChange: (points: number) => void;
}) {
  const value = combatAwarenessValue(option.id, points);
  const up = nextCost(option, points);
  const down = prevCost(option, points);
  const canRaise = up !== null && up - points <= remaining;

  return (
    <li className="space-y-1 border-b border-border/40 pb-2 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{option.name}</span>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-6 w-6 p-0"
            disabled={disabled || down === null}
            aria-label={`Take points off ${option.name}`}
            onClick={() => down !== null && onChange(down)}
          >
            −
          </Button>
          <span className="num w-10 text-center text-xs">{points}p</span>
          <Button
            size="sm"
            variant="outline"
            className="h-6 w-6 p-0"
            disabled={disabled || !canRaise}
            aria-label={`Put points into ${option.name}`}
            onClick={() => up !== null && onChange(up)}
          >
            +
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {option.effect}
        {value > 0 && (
          <span className="ml-1 font-semibold text-accent">
            Active: {option.id === "fumble_recovery" ? "yes" : `+${value}`}
          </span>
        )}
      </p>
    </li>
  );
}

function CombatAwarenessSection({ play }: { play: ReturnType<typeof usePlay> }) {
  const rank = play.roleAbility?.rank ?? 0;
  const saved = play.combatAwarenessAllocation;
  const [draft, setDraft] = useState<Record<string, number>>(saved);

  // The saved division is the truth; adopt it whenever it changes underneath.
  useEffect(() => setDraft(saved), [saved]);

  const effects = combatAwarenessEffects(draft, rank);
  const remaining = effects.pool - effects.spent;
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  return (
    <section className="space-y-2 border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <Label>Combat Awareness</Label>
        <p className="num text-xs text-muted-foreground">
          {remaining} of {effects.pool} points free
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Divide the pool before the shooting starts. The division holds until you change it.
      </p>

      <ul className="space-y-2">
        {COMBAT_AWARENESS_OPTIONS.map((option) => (
          <OptionRow
            key={option.id}
            option={option}
            points={draft[option.id] ?? 0}
            remaining={remaining}
            disabled={play.combatAwarenessBusy || play.busy}
            onChange={(points) => setDraft({ ...draft, [option.id]: points })}
          />
        ))}
      </ul>

      {dirty && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            disabled={play.combatAwarenessBusy}
            onClick={() => play.setCombatAwareness(draft)}
          >
            {play.combatAwarenessBusy ? "…" : "Set the division"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDraft(saved)}>
            Revert
          </Button>
        </div>
      )}
    </section>
  );
}

/**
 * A Rockerboy working a room. The audience sets the DV, the Rank is the whole
 * of the roll, and the die is thrown by hand like every other roll in the app.
 */
function CharismaticImpactSection({ play }: { play: ReturnType<typeof usePlay> }) {
  const rank = play.roleAbility?.rank ?? 0;
  const [audienceId, setAudienceId] = useState<string>(CHARISMATIC_AUDIENCES[0]?.id ?? "single");
  const [result, setResult] = useState<CharismaticImpactResult | null>(null);

  const audience = CHARISMATIC_AUDIENCES.find((a) => a.id === audienceId);
  const favor = charismaticFavor(rank, audienceId);
  const busy = play.charismaBusy || play.busy;

  return (
    <section className="space-y-2 border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <Label>Charismatic Impact</Label>
        <p className="num text-xs text-muted-foreground">Rank {rank}</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Win a room over. Rank + 1d10 against the DV their numbers set.
      </p>

      <div className="flex flex-wrap gap-1">
        {CHARISMATIC_AUDIENCES.map((a) => (
          <Button
            key={a.id}
            size="sm"
            variant={a.id === audienceId ? "default" : "outline"}
            disabled={busy || result !== null}
            onClick={() => setAudienceId(a.id)}
          >
            {a.name} · DV{a.dv}
          </Button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        {favor ? `At Rank ${rank} they will: ${favor}.` : "No following of that size yet."}
      </p>

      {result === null ? (
        <div className="flex items-center gap-3">
          <DiceRoll
            sides={10}
            value={null}
            size={44}
            disabled={busy}
            label={`Roll Charismatic Impact against ${audience?.name ?? "them"}`}
            roll={() => {
              const rolled = play.rollCharismaticImpact(audienceId);
              return {
                face: rolled.rolls[0] ?? 1,
                commit: () => {
                  setResult(rolled);
                  play.commitCharismaticImpact(rolled);
                },
              };
            }}
          />
          <p className="text-xs text-muted-foreground">
            {describeOutlook(rank, audience?.dv ?? 0)}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          <p
            className={
              result.success
                ? "text-sm font-bold text-accent"
                : "text-sm font-bold text-destructive"
            }
          >
            {result.success ? "They are yours" : "The room does not buy it"}
          </p>
          <p className="font-mono text-xs text-muted-foreground">{result.formula}</p>
          {!result.success && (
            <p className="text-xs text-muted-foreground">Not this crowd, not for a week.</p>
          )}
        </div>
      )}
    </section>
  );
}

/** A Lawman calling it in: roll to be answered, then wait for the Round. */
function BackupSection({ play }: { play: ReturnType<typeof usePlay> }) {
  const rank = play.roleAbility?.rank ?? 0;
  const tier = play.backupTier;
  const inbound = play.pendingBackup;
  const [call, setCall] = useState<BackupCall | null>(null);
  const inFight = play.encounter?.state.status === "active";
  const busy = play.backupBusy || play.busy;

  return (
    <section className="space-y-2 border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <Label>Backup</Label>
        <p className="num text-xs text-muted-foreground">Rank {rank}</p>
      </div>
      <p className="text-xs text-muted-foreground">
        {tier
          ? `${tier.count} × ${tier.name} — Combat ${tier.combat}, SP ${tier.sp}, HP ${tier.hp}.`
          : "No agency will take your call at this Rank."}
      </p>

      {inbound ? (
        <p className="text-sm font-semibold text-accent">
          {inbound.tierName} inbound — arriving Round {inbound.arrivesOnRound}.
        </p>
      ) : call === null ? (
        <div className="flex items-center gap-3">
          <DiceRoll
            sides={10}
            value={null}
            size={44}
            disabled={busy || !tier}
            label="Roll to reach Backup"
            roll={() => {
              const rolled = play.rollBackup();
              return {
                face: rolled.responseRoll,
                commit: () => {
                  setCall(rolled);
                  play.commitBackupCall(rolled);
                },
              };
            }}
          />
          <p className="text-xs text-muted-foreground">
            Roll {rank} or under to be answered.
            {!inFight && " You are not in a fight — they will have nothing to shoot."}
          </p>
        </div>
      ) : (
        <p className={call.responded ? "text-sm text-accent" : "text-sm text-destructive"}>
          {call.responded
            ? `${call.tier?.name} answered — ${call.roundsUntilArrival} Round(s) out${call.tierUp ? ", and they sent better" : ""}.`
            : `Rolled ${call.responseRoll}. Nobody answers — try again next Turn.`}
        </p>
      )}
    </section>
  );
}

/** A Tech dividing their Maker Specialty ranks. */
function MakerSection({ play }: { play: ReturnType<typeof usePlay> }) {
  const saved = play.makerSpecialties;
  const budget = play.makerBudget;
  const [draft, setDraft] = useState<Record<string, number>>(saved);
  useEffect(() => setDraft(saved), [saved]);

  const spent = Object.values(draft).reduce((sum, value) => sum + value, 0);
  const pool = budget?.pool ?? 0;
  const remaining = pool - spent;
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  return (
    <section className="space-y-2 border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <Label>Maker</Label>
        <p className="num text-xs text-muted-foreground">
          {remaining} of {pool} Specialty ranks free
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Two Specialty ranks for every Rank of Maker. Field Expertise rides on your Tech Skill
        Checks; the other three need materials and quality rules this app does not model yet.
      </p>

      <ul className="space-y-1">
        {MAKER_SPECIALTIES.map((specialty) => {
          const points = draft[specialty.id] ?? 0;
          return (
            <li key={specialty.id} className="flex items-center justify-between gap-2">
              <span className="text-sm">
                {specialty.name}
                {specialty.id !== "field_expertise" && (
                  <span className="ml-1 text-xs text-muted-foreground">(not modelled)</span>
                )}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 w-6 p-0"
                  disabled={play.makerBusy || points <= 0}
                  aria-label={`Fewer ranks in ${specialty.name}`}
                  onClick={() => setDraft({ ...draft, [specialty.id]: points - 1 })}
                >
                  −
                </Button>
                <span className="num w-6 text-center text-xs">{points}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 w-6 p-0"
                  disabled={play.makerBusy || remaining <= 0}
                  aria-label={`More ranks in ${specialty.name}`}
                  onClick={() => setDraft({ ...draft, [specialty.id]: points + 1 })}
                >
                  +
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {dirty && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={play.makerBusy}
            onClick={() => play.setMakerSpecialties(draft)}
          >
            {play.makerBusy ? "…" : "Set specialties"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDraft(saved)}>
            Revert
          </Button>
        </div>
      )}
    </section>
  );
}

/** A Media putting a story out, and what it takes to be believed. */
function CredibilitySection({ play }: { play: ReturnType<typeof usePlay> }) {
  const rank = play.roleAbility?.rank ?? 0;
  const band = credibilityFor(rank);
  const [evidence, setEvidence] = useState(0);
  const [result, setResult] = useState<BelievabilityResult | null>(null);
  const chance = Math.min(10, (band?.believeIn10 ?? 0) + evidenceBonus(evidence));

  return (
    <section className="space-y-2 border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <Label>Credibility</Label>
        <p className="num text-xs text-muted-foreground">Rank {rank}</p>
      </div>
      <p className="text-xs text-muted-foreground">
        {band ? `Reach: ${band.audience}. Impact: ${band.impact}.` : "No reach at this Rank."}
      </p>
      <p className="text-xs text-muted-foreground">
        Hunting a rumor actively: {RUMOR_TIERS.map((t) => `${t.name} DV${t.activeDv}`).join(" · ")}
      </p>

      <div className="flex items-center gap-2">
        <Label>Hard evidence</Label>
        <Button
          size="sm"
          variant="outline"
          className="h-6 w-6 p-0"
          disabled={evidence <= 0 || result !== null}
          aria-label="One piece fewer"
          onClick={() => setEvidence(Math.max(0, evidence - 1))}
        >
          −
        </Button>
        <span className="num w-6 text-center text-xs">{evidence}</span>
        <Button
          size="sm"
          variant="outline"
          className="h-6 w-6 p-0"
          disabled={result !== null}
          aria-label="One piece more"
          onClick={() => setEvidence(evidence + 1)}
        >
          +
        </Button>
        <span className="num text-xs text-muted-foreground">{chance}-in-10 believed</span>
      </div>

      {result === null ? (
        <div className="flex items-center gap-3">
          <DiceRoll
            sides={10}
            value={null}
            size={44}
            disabled={play.busy || !band}
            label="Roll Believability"
            roll={() => {
              const rolled = believabilityCheck(rank, evidence);
              return { face: rolled.roll, commit: () => setResult(rolled) };
            }}
          />
          <p className="text-xs text-muted-foreground">
            {chance} or under and they buy it.
            {BELIEVABILITY_FORBIDS_LUCK && " Luck cannot touch this roll."}
          </p>
        </div>
      ) : (
        <p className={result.believed ? "text-sm text-accent" : "text-sm text-destructive"}>
          {result.believed
            ? `Rolled ${result.roll} — ${result.audience} believes it. ${result.impact}.`
            : `Rolled ${result.roll} — the story does not land.`}
        </p>
      )}
    </section>
  );
}

/** A Medtech's Specialties, the Skills they buy, and the drugs they unlock. */
function MedicineSection({ play }: { play: ReturnType<typeof usePlay> }) {
  const rank = play.roleAbility?.rank ?? 0;
  const saved = play.medicineSpecialties;
  const [draft, setDraft] = useState<Record<string, number>>(saved);
  useEffect(() => setDraft(saved), [saved]);

  const spent = Object.values(draft).reduce((sum, value) => sum + value, 0);
  const remaining = rank - spent;
  const skills = medicineSkillLevels(draft);
  const drugs = unlockedDrugs(draft["pharmaceuticals"] ?? 0);
  const doses = synthesisDoses(skills["medical_tech"] ?? 0);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  return (
    <section className="space-y-2 border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <Label>Medicine</Label>
        <p className="num text-xs text-muted-foreground">
          {remaining} of {rank} points free
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        One point per Rank of Medicine. Surgery buys two Skill points each; both Medical Tech
        Specialties feed the same Skill.
      </p>

      <ul className="space-y-1">
        {MEDICINE_SPECIALTIES.map((specialty) => {
          const points = draft[specialty.id] ?? 0;
          const cap = medicineSpecialtyCap(specialty.id);
          const capped = cap !== null && points >= cap;
          return (
            <li key={specialty.id} className="flex items-center justify-between gap-2">
              <span className="text-sm">
                {specialty.name}
                {capped && <span className="ml-1 text-xs text-muted-foreground">(at cap)</span>}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 w-6 p-0"
                  disabled={play.abilityStateBusy || points <= 0}
                  aria-label={`Fewer points in ${specialty.name}`}
                  onClick={() => setDraft({ ...draft, [specialty.id]: points - 1 })}
                >
                  −
                </Button>
                <span className="num w-6 text-center text-xs">{points}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 w-6 p-0"
                  disabled={play.abilityStateBusy || remaining <= 0 || capped}
                  aria-label={`More points in ${specialty.name}`}
                  onClick={() => setDraft({ ...draft, [specialty.id]: points + 1 })}
                >
                  +
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="num text-xs text-muted-foreground">
        Surgery {skills["surgery"] ?? 0} · Medical Tech {skills["medical_tech"] ?? 0}
      </p>

      {drugs.length > 0 ? (
        <div className="space-y-1">
          <Label>Can synthesize</Label>
          <ul className="space-y-1">
            {drugs.map((drug) => (
              <li key={drug.id} className="text-xs">
                <span className="font-semibold">{drug.name}</span>{" "}
                <span className="text-muted-foreground">{drug.effect}</span>
                {(play.medicineDoses[drug.id] ?? 0) > 0 && (
                  <span className="num ml-1 text-accent">
                    ×{play.medicineDoses[drug.id]} on hand
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            A batch is {SYNTHESIS_MATERIALS_COST}eb of materials and a DV{SYNTHESIS_DV} Medical Tech
            Check, for {doses} dose{doses === 1 ? "" : "s"}.
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Put points into Pharmaceuticals to unlock drugs you can synthesize.
        </p>
      )}

      {dirty && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={play.abilityStateBusy}
            onClick={() => play.setMedicineSpecialties(draft)}
          >
            {play.abilityStateBusy ? "…" : "Set specialties"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDraft(saved)}>
            Revert
          </Button>
        </div>
      )}
    </section>
  );
}

/** An Exec's team, and how loyal they are to you today. */
function TeamworkSection({ play }: { play: ReturnType<typeof usePlay> }) {
  const rank = play.roleAbility?.rank ?? 0;
  const team = play.execTeam;
  const [name, setName] = useState("");
  const [memberClass, setMemberClass] = useState(TEAM_MEMBER_CLASSES[0] ?? "Bodyguard");
  const [save, setSave] = useState<{ id: string; text: string } | null>(null);
  if (!team) return null;

  const full = team.members.length >= team.slots;

  const hire = () => {
    const rolled = rollTeamMember();
    play.setExecTeam([
      ...team.members,
      {
        id: crypto.randomUUID(),
        name: name.trim() || memberClass,
        memberClass,
        statRoll: rolled.statRoll,
        loyalty: rolled.loyalty,
      },
    ]);
    setName("");
  };

  const shift = (id: string, delta: number) =>
    play.setExecTeam(
      team.members.map((m) =>
        m.id === id ? { ...m, loyalty: loyaltyAfter(m.loyalty, delta) } : m,
      ),
    );

  return (
    <section className="space-y-2 border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <Label>Teamwork</Label>
        <p className="num text-xs text-muted-foreground">Rank {rank}</p>
      </div>
      <ul className="space-y-1 text-xs text-muted-foreground">
        {execPerks(rank).map((perk) => (
          <li key={perk}>{perk}</li>
        ))}
      </ul>

      {team.slots === 0 ? (
        <p className="text-xs text-muted-foreground">No Team Members until Rank 3.</p>
      ) : (
        <>
          <p className="num text-xs text-muted-foreground">
            {team.members.length} of {team.slots} Team Members
          </p>

          <ul className="space-y-2">
            {team.members.map((member) => (
              <li
                key={member.id}
                className="space-y-1 border-b border-border/40 pb-2 last:border-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">
                    {member.name}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      {member.memberClass}
                    </span>
                  </span>
                  <span
                    className={
                      member.loyalty <= 0
                        ? "num text-xs font-bold text-destructive"
                        : "num text-xs font-bold"
                    }
                  >
                    Loyalty {member.loyalty}
                  </span>
                </div>

                {member.loyalty <= 0 && (
                  <p className="text-xs text-destructive">
                    Working against you. Below zero at the end of the session and they walk.
                  </p>
                )}

                <div className="flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={play.abilityStateBusy}
                    onClick={() => {
                      const result = loyaltySave(member.loyalty);
                      setSave({
                        id: member.id,
                        text: result.betrays
                          ? `Rolled ${result.roll}. They are past caring — they work against you.`
                          : result.passed
                            ? `Rolled ${result.roll} under ${result.loyalty}. They do it.`
                            : `Rolled ${result.roll} against ${result.loyalty}. They may refuse, botch it, or turn on you.`,
                      });
                    }}
                  >
                    Ask them to do it
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={play.abilityStateBusy}
                    onClick={() => play.setExecTeam(team.members.filter((m) => m.id !== member.id))}
                  >
                    Let them go
                  </Button>
                </div>

                {save?.id === member.id && <p className="text-xs text-accent">{save.text}</p>}

                <div className="flex flex-wrap gap-1">
                  {[...LOYALTY_GAINS, ...LOYALTY_LOSSES].map((change) => (
                    <Button
                      key={change.id}
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[10px]"
                      disabled={play.abilityStateBusy}
                      title={change.label}
                      onClick={() => shift(member.id, change.delta)}
                    >
                      {change.delta > 0 ? `+${change.delta}` : change.delta} {change.label}
                    </Button>
                  ))}
                </div>
              </li>
            ))}
          </ul>

          {!full && (
            <div className="flex flex-wrap items-center gap-1">
              <input
                className="h-7 flex-1 border border-border bg-background px-2 text-sm"
                placeholder="Name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <select
                className="h-7 border border-border bg-background px-1 text-xs"
                value={memberClass}
                onChange={(e) => setMemberClass(e.target.value)}
              >
                {TEAM_MEMBER_CLASSES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <Button size="sm" disabled={play.abilityStateBusy} onClick={hire}>
                Bring them on
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** Every other Role: name the ability and what it is doing for them right now. */
function AbilitySection({ play }: { play: ReturnType<typeof usePlay> }) {
  const ability = play.roleAbility;
  if (!ability) return null;

  const lines: string[] = [];
  if (ability.info.abilityId === "moto") {
    lines.push(
      `+${ability.rank} on driving, piloting and vehicle Tech Checks. The Family Motorpool needs a vehicle system this app does not have yet.`,
    );
  }
  if (ability.info.abilityId === "operator") {
    lines.push(`+${ability.rank} on a Trading deal — your Operator Rank is part of the Haggle.`);
  }

  return (
    <section className="space-y-2 border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <Label>{ability.info.abilityName}</Label>
        <p className="num text-xs text-muted-foreground">Rank {ability.rank}</p>
      </div>
      {lines.length > 0 ? (
        lines.map((line) => (
          <p key={line} className="text-xs text-muted-foreground">
            {line}
          </p>
        ))
      ) : (
        <p className="text-xs text-muted-foreground">
          Your Role Ability is not modelled at the table yet — the GM plays it in the fiction.
        </p>
      )}
    </section>
  );
}

export function RoleAbilityPanel({ play }: { play: ReturnType<typeof usePlay> }) {
  const ability = play.roleAbility;
  if (!ability) return null;
  if (ability.info.abilityId === "combat_awareness") {
    return <CombatAwarenessSection play={play} />;
  }
  if (ability.info.abilityId === "charismatic_impact") {
    return <CharismaticImpactSection play={play} />;
  }
  if (ability.info.abilityId === "backup") {
    return <BackupSection play={play} />;
  }
  if (ability.info.abilityId === "maker") {
    return <MakerSection play={play} />;
  }
  if (ability.info.abilityId === "credibility") {
    return <CredibilitySection play={play} />;
  }
  if (ability.info.abilityId === "medicine") {
    return <MedicineSection play={play} />;
  }
  if (ability.info.abilityId === "teamwork") {
    return <TeamworkSection play={play} />;
  }
  return <AbilitySection play={play} />;
}
