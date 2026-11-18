import type { Beat, MissionRuntime } from "../mission";

export type Investigation = { source: string; subject: string };
export type EvidenceEnding = "delivered" | "leaked" | "buried";

// The original terminal beat stays addressable for old saves. Only a choice
// from the evidence beat earns a new ending.
export function evidenceEnding(runtime: MissionRuntime): EvidenceEnding | null {
  const choice = runtime.branchChoices["evidence"];
  if (runtime.status !== "completed" || choice !== runtime.currentBeatId) return null;
  if (choice === "resolution") return "delivered";
  return choice === "leaked" || choice === "buried" ? choice : null;
}

export function investigationEndings(inquiry: Investigation, patron: string): Beat[] {
  const { source, subject } = inquiry;
  const brief = `The transfer order for ${subject} names ${patron} as the person who authorized it. ${source} signed as witness. “That's my name on the last page. If you bury that copy, call me in a week.”`;
  return [
    {
      id: "evidence",
      type: "dev",
      title: "Who gets the evidence?",
      playerBrief: brief,
      gmBrief:
        brief +
        " The player holds the only copy. Leave its disposition to the player's explicit choice.",
      evidenceDecision: true,
      exits: [
        { to: "resolution", label: "Deliver the signed file and collect the fee" },
        { to: "leaked", label: "Leak the signed file to the Screamsheet and give up the fee" },
        { to: "buried", label: `Destroy the file to protect ${source} and give up the fee` },
      ],
    },
    {
      id: "leaked",
      type: "resolution",
      title: "In print",
      gmBrief: "The signed file reaches the Screamsheet. The client gets no delivery.",
      exits: [],
    },
    {
      id: "buried",
      type: "resolution",
      title: "Off the record",
      gmBrief: `The only copy is gone. ${source} gives the runner a private number.`,
      exits: [],
    },
  ];
}
