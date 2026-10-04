/** Coordinate-free, independently seeded choices over compatible authored recipes. */
export type CompositionSelection = {
  version: 1;
  family: 0 | 1 | 2;
  program:
    | "shop-west"
    | "shop-east"
    | "opposed-pods"
    | "parallel-pods"
    | "west-delivery"
    | "east-delivery"
    | "near-driveways"
    | "offset-arrivals"
    | "cross-racks"
    | "lengthwise-racks"
    | "paired-bays"
    | "staggered-bays"
    | "bench-lounge"
    | "conversation-lounge";
  activity:
    | "delivery"
    | "maintenance"
    | "office"
    | "alley"
    | "residential"
    | "warehouse"
    | "garage"
    | "nightclub";
  /** Failed fit attempts, in deterministic order. Empty means the first choice fit. */
  rejected: string[];
};

/** Named streams isolate decisions: adding a furniture choice cannot change topology. */
export function compositionChoice(seed: number, stream: string, count: number): number {
  if (
    !Number.isInteger(seed) ||
    seed < 0 ||
    seed > 0xffffffff ||
    !Number.isInteger(count) ||
    count < 1
  )
    throw new Error("Invalid composition choice.");
  let n = (seed ^ 0x811c9dc5) >>> 0;
  for (const c of stream) n = Math.imul(n ^ c.charCodeAt(0), 0x01000193) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x85ebca6b);
  n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
  return ((n ^ (n >>> 16)) >>> 0) % count;
}

export type CompositionRequirements = { serviceActivity?: "delivery" | "maintenance" };

export const COMPOSITION_PROGRAMS = {
  intersection: ["shop-west", "shop-east"],
  office: ["opposed-pods", "parallel-pods"],
  alley: ["west-delivery", "east-delivery"],
  residential: ["near-driveways", "offset-arrivals"],
  warehouse: ["cross-racks", "lengthwise-racks"],
  garage: ["paired-bays", "staggered-bays"],
  nightclub: ["bench-lounge", "conversation-lounge"],
} as const;
export type CompositionKind = keyof typeof COMPOSITION_PROGRAMS;

export function compositionSelection(
  kind: CompositionKind,
  seed: number,
  requirements: CompositionRequirements = {},
): CompositionSelection {
  // The accepted review seeds remain explicit reference combinations.
  const reference = seed >= 1 && seed <= 3;
  return {
    version: 1,
    family: (reference ? seed - 1 : compositionChoice(seed, `${kind}/topology`, 3)) as 0 | 1 | 2,
    program:
      kind === "intersection"
        ? !reference && compositionChoice(seed, "intersection/frontages", 2)
          ? "shop-east"
          : "shop-west"
        : kind === "office"
          ? !reference && compositionChoice(seed, "office/pods", 2)
            ? "parallel-pods"
            : "opposed-pods"
          : COMPOSITION_PROGRAMS[kind][
              reference
                ? kind === "nightclub" && seed === 3
                  ? 1
                  : 0
                : compositionChoice(seed, `${kind}/program`, 2)
            ]!,
    activity:
      kind !== "intersection"
        ? kind
        : (requirements.serviceActivity ??
          ((reference ? seed % 2 === 0 : compositionChoice(seed, "intersection/service", 2) === 1)
            ? "maintenance"
            : "delivery")),
    rejected: [],
  };
}

/** Read saved choices as provenance only. Never use them to regenerate saved geometry. */
export function readCompositionSelection(value: unknown, kind: unknown): CompositionSelection {
  const r = value as Partial<CompositionSelection> | null;
  if (
    !r ||
    r.version !== 1 ||
    ![0, 1, 2].includes(r.family!) ||
    !(typeof kind === "string" && Object.hasOwn(COMPOSITION_PROGRAMS, kind)) ||
    !(COMPOSITION_PROGRAMS[kind as CompositionKind] as readonly string[]).includes(r.program!) ||
    !(kind === "intersection" ? ["delivery", "maintenance"] : [kind]).includes(r.activity!) ||
    !Array.isArray(r.rejected) ||
    r.rejected.length > 2 ||
    r.rejected.some((s) => typeof s !== "string" || !s || s.length > 160)
  )
    throw new Error("Invalid saved composition choices.");
  return {
    version: 1,
    family: r.family!,
    program: r.program!,
    activity: r.activity!,
    rejected: [...r.rejected],
  };
}

export function compositionDescription(kind: string, choice: CompositionSelection): string {
  const families: Record<string, string[]> = {
    office: ["Central spine", "Circulation loop", "Open core"],
    intersection: ["Balanced crossing", "Shallow north blocks", "Deep north blocks"],
    alley: ["Middle receiving pocket", "South receiving pocket", "Wide passage / north pocket"],
    residential: ["Setback homes", "Offset driveways", "Cross-axis frontage"],
    warehouse: [
      "Receiving and rack hall",
      "Side office and loading apron",
      "Cross aisle stockrooms",
    ],
    garage: ["Shared vehicle hall", "Two vehicle halls", "Street-facing bays"],
    nightclub: ["Central dance floor", "Long room club", "Lounge and main room"],
  };
  const family = families[kind]?.[choice.family] ?? kind;
  const program: Record<CompositionSelection["program"], string> = {
    "shop-west": "shop beside service court",
    "shop-east": "housing beside service court",
    "opposed-pods": "opposed work pods",
    "parallel-pods": "parallel work pods",
    "west-delivery": "west-side deliveries",
    "east-delivery": "east-side deliveries / west maintenance",
    "near-driveways": "near-aligned household arrivals",
    "offset-arrivals": "offset east driveway / staggered arrivals",
    "cross-racks": "crosswise picking aisles",
    "lengthwise-racks": "lengthwise picking aisles",
    "paired-bays": "paired service bays",
    "staggered-bays": "staggered service bays",
    "bench-lounge": "joined lounge benches",
    "conversation-lounge": "opposed conversation groups",
  };
  return `${family} · ${program[choice.program]}${kind === "intersection" ? ` · ${choice.activity}` : ""} · ${choice.rejected.length ? `fallback after ${choice.rejected.length} rejected fit` : "first choice fit"}`;
}
