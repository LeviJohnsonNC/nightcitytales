import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PortraitGallery } from "./PortraitGallery";
import { useChargenStore, type ChargenState } from "./store";

const PRONOUN_PRESETS = ["she/her", "he/him", "they/them", "she/they", "he/they", "it/its"];

export function IdentityPanel({ state }: { state: ChargenState }) {
  const patch = useChargenStore((s) => s.patch);

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
        </div>
        <div className="space-y-2">
          <Label htmlFor="chargen-pronouns">Pronouns</Label>
          <Input
            id="chargen-pronouns"
            value={state.pronouns}
            onChange={(e) => patch({ pronouns: e.target.value })}
            placeholder="Anything you like"
          />
          <div className="flex flex-wrap gap-2">
            {PRONOUN_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-pressed={state.pronouns === preset}
                onClick={() => patch({ pronouns: preset })}
                className={`border px-3 py-1 font-mono text-[11px] tracking-[0.1em] transition-colors duration-200 ${
                  state.pronouns === preset
                    ? "border-ember bg-ember/15 text-text"
                    : "border-hairline text-text-muted hover:border-ember/60"
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
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
        </div>
      </div>

      <div className="space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-text-dim">
          Portrait gallery
        </p>
        <PortraitGallery
          roleId={state.roleId}
          selected={state.portrait}
          onSelect={(id) => patch({ portrait: id })}
        />
      </div>
    </div>
  );
}
