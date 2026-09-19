/**
 * The character sheet, one click away during play.
 *
 * Read-only, and in two halves that are honest about being different things:
 * the assembled sheet they were created with, and what the character is
 * CARRYING, read live from the campaign's inventory. A sheet alone cannot
 * answer "do I still have a spare magazine", because it was written before the
 * campaign started and never changes again.
 *
 * The live half is handed to the sheet rather than stacked on top of it, so it
 * sits folded under Weapons and Armor — beside the printed kit it is the
 * current truth about, instead of in front of the whole document.
 */
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NotebookText } from "lucide-react";
import { assembleCharacter } from "@/engine";
import { CarriedKit } from "./CarriedKitView";
import { CharacterSheet } from "@/features/chargen/CharacterSheet";
import { buildFromState } from "@/features/chargen/sheetModel";
import { stateFromCharacter } from "@/features/roster/characterState";
import type { CampaignCyberware, CampaignInventoryItem, FullCharacter } from "@/lib/backend";

export function SheetDrawer({
  character,
  inventory,
  cyberware,
}: {
  character: FullCharacter;
  /** The campaign's live kit. Omitted on surfaces that have no campaign. */
  inventory?: CampaignInventoryItem[];
  cyberware?: CampaignCyberware[];
}) {
  const state = stateFromCharacter(character);
  const build = buildFromState(state);
  const sheet = assembleCharacter(build);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="secondary" size="default">
          <NotebookText />
          Character sheet
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:max-w-3xl"
      >
        <SheetHeader>
          <SheetTitle>{character.character.name}</SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          <CharacterSheet
            state={state}
            build={build}
            sheet={sheet}
            improvementPoints={character.finance?.improvement_points ?? 0}
            {...(inventory
              ? {
                  carrying: (
                    <CarriedKit inventory={inventory} {...(cyberware ? { cyberware } : {})} />
                  ),
                }
              : {})}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
