import { useState } from "react";
import rolesData from "@/data/rules/roles.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PortraitStudio } from "./PortraitStudio";
import {
  buildSelfDescriptionInput,
  generateSelfDescription,
  selfDescriptionMissing,
} from "./selfDescription";
import { useChargenStore, type ChargenState } from "./store";
import { suggestHandles } from "./handleSuggestions";
import { fixerShortName } from "./interview";
import "./interview.css";

const ROLE_NAMES = rolesData.roles as unknown as Record<string, { name: string }>;

export function IdentityPanel({ state, userId }: { state: ChargenState; userId: string }) {
  const patch = useChargenStore((s) => s.patch);
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [handles, setHandles] = useState<string[]>([]);
  const [naming, setNaming] = useState(false);
  const [namingError, setNamingError] = useState<string | null>(null);
  const fixer = state.castPlan?.picks.fixer ?? null;

  async function askForHandles() {
    setNaming(true);
    setNamingError(null);
    try {
      const roleName = state.roleId ? ROLE_NAMES[state.roleId]?.name : undefined;
      const next = await suggestHandles(state, roleName);
      if (!next.length) throw new Error("No names came back. Ask again.");
      setHandles(next);
    } catch (e) {
      setNamingError(e instanceof Error ? e.message : "Could not think of a name right now.");
    } finally {
      setNaming(false);
    }
  }

  const missing = selfDescriptionMissing(state);
  const canWrite = missing.length === 0;

  async function writeDescription() {
    setWriting(true);
    setError(null);
    try {
      const roleName = state.roleId ? ROLE_NAMES[state.roleId]?.name : undefined;
      const text = await generateSelfDescription(buildSelfDescriptionInput(state, roleName));
      patch({ selfDescription: text });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not write a description right now.");
    } finally {
      setWriting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="chargen-name">Name (required)</Label>
          <Input
            id="chargen-name"
            value={state.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="Legal name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="chargen-handle">Handle (required)</Label>
          <Input
            id="chargen-handle"
            value={state.handle}
            onChange={(e) => patch({ handle: e.target.value })}
            placeholder="Street name"
          />
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-text-dim">
            This is what the GM will call you
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!state.roleId || naming}
              onClick={askForHandles}
            >
              {naming
                ? "Thinking of names…"
                : handles.length
                  ? "Ask again"
                  : `Ask ${fixer ? fixerShortName(fixer) : "your fixer"} for a handle`}
            </Button>
            {handles.map((handle) => (
              <button
                key={handle}
                type="button"
                aria-pressed={state.handle === handle}
                onClick={() => patch({ handle })}
                className={`cg-say border px-3 py-1 font-mono text-[11px] tracking-[0.1em] transition-colors duration-200 ${
                  state.handle === handle
                    ? "border-ember bg-ember/15 text-text"
                    : "border-hairline text-text-muted hover:border-ember/60"
                }`}
              >
                {handle}
              </button>
            ))}
          </div>
          {namingError && <p className="text-sm text-danger">{namingError}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="chargen-description">One-line self-description (optional)</Label>
          <Textarea
            id="chargen-description"
            value={state.selfDescription}
            onChange={(e) => patch({ selfDescription: e.target.value })}
            placeholder="How they read at a glance."
            rows={3}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              disabled={!canWrite || writing}
              onClick={writeDescription}
            >
              {writing
                ? "Writing…"
                : state.selfDescription.trim()
                  ? "Write another"
                  : "Write one for me"}
            </Button>
            {!canWrite && (
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-dim">
                Needs {missing.join(", ")}
              </p>
            )}
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-dim">
            Anything written here is yours to edit or replace.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-text-dim">Portrait</p>
        <PortraitStudio state={state} userId={userId} />
      </div>
    </div>
  );
}
