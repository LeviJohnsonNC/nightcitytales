/** Read-only, bounded handoff inventory. No network, source dumps or environment values. */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
function git(args) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    timeout: 5000,
    maxBuffer: 1024 * 1024,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" },
  });
  if (result.error || result.status !== 0) {
    console.error(`git ${args[0]} failed; inspect this checkout locally.`);
    process.exitCode = 1;
    return null;
  }
  return result.stdout.trimEnd();
}
function bounded(text, limit) {
  const lines = text.split("\n");
  for (const line of lines.slice(0, limit))
    console.log(line.length > 500 ? `${line.slice(0, 500)} [truncated]` : line);
  if (lines.length > limit) console.log(`[${lines.length - limit} more lines omitted]`);
}

console.log("LOCAL SNAPSHOT — remote branch and CI status are not checked.");
console.log(`Checkout: ${root}`);
const head = git(["log", "-1", "--format=%h %s"]);
if (head !== null) bounded(`HEAD: ${head}`, 1);
const status = git(["status", "--short", "--branch", "--untracked-files=normal"]);
if (status !== null) bounded(status, 30);
console.log("\nSESSION.md (verify observations before acting):");
try {
  bounded(readFileSync(new URL("../SESSION.md", import.meta.url), "utf8"), 100);
} catch {
  console.error("SESSION.md is missing or unreadable; reconstruct a concise handoff first.");
  process.exitCode = 1;
}
