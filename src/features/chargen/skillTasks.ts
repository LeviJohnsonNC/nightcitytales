/**
 * What a Skill lets you DO, in one line, at a difficulty from the printed ladder.
 *
 * "Handgun 6" means nothing to somebody who has never opened the book. "Put two
 * rounds in a moving target across the street: 60%" means everything. The
 * Skills step shows each line with the character's odds, computed by the engine
 * (`checkPercent`) from their real STAT and Level against the named DV.
 *
 * The task is presentation copy in the house voice. The DV is a NAME on the
 * printed ladder (dv-table.json), never a number typed here, and each is the
 * difficulty the rulebook's own descriptions put that kind of task at: work
 * that "takes actual training" is Professional, what an untrained person could
 * manage with luck is Everyday. A test holds every Skill to a line.
 */
import { checkPercent, getDV, getSkill, skillBase, type SkillEntry, type StatKey } from "@/engine";
import type { ChargenState } from "./store";

export type SkillTask = {
  task: string;
  dv: "Everyday" | "Difficult" | "Professional" | "Heroic";
};

export const SKILL_TASKS: Record<string, SkillTask> = {
  concentration: { task: "Remember a keypad code you saw once, under fire", dv: "Difficult" },
  conceal_reveal_object: { task: "Walk a pistol past a pat-down", dv: "Professional" },
  lip_reading: { task: "Read a deal off two mouths across a club", dv: "Professional" },
  perception: { task: "Spot the shooter before they spot you", dv: "Difficult" },
  tracking: { task: "Follow a runner's trail through the Combat Zone", dv: "Professional" },
  athletics: { task: "Clear the gap between two rooftops", dv: "Difficult" },
  contortionist: { task: "Slip a pair of zip-tie cuffs", dv: "Professional" },
  dance: { task: "Own the floor at a club that matters", dv: "Professional" },
  endurance: { task: "Keep walking the Badlands with no water", dv: "Difficult" },
  resist_torture_drugs: { task: "Keep your mouth shut under interrogation", dv: "Professional" },
  stealth: { task: "Cross a lit lobby without the guard looking up", dv: "Professional" },
  drive_land_vehicle: { task: "Lose a tail through downtown traffic", dv: "Professional" },
  pilot_air_vehicle: { task: "Put an AV down on a rooftop in a crosswind", dv: "Professional" },
  pilot_sea_vehicle: { task: "Run a boat through the harbour at night, dark", dv: "Professional" },
  riding: { task: "Stay in the saddle when the shooting starts", dv: "Difficult" },
  accounting: { task: "Find the money somebody hid in the books", dv: "Professional" },
  animal_handling: { task: "Calm a guard dog that has your scent", dv: "Difficult" },
  bureaucracy: { task: "Get a permit through a city office by Friday", dv: "Professional" },
  business: { task: "Read what a deal is really worth", dv: "Difficult" },
  composition: { task: "Write the song or story people repeat", dv: "Professional" },
  criminology: { task: "Pull a suspect's record together from scraps", dv: "Professional" },
  cryptography: { task: "Crack a coded message before morning", dv: "Professional" },
  deduction: { task: "Work out who lied from three stories", dv: "Professional" },
  education: { task: "Know the answer everybody else has to look up", dv: "Difficult" },
  gamble: { task: "Walk out of a card game richer", dv: "Difficult" },
  language: { task: "Hold a real conversation in it", dv: "Everyday" },
  library_search: { task: "Dig the one useful file out of the Data Pool", dv: "Difficult" },
  local_expert: { task: "Know which back street gets you out of here", dv: "Difficult" },
  science: { task: "Identify what is in the vial", dv: "Professional" },
  tactics: { task: "Read a firefight and call the flank", dv: "Professional" },
  wilderness_survival: { task: "Find water and shelter in the Badlands", dv: "Difficult" },
  brawling: { task: "Put a bouncer on the floor", dv: "Difficult" },
  evasion: { task: "Get out of the way of a swinging blade", dv: "Difficult" },
  martial_arts: { task: "Take a trained fighter apart", dv: "Professional" },
  melee_weapon: { task: "Land a clean cut on somebody who knows how to fight", dv: "Professional" },
  acting: { task: "Pass as somebody you are not, to their face", dv: "Professional" },
  play_instrument: { task: "Play a set the crowd still talks about", dv: "Professional" },
  archery: { task: "Put an arrow through a gap in the armour", dv: "Professional" },
  autofire: { task: "Walk a burst onto a target behind cover", dv: "Professional" },
  handgun: { task: "Put two rounds in a moving target across the street", dv: "Professional" },
  heavy_weapons: { task: "Hit a moving car with a rocket", dv: "Professional" },
  shoulder_arms: { task: "Drop a target at the far end of the block", dv: "Professional" },
  bribery: { task: "Get a cop to look the other way", dv: "Difficult" },
  conversation: { task: "Get a stranger talking about their boss", dv: "Difficult" },
  human_perception: { task: "Tell when the fixer is lying to you", dv: "Professional" },
  interrogation: { task: "Get the truth out of a hostile prisoner", dv: "Professional" },
  persuasion: { task: "Talk your way past the velvet rope", dv: "Difficult" },
  personal_grooming: { task: "Look like you belong in the penthouse", dv: "Difficult" },
  streetwise: { task: "Find somebody who sells what nobody sells", dv: "Difficult" },
  trading: { task: "Get a good price from a hard seller", dv: "Difficult" },
  wardrobe_style: { task: "Turn every head when you walk in", dv: "Difficult" },
  air_vehicle_tech: { task: "Get a downed AV flying again", dv: "Professional" },
  basic_tech: { task: "Fix whatever just broke with what is in your bag", dv: "Difficult" },
  cybertech: { task: "Get a glitching cyberarm working again", dv: "Professional" },
  demolitions: { task: "Blow the door and nothing else", dv: "Professional" },
  electronics_security_tech: {
    task: "Beat a maglock before the patrol comes back",
    dv: "Professional",
  },
  first_aid: { task: "Stop a friend bleeding out on the floor", dv: "Difficult" },
  forgery: { task: "Make an ID that passes a scanner", dv: "Professional" },
  land_vehicle_tech: { task: "Get a shot-up car running again", dv: "Difficult" },
  paint_draw_sculpt: { task: "Make a piece that people stop and stare at", dv: "Professional" },
  paramedic: { task: "Pull somebody back from a mortal wound", dv: "Professional" },
  photography_film: { task: "Get the shot that sells the story", dv: "Professional" },
  pick_lock: { task: "Open a good lock in under a minute", dv: "Professional" },
  pick_pocket: { task: "Lift a keycard off a guard in a crowd", dv: "Professional" },
  sea_vehicle_tech: { task: "Patch a hull before it sinks", dv: "Difficult" },
  weaponstech: { task: "Clear a jam and tune a pistol", dv: "Difficult" },
};

/** A Skill line's odds at its task, or null before the STAT is known. */
export function taskOdds(
  entry: SkillEntry,
  stats: ChargenState["stats"],
): { task: string; dvName: string; percent: number } | null {
  const task = SKILL_TASKS[entry.skillId];
  if (!task) return null;
  const stat = stats[getSkill(entry.skillId).stat as StatKey];
  if (typeof stat !== "number") return null;
  return {
    task: task.task,
    dvName: task.dv,
    percent: checkPercent(skillBase(stat, entry.level), getDV(task.dv)),
  };
}
