import { expect, it } from "vitest";
import { composeScene } from "@/engine";
import { interiorThresholds } from "../courtyard/interiorThresholds";

it("derives distinct primary/service thresholds from saved room connections", () => {
  for (const seed of [1, 2, 3]) {
    const arena = composeScene("office", seed).layout.arena;
    const before = JSON.stringify(arena);
    const thresholds = interiorThresholds(arena);
    expect(thresholds.filter((t) => t.role === "primary")).toHaveLength(1);
    expect(thresholds.filter((t) => t.role === "service")).toHaveLength(1);
    const span = (role: string) => {
      const [a, b] = thresholds.find((t) => t.role === role)!.posts;
      return Math.hypot(a!.x - b!.x, a!.y - b!.y);
    };
    expect(span("primary")).toBe(5.5);
    expect(span("service")).toBe(3.5);
    expect(thresholds).toHaveLength(arena.environment!.interior!.connections.length);
    expect(JSON.stringify(arena)).toBe(before);
  }
  expect(interiorThresholds(composeScene("intersection", 1).layout.arena)).toEqual([]);
});
