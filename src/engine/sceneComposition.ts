/** Coordinate-free, independently seeded choices over compatible authored recipes. */
export type CompositionSelection = {
  version: 1;
  family: 0 | 1 | 2;
  program: "shop-west" | "shop-east" | "opposed-pods" | "parallel-pods";
  activity: "delivery" | "maintenance" | "office";
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

export function compositionSelection(
  kind: "intersection" | "office",
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
        : !reference && compositionChoice(seed, "office/pods", 2)
          ? "parallel-pods"
          : "opposed-pods",
    activity:
      kind === "office"
        ? "office"
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
    !(
      kind === "intersection"
        ? ["shop-west", "shop-east"]
        : kind === "office"
          ? ["opposed-pods", "parallel-pods"]
          : []
    ).includes(r.program!) ||
    !(kind === "office" ? ["office"] : ["delivery", "maintenance"]).includes(r.activity!) ||
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
  const family =
    kind === "office"
      ? ["Central spine", "Circulation loop", "Open core"][choice.family]
      : ["Balanced crossing", "Shallow north blocks", "Deep north blocks"][choice.family];
  const program = {
    "shop-west": "shop beside service court",
    "shop-east": "housing beside service court",
    "opposed-pods": "opposed work pods",
    "parallel-pods": "parallel work pods",
  }[choice.program];
  return `${family} · ${program}${choice.activity === "office" ? "" : ` · ${choice.activity}`} · ${choice.rejected.length ? `fallback after ${choice.rejected.length} rejected fit` : "first choice fit"}`;
}
