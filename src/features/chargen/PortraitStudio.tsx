import { useState } from "react";
import rolesData from "@/data/rules/roles.json";
import { Button } from "@/components/ui/button";
import { generatePortrait } from "./portraitGeneration";
import {
  MAX_PORTRAIT_GENERATIONS,
  MAX_PORTRAIT_TAKES,
  buildPortraitFacts,
  portraitMissing,
} from "./portraitPrompt";
import { PortraitLightbox } from "./PortraitLightbox";
import { usePortraitUrl } from "./usePortraitUrl";
import { useChargenStore, type ChargenState } from "./store";

/**
 * Portrait studio. One AI-generated portrait, regenerable, with the last few
 * takes kept so switching back costs nothing. Nothing here holds an image
 * path: stored portraits resolve through the backend storage adapter.
 */
export function PortraitStudio({ state, userId }: { state: ChargenState; userId: string }) {
  const patch = useChargenStore((s) => s.patch);
  const [drawing, setDrawing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewFinal, setPreviewFinal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const missing = portraitMissing(state);
  const capped = state.portraitGenerations >= MAX_PORTRAIT_GENERATIONS;
  const canDraw = missing.length === 0 && !capped;
  const storedUrl = usePortraitUrl(state.portraitPath);
  const shown = drawing && preview ? preview : storedUrl;

  async function draw(roleName?: string) {
    setDrawing(true);
    setError(null);
    setPreview(null);
    setPreviewFinal(false);
    try {
      const facts = buildPortraitFacts(state, roleName);
      const path = await generatePortrait(facts, userId, state.draftId, (url, isFinal) => {
        setPreview(url);
        setPreviewFinal(isFinal);
      });
      const takes = [...state.portraitTakes.filter((p) => p !== path), path].slice(
        -MAX_PORTRAIT_TAKES,
      );
      patch({
        portraitPath: path,
        portraitTakes: takes,
        portraitGenerations: state.portraitGenerations + 1,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not draw a portrait right now.");
    } finally {
      setDrawing(false);
      setPreview(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="relative aspect-[3/4] w-full border border-hairline bg-surface/60">
          {shown ? (
            <PortraitLightbox
              src={shown}
              alt={`${state.handle || state.name || "Character"} portrait`}
              subtitle={state.handle ? `"${state.handle}"` : undefined}
              className="h-full w-full"
            >
              <img
                src={shown}
                alt={`${state.handle || state.name || "Character"} portrait`}
                className={`h-full w-full object-cover transition-[filter] duration-500 ${
                  drawing && !previewFinal ? "blur-xl" : "blur-0"
                }`}
              />
            </PortraitLightbox>
          ) : (
            <div className="flex h-full items-center justify-center p-4 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim">
              {drawing ? "Exposing the plate…" : "No portrait yet"}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <Button
            disabled={!canDraw || drawing}
            onClick={() => draw(state.roleId ? roleName(state.roleId) : undefined)}
          >
            {drawing
              ? "Drawing…"
              : state.portraitPath
                ? "Regenerate portrait"
                : "Generate portrait"}
          </Button>

          {missing.length > 0 && (
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-dim">
              Finish first: {missing.join(", ")}
            </p>
          )}
          {capped && missing.length === 0 && (
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-dim">
              Generation limit reached for this character. Pick from your takes below.
            </p>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}

          <p className="text-sm text-text-muted">
            Built from your Role, pronouns and Lifepath look. Regenerating keeps your last{" "}
            {MAX_PORTRAIT_TAKES} takes, and switching between them is free.
          </p>

          {state.portraitTakes.length > 1 && (
            <ul className="flex flex-wrap gap-2">
              {state.portraitTakes.map((path) => (
                <li key={path}>
                  <TakeThumb
                    path={path}
                    selected={path === state.portraitPath}
                    onSelect={() => patch({ portraitPath: path })}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function TakeThumb({
  path,
  selected,
  onSelect,
}: {
  path: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const url = usePortraitUrl(path);
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className={`h-20 w-[3.75rem] overflow-hidden border transition-colors duration-200 ${
          selected ? "border-ember" : "border-hairline hover:border-ember/60"
        }`}
      >
        {url ? (
          <img src={url} alt="Portrait take" className="h-full w-full object-cover" />
        ) : (
          <span className="sr-only">Loading take</span>
        )}
      </button>
      {url && (
        <PortraitLightbox
          src={url}
          alt="Portrait take"
          className="h-20 w-[3.75rem]"
        >
          <div className="flex h-full w-full items-center justify-center border border-hairline bg-surface/60 text-text-dim hover:border-ember/60">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </div>
        </PortraitLightbox>
      )}
    </div>
  );
}

function roleName(roleId: string): string | undefined {
  return ROLE_NAMES[roleId]?.name;
}

const ROLE_NAMES = rolesData.roles as unknown as Record<string, { name: string }>;
