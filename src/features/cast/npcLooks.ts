/**
 * How the people the game has a picture of read on sight.
 *
 * The portraits are fixed and the dossiers were written without saying who they
 * show, so the narrator was left to guess a pronoun and an age and the player
 * could see it guess wrong. `cast-looks.json` writes down what each picture
 * shows (house rule, nothing in the book), and this turns it into the one line
 * the narrator is given. The engine builds the line (`seenAsLine`): the band,
 * never the number, and an explicit "no he or she" where the picture leaves it
 * open rather than a silence the model fills.
 *
 * Presentation data only, like the rest of this directory.
 */
import LOOKS from "@/data/cast/cast-looks.json";
import { seenAsLine, type Look, type ShopKeeper } from "@/engine";
import { findNpc } from "./npcDirectory";

type Row = { sex: string | null; age: number | null };
const PEOPLE = LOOKS.people as Record<string, Row>;

/** Every id with a recorded look, for the test that holds the directory to it. */
export const LOOK_IDS: string[] = Object.keys(PEOPLE);

/** A stored row as a `Look`, or null when the file has none for this id. */
export function lookOfNpcId(id: string): Look | null {
  const row = PEOPLE[id];
  if (!row) return null;
  return {
    sex: row.sex === "male" || row.sex === "female" ? row.sex : null,
    age: typeof row.age === "number" ? row.age : null,
  };
}

/** The narrator's line for a person by name, or null for somebody with no recorded look. */
export function seenAsFor(name: string): string | null {
  const npc = findNpc(name);
  const look = npc ? lookOfNpcId(npc.id) : null;
  return look ? seenAsLine(look) : null;
}

/** "Mama Ishii (woman, elderly)": a keeper's name, with how they read when the data says. */
export function keeperNamed(keeper: Pick<ShopKeeper, "name" | "sex" | "age" | "appears">): string {
  const line = seenAsLine({
    sex: keeper.sex ?? null,
    age: keeper.age ?? null,
    ...(keeper.appears ? { appears: keeper.appears } : {}),
  });
  return line ? `${keeper.name} (${line})` : keeper.name;
}
