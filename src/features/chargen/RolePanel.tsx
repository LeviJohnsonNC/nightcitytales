import { useState } from "react";
import rolesData from "@/data/rules/roles.json";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ArtSlot } from "./ArtSlot";
import { roleArt } from "./art";
import { ROLE_PLAYS_LIKE } from "./copy";
import type { ChargenState } from "./store";

type Role = {
  id: string;
  name: string;
  tagline: string;
  flavorText: string;
  roleAbility: { id: string; name: string; startingRank: number; mechanicalText: string };
};

const ROLES = Object.values(rolesData.roles as unknown as Record<string, Role>);

function RoleCard({
  role,
  selected,
  onSelect,
}: {
  role: Role;
  selected: boolean;
  onSelect: () => void;
}) {
  const [openFlavor, setOpenFlavor] = useState(false);
  const art = roleArt(role.id, role.name);
  const playsLike = ROLE_PLAYS_LIKE[role.id];

  return (
    <article
      className={cn(
        "flex flex-col border border-border bg-card transition-colors",
        selected ? "border-accent bg-accent/5" : "hover:border-accent/50",
      )}
    >
      <div className="h-40 shrink-0 border-b border-border">
        <ArtSlot art={art} label={role.name} className="border-0" />
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h2 className="text-xl font-bold tracking-tight">{role.name}</h2>
        <p className="mt-1 text-sm text-accent">{role.tagline}</p>

        <p
          className={cn(
            "mt-3 text-sm leading-relaxed text-muted-foreground",
            !openFlavor && "line-clamp-5",
          )}
        >
          {role.flavorText}
        </p>
        <button
          type="button"
          onClick={() => setOpenFlavor((v) => !v)}
          className="mt-1 self-start font-mono text-[10px] uppercase tracking-[0.2em] text-accent hover:underline"
        >
          {openFlavor ? "Less" : "Read more"}
        </button>

        {playsLike && (
          <p className="mt-3 border-l-2 border-accent/60 pl-3 text-sm text-foreground">
            {playsLike}
          </p>
        )}

        <div className="mt-4 border-t border-border pt-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Role Ability
          </p>
          <p className="font-mono text-base font-bold tracking-tight text-foreground">
            {role.roleAbility.name}
            <span className="ml-2 text-accent">Rank {role.roleAbility.startingRank}</span>
          </p>

          <Collapsible>
            <CollapsibleTrigger className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-accent hover:underline">
              What this actually does
            </CollapsibleTrigger>
            <CollapsibleContent>
              <p className="mt-2 max-h-56 overflow-y-auto border border-border bg-background p-3 text-xs leading-relaxed text-muted-foreground">
                {role.roleAbility.mechanicalText}
              </p>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <Button
          className="mt-4"
          variant={selected ? "default" : "outline"}
          aria-pressed={selected}
          onClick={onSelect}
        >
          {selected ? `Locked in — ${role.roleAbility.name} Rank ${role.roleAbility.startingRank}` : `Play the ${role.name}`}
        </Button>
      </div>
    </article>
  );
}

export function RolePanel({
  state,
  onRequestRole,
}: {
  state: ChargenState;
  onRequestRole: (roleId: string) => void;
}) {
  return (
    <div className="space-y-4">
      {state.roleAbility && (
        <p className="border border-accent/40 bg-accent/10 p-3 font-mono text-[11px] uppercase tracking-[0.2em] text-foreground">
          Role Ability set: {state.roleAbility.name} — Rank {state.roleAbility.rank}
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {ROLES.map((role) => (
          <RoleCard
            key={role.id}
            role={role}
            selected={state.roleId === role.id}
            onSelect={() => onRequestRole(role.id)}
          />
        ))}
      </div>
    </div>
  );
}
