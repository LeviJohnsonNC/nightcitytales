/**
 * The furniture an arena can be built out of.
 *
 * `battlefield.ts` owns the ground and authors each arena's cover by hand;
 * `cover.ts` owns the printed HP rules. This is the middle thing neither had:
 * a library of named objects — a sedan, a bus, a bar counter — that an arena
 * can put down without re-deciding what a car is made of every time.
 *
 * A prop is a LIST of 2m sections rather than one shape, because pg. 182 makes
 * a 2m section the unit that can be attacked. A sedan is an engine block and a
 * passenger door: two sections, two materials, two HP pools, two ids. Anything
 * that flattened them into one object would be inventing a rule where the book
 * has a clear one, and would make the bonnet end of a car no safer than the
 * doors.
 *
 * Placement is a translation and nothing else. `placeProp` stamps a template at
 * a point and hands back ordinary `CoverPiece`s — so an arena keeps its cover
 * authored in its own file, with its own stable ids, and this library never
 * becomes a second source of truth about where anything stands.
 *
 * Pure: data in, plain objects out.
 */
import propData from "@/data/rules/battlefield-props.json";
import { COVER_SECTION_METRES, type CoverPiece, type Point, type Rect } from "./battlefield";

/** One 2m section of a prop, positioned relative to the prop's own origin. */
export type PropSection = {
  /** Unique within the prop; becomes the suffix of the placed piece's id. */
  key: string;
  label: string;
  /** A material key from data/rules/cover.json. */
  material: string;
  thickness: "thick" | "thin";
  /** Metres east and south of the prop's origin. Always a multiple of 2. */
  dx: number;
  dy: number;
  /** False for something you can step over. Absent means it blocks, as cover does. */
  blocksMovement?: boolean;
};

export type BattlefieldProp = {
  key: string;
  label: string;
  category: "vehicle" | "street" | "industrial" | "interior";
  /** The sprite this will draw as, once one is drawn. Nothing reads it yet. */
  art: string;
  /** Which printed row of the HP table this is being read against, and why. */
  why: string;
  sections: PropSection[];
};

export const BATTLEFIELD_PROPS: BattlefieldProp[] = (
  propData.props as unknown as BattlefieldProp[]
).map((prop) => ({ ...prop, sections: prop.sections.map((section) => ({ ...section })) }));

export const PROP_KEYS: string[] = BATTLEFIELD_PROPS.map((prop) => prop.key);

/** The named prop, or undefined. Authoring is in-repo, so a typo is a test failure. */
export function battlefieldProp(key: string): BattlefieldProp | undefined {
  return BATTLEFIELD_PROPS.find((prop) => prop.key === key);
}

/** Every prop of one kind, for an arena being furnished to a theme. */
export function propsInCategory(category: BattlefieldProp["category"]): BattlefieldProp[] {
  return BATTLEFIELD_PROPS.filter((prop) => prop.category === category);
}

/** How much ground it takes up, in metres, before it is placed anywhere. */
export function propFootprint(prop: BattlefieldProp): { width: number; height: number } {
  const width = Math.max(...prop.sections.map((s) => s.dx)) + COVER_SECTION_METRES;
  const height = Math.max(...prop.sections.map((s) => s.dy)) + COVER_SECTION_METRES;
  return { width, height };
}

/**
 * Put one down.
 *
 * `at` is the prop's north-west corner in arena metres, and `id` is the stable
 * name the arena gives THIS copy — two sedans in one car park are `sedan_north`
 * and `sedan_south`, and each section becomes `<id>_<section key>`. Those ids
 * are what persisted damage is keyed by, so an arena must not rename one after
 * a fight has stood on it.
 *
 * Rotation is deliberately absent. A prop that needs to lie the other way is
 * authored the other way, because a rotated footprint is a second geometry to
 * keep in step with the art and the ids for no rule the book cares about.
 */
export function placeProp(prop: BattlefieldProp, at: Point, id: string): CoverPiece[] {
  return prop.sections.map((section) => {
    const rect: Rect = {
      x: at.x + section.dx,
      y: at.y + section.dy,
      width: COVER_SECTION_METRES,
      height: COVER_SECTION_METRES,
    };
    return {
      id: `${id}_${section.key}`,
      label: section.label,
      material: section.material,
      thickness: section.thickness,
      rect,
      ...(section.blocksMovement === false ? { blocksMovement: false } : {}),
    };
  });
}
