import { Phone, Signal } from "lucide-react";
import { FacePlate } from "@/features/cast/FacePlate";
import { findNpc, isPerson, npcArtwork } from "@/features/cast/npcDirectory";
import { portraitArt, portraitById } from "@/features/chargen/art";
import { usePortraitUrl } from "@/features/chargen/usePortraitUrl";
import type { AgentCall } from "@/engine";
import type { FullCharacter } from "@/lib/backend";

export function AgentCallStrip({
  player,
  call,
}: {
  player: FullCharacter["character"];
  call: AgentCall;
}) {
  const generated = usePortraitUrl(player.portrait_path);
  const preset = player.portrait_id ? portraitById(player.portrait_id) : undefined;
  const portrait = generated ?? (preset ? portraitArt(preset).src : null);
  const npc = findNpc(call.name);
  const other = npc && isPerson(npc) ? npcArtwork(npc) : null;

  return (
    <section className="life-agent-call" aria-label="Agent voice call">
      <div className="life-agent-person">
        <FacePlate key={portrait} src={portrait} name={player.name} className="life-agent-face" />
        <div>
          <strong>{player.name}</strong>
          <span>You</span>
        </div>
      </div>
      <div className="life-agent-line">
        <div className="life-agent-connection">
          <div className="life-agent-icons" aria-hidden="true">
            <Phone size={19} />
            <Signal size={15} />
          </div>
          <span className="life-agent-channel">Voice call</span>
          <span className="life-agent-connected">
            {call.direction === "incoming" && "Incoming · "}Connected
          </span>
        </div>
      </div>
      <div className="life-agent-person life-agent-contact">
        <FacePlate
          key={call.contactKey}
          src={other?.src}
          srcSet={other?.srcSet}
          sizes="64px"
          name={call.name}
          className="life-agent-face"
        />
        <div>
          <strong>{call.name}</strong>
          <span>{call.role}</span>
        </div>
      </div>
    </section>
  );
}
