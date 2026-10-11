import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { NpcDossier } from "@/features/cast/NpcName";
import type { findNpcNumbered } from "@/features/cast/npcDirectory";

/** The combat screen's dialogs: a combatant's dossier, and the journal or improvise panel. */
export function CombatDialogs({
  dossierNpc,
  setDossier,
  panel,
  setPanel,
  improvisation,
  journal,
}: {
  dossierNpc: ReturnType<typeof findNpcNumbered>;
  setDossier: (name: string | null) => void;
  panel: "journal" | "improvise" | null;
  setPanel: (panel: "journal" | "improvise" | null) => void;
  improvisation: ReactNode;
  journal: ReactNode;
}) {
  return (
    <>
      {dossierNpc && (
        <NpcDossier
          npc={dossierNpc}
          open={true}
          onOpenChange={(open) => {
            if (!open) setDossier(null);
          }}
        />
      )}
      <Dialog
        open={panel !== null}
        onOpenChange={(open) => {
          if (!open) setPanel(null);
        }}
      >
        <DialogContent className="combat-dialog">
          <DialogTitle>
            {panel === "improvise" ? "What do you have in mind?" : "Combat journal"}
          </DialogTitle>
          <DialogDescription>
            {panel === "improvise"
              ? "Describe your intent. The game checks what is possible."
              : "The scene, your character, and the record of the fight."}
          </DialogDescription>
          <div className="combat-dialog-body">
            {panel === "improvise" ? improvisation : journal}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
