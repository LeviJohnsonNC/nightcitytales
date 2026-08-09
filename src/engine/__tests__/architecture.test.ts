import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ENGINE_DIR = join(process.cwd(), "src/engine");
const FORBIDDEN = ["react", "@/integrations", "@/lib/backend", "@/features", "supabase"];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return files(full);
    return full.endsWith(".ts") || full.endsWith(".tsx") ? [full] : [];
  });
}

describe("engine purity", () => {
  it("never imports React, the backend, or feature code", () => {
    const offenders = files(ENGINE_DIR)
      .filter((file) => !file.includes("__tests__"))
      .filter((file) => {
        const source = readFileSync(file, "utf8");
        const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]!);
        return imports.some((spec) => FORBIDDEN.some((bad) => spec === bad || spec.startsWith(bad)));
      });
    expect(offenders).toEqual([]);
  });
});