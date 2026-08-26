/**
 * The character sheet, one click away during play. Read-only: it renders the
 * same assembled sheet the roster shows, from the saved character rows.
 */
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { assembleCharacter } from "@/engine";
import { CharacterSheet } from "@/features/chargen/CharacterSheet";
import { buildFromState } from "@/features/chargen/sheetModel";
import { stateFromCharacter } from "@/features/roster/characterState";
import type { FullCharacter } from "@/lib/backend";

export function SheetDrawer({ character }: { character: FullCharacter }) {
  const state = stateFromCharacter(character);
  const build = buildFromState(state);
  const sheet = assembleCharacter(build);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
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
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
