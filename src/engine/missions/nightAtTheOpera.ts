/**
 * "A Night at the Opera" — the opening Tale from Tales from the RED (pg. 5-14),
 * transcribed into a beat graph. The book's own recommended starter: an
 * investigation in the University District that ends in a cyberpsycho showdown.
 *
 * Faithful to the printed Beat Chart. GM briefs summarize each beat for the AI
 * to narrate; DVs are copied from the source and set in advance. The player is a
 * single Edgerunner (solo-scaling applies to the combat beats per the plan).
 */
import { stableKey, type Beat, type Mission, type MissionRuntime } from "../mission";
import { TIME_COSTS } from "../clock";

const patron = "George Edward Rhinemeyer (Rocklin Augmentics) — hiring through a representative";
const OPERA_ID = "night-at-the-opera";
export const OPERA_OPENING_BEAT = "hook";

/** The opening establishes facts and approaches. Entry is a separate decision. */
export const operaApproaches = [
  {
    to: "opera_clerk",
    label: "Question the clerk",
    hint: "Ask about the handbill.",
    minutes: TIME_COSTS.call,
    aliases: [
      "call the desk clerk",
      "ask the clerk",
      "ask the clerk about the flyer",
      "ask the clerk about the handbill",
      "ask the desk clerk about the flyer",
    ],
    lead: "Len Vale, promoter",
    response:
      "The clerk sends a photo of a battered handbill. “Len Vale left these. He books the Vampyres. Tell him you’re after a ticket and keep my name out of it.” Someone has written Len’s number on the back.",
    fact: "The clerk sent a handbill with promoter Len Vale’s number on the back. The clerk asked the player to keep their name out of it.",
    route: {
      to: "opera_guest_list",
      label: "Call the promoter",
      aliases: ["call len vale", "call len", "ring the promoter"],
      minutes: TIME_COSTS.call,
      title: "A place on the guest list",
      response:
        "Len Vale agrees to put an alias of your choice on the guest list. Check in at the front desk tomorrow night. Len wants the alias when you arrive. There’s room for one, and he never asks who gave you his number.",
      fact: "Len Vale is holding one place on the guest list. The player can use an alias at the Symphony Hall front desk, and has kept the clerk’s name out of the call.",
      entry: "Enter on the guest list",
    },
  },
  {
    to: "opera_broadcast",
    label: "Review the broadcast",
    hint: "Trace the flyer without contacting anyone.",
    minutes: TIME_COSTS.quick,
    aliases: [
      "watch the broadcast",
      "scrub through the broadcast",
      "scrub the net 54 footage",
      "review the net 54 broadcast",
    ],
    lead: "Garden Patch invitation",
    response:
      "You pause on two frames the broadcast cuts away from. A black invitation is taped beside the campus gate. Under the Vampyres’ crest, there’s a Garden Patch handle and a listing code. The footage has enough detail to bring up the listing without contacting anyone.",
    fact: "Two frames of the Net 54 report show a Garden Patch handle and listing code on the Vampyres’ handbill. The player recovered them without contacting anyone.",
    route: {
      to: "opera_public_listing",
      label: "Look up the invitation",
      aliases: [
        "look up the listing",
        "search garden patch",
        "look up the garden patch invitation",
      ],
      minutes: TIME_COSTS.quick,
      title: "The public ticket window",
      response:
        "The code opens tomorrow’s public listing for the old Symphony Hall. Tickets are still available. The front doors open at sundown. The dress code is black velvet and danger. You can join the public queue without attaching your name to a guest list or press pass.",
      fact: "The Garden Patch code opened the public listing. The player found the sundown ticket window and dress code independently. Nobody was contacted and no ticket has been purchased yet.",
      entry: "Buy a ticket and join the public queue",
    },
  },
  {
    to: "opera_campus",
    label: "Call a campus source",
    hint: "Work a contact at the campus paper.",
    minutes: TIME_COSTS.call,
    aliases: ["call the campus paper", "call the campus source", "phone the campus paper"],
    lead: "A press entrance at the Symphony Hall",
    response:
      "An editor at the campus paper recognizes the flyer. “Old Symphony Hall. The event crew uses the service door and they’ve got a press list. I can put you in touch with the person holding it. If you turn up anything about Lucy, give me a call.”",
    fact: "A campus paper editor identified a press list at the Symphony Hall service door. They offered an introduction and asked the player to call back with any news about Lucy.",
    route: {
      to: "opera_press_access",
      label: "Ask for the press contact",
      aliases: [
        "contact the press",
        "ask for an introduction",
        "ask the editor for the press contact",
      ],
      minutes: TIME_COSTS.conversation,
      title: "Press check-in at the service door",
      response:
        "The editor connects you to the press coordinator. You can check in at the service door before the general queue opens, using the campus paper’s name. The coordinator will expect you to identify yourself as press. The editor asks again to hear what turns up about Lucy.",
      fact: "The editor introduced the player to the press coordinator. The invitation is for press check-in at the service door before the public doors open. The editor expects a follow-up about Lucy.",
      entry: "Check in with the press coordinator",
    },
  },
] as const;

export function isOperaOpeningBeat(mission: Mission, beat: Beat): boolean {
  return (
    mission.id === OPERA_ID &&
    (beat.id === OPERA_OPENING_BEAT ||
      operaApproaches.some(({ to, route }) => to === beat.id || route.to === beat.id))
  );
}

export function operaFirstLead(runtime: MissionRuntime | null) {
  if (runtime?.missionId !== OPERA_ID) return undefined;
  return operaApproaches.find(
    (approach) => approach.to === runtime.branchChoices[OPERA_OPENING_BEAT],
  );
}

export function operaEntryRoute(runtime: MissionRuntime | null) {
  const lead = operaFirstLead(runtime);
  return lead && runtime?.branchChoices[lead.to] === lead.route.to ? lead.route : undefined;
}

export function operaKnownFacts(runtime: MissionRuntime | null): string[] {
  const lead = operaFirstLead(runtime);
  const route = operaEntryRoute(runtime);
  if (!lead) return [];
  if (!route) return [lead.fact];
  const used = runtime?.branchChoices[route.to] === "night_at_opera";
  return [
    lead.fact,
    used ? route.fact + " The player chose to enter using this route." : route.fact,
  ];
}

export type OperaAction = {
  from: string;
  to: string;
  label: string;
  aliases: readonly string[];
  minutes: number;
};

function operaActionsAt(runtime: MissionRuntime | null): OperaAction[] {
  if (runtime?.missionId !== OPERA_ID || runtime.status !== "active") return [];
  if (runtime.currentBeatId === OPERA_OPENING_BEAT) {
    return operaApproaches.map(({ to, label, aliases, minutes }) => ({
      from: OPERA_OPENING_BEAT,
      to,
      label,
      aliases,
      minutes,
    }));
  }
  const lead = operaFirstLead(runtime);
  return lead && runtime.currentBeatId === lead.to ? [{ ...lead.route, from: lead.to }] : [];
}

export function operaActionForExit(
  runtime: MissionRuntime | null,
  to: string,
): OperaAction | undefined {
  return operaActionsAt(runtime).find((action) => action.to === to);
}

/** Recognize a whole, unambiguous action. Leave any additional intent to the GM. */
export function operaActionFromText(
  runtime: MissionRuntime | null,
  input: string,
): OperaAction | undefined {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/, "")
    .replace(/^(?:i want to |i'll |i will |can i |i )/, "")
    .replace(/ +/g, " ");
  return operaActionsAt(runtime).find(
    ({ label, aliases }) => label.toLowerCase() === normalized || aliases.includes(normalized),
  );
}

const operaLeadBeats: Beat[] = operaApproaches.map(({ to, lead, response, route }) => ({
  id: to,
  type: "dev",
  title: lead,
  readAloud: response,
  gmBrief:
    "This lead has already been found. Continue from the player's response to it. Party access is still open, and the lead has not yet been followed.",
  exits: [{ to: route.to, label: route.label }],
}));

const operaRouteBeats: Beat[] = operaApproaches.map(({ route }) => ({
  id: route.to,
  type: "dev",
  title: route.title,
  readAloud: route.response,
  gmBrief:
    "The player has established this way in. Let them decide how to use it. Keep entry conditions consistent with the known facts.",
  exits: [
    { to: "night_at_opera", label: route.entry },
    { to: "getting_tickets", label: "Check the campus poster and talk to students" },
  ],
}));

export const NIGHT_AT_THE_OPERA: Mission = {
  id: OPERA_ID,
  title: "A Night at the Opera",
  subtitle: "Darkness and Desire in Night City",
  source: "Tales from the RED: Street Stories, pg. 5-14",
  patron,
  offer: {
    brokerName: "Rhinemeyer family representative",
    brokerKey: stableKey(patron), // Existing campaigns know the representative by this key.
    brokerLine: "Private message",
    patronName: "George Edward Rhinemeyer",
    patronOrg: "Rocklin Augmentics",
    district: "University District",
    opposition: "The official investigation has stalled. The campus paper is still taking tips.",
    pitch:
      "Lucy, 19, is the seventh woman to disappear near the university in four weeks. The report is still on your Agent when a private message comes in. Her family wants you to find her.",
    ask: "Recover Lucy Rhinemeyer",
  },
  reward: {
    eurobucksPerHead: 2000,
    upfront: 500,
    notes: "500eb on signing; the remainder once Lucy Rhinemeyer is recovered, in whatever state.",
  },
  startBeatId: "background",
  beats: [
    {
      id: "background",
      type: "background",
      title: "Background",
      page: 6,
      readAloud:
        "Net 54 Crimewatchers: a string of missing persons across the University District claims its latest victim — Lucy Rhinemeyer, 19, daughter of Rocklin Augmentics Executive Engineer George Edward Rhinemeyer. Seven women gone in four weeks; NCPD has no leads. Early the next morning, a message arrives from Mr. Rhinemeyer's representative offering 500eb up front and 2,000eb per head on recovery, in whatever state you find her.",
      gmBrief:
        "Set the neon-noir tone. A grieving Exec, a missing daughter, and a fee that is better than the work looks. Play it as the straightforward recovery it is being sold as — you have not been told otherwise, and neither has the Edgerunner.",
      truths: [
        {
          id: "pawn",
          kind: "motive",
          fact: "This was never a recovery job. The Edgerunner is a pawn in a scheme by The Master, a Philharmonic Vampyre leader, to quietly deal with one of their own.",
          skill: "deduction",
          difficulty: "Professional",
          // The Master says it himself when the Crew is finally received as a
          // guest. A twist has to be able to land on the scene built to land it.
          revealedAt: "darkness_and_light",
          // Nobody reasons their way to this from a news broadcast and a fee.
          // It needs the two pieces that make it thinkable: that the Vampyres
          // in the hall are theatre, and that the man taking the women is one
          // of their own. Reaching the meeting hands it over regardless.
          needs: ["night_at_opera:theatre_not_threat", "empty_office_hours:huntver_is_ruthven"],
        },
      ],
      playerBrief:
        "Seven women have vanished from the University District in four weeks. The latest is Lucy Rhinemeyer, 19. Her father's representative is offering 500eb up front and 2,000eb per head on recovery, in whatever state you find her.",
      objectives: [{ key: "recover_lucy", text: "Recover Lucy Rhinemeyer" }],
      exits: [{ to: "hook", label: "Take the job" }],
    },
    {
      id: OPERA_OPENING_BEAT,
      type: "hook",
      title: "The Hook",
      page: 6,
      gmBrief:
        "Lucy Rhinemeyer is the seventh woman missing near the university in four weeks. Her father's proxy hired the player. Both police leads point to the Philharmonic Vampyres. A Net 54 report, the desk clerk at Evergreen Apartments (in person if there, reachable otherwise), and the campus paper could turn up leads. Honor the player's own approach.",
      truths: [
        {
          id: "bribe",
          kind: "social",
          fact: "Rhinemeyer is paying NCPD under the table to keep his daughter's case at the top of a pile they have no resources for.",
          skill: "streetwise",
          difficulty: "Difficult",
        },
      ],
      playerBrief:
        "NCPD and Campus Security both like a campus crew called the Philharmonic Vampyres for the disappearances, and neither can move on them. Your patron wants you inside one of their parties, asking questions where badges can't.",
      exits: [
        ...operaApproaches.map(({ to, label }) => ({ to, label })),
        { to: "getting_tickets", label: "Find a way into the Vampyres' party" },
      ],
    },
    ...operaLeadBeats,
    ...operaRouteBeats,
    {
      id: "getting_tickets",
      type: "dev",
      title: "Getting Tickets",
      page: 7,
      gmBrief:
        "A garish poster advertises 'A Night at the Opera with the Philharmonic Vampyres' at the old Night City Symphony Hall, just off campus — tomorrow night, tickets via Garden Patch, dress code 'Old World meets New World: Drama, Sensuality, Black Velvet, Danger.' Six students at the bus stop gossip: the shows are theatrical (and notoriously debauched), and the missing women have everyone on edge. One student gripes that their psychology thesis advisor has gone silent and stopped answering mail — a thread worth pulling.",
      playerBrief:
        "A poster on campus: 'A Night at the Opera with the Philharmonic Vampyres', old Symphony Hall, tomorrow night, tickets through Garden Patch. Dress code is black velvet and danger. Student gossip says the shows get debauched — and that one psychology advisor has gone quiet and stopped answering mail.",
      exits: [
        { to: "night_at_opera", label: "Buy tickets and attend the show" },
        {
          to: "empty_office_hours",
          label: "Follow up on the professor who has gone silent",
          sets: ["investigated_professor"],
        },
      ],
    },
    {
      id: "night_at_opera",
      type: "cliff",
      title: "Night at the Opera",
      page: 7,
      gmBrief:
        "Just after sundown, a line forms outside the symphony hall; a battered Campus Security aerodyne is parked out front. A top-hatted, ghost-white host barks invitations while burlesque dancers writhe. No one checks for weapons. Inside, a futuristic staging of Dracula unfolds — style, swagger, and menace. Play the spectacle straight and let them watch it.",
      truths: [
        {
          id: "theatre_not_threat",
          kind: "social",
          fact: "The menace here is staging. These people are performers who like the costume; whatever is taking women off this campus is not in this room.",
          skill: "human_perception",
          difficulty: "Difficult",
        },
        {
          id: "security_are_vampyres",
          kind: "physical",
          fact: "The two Campus Security officers out front are carrying Vampyres cyberware. Campus Security and the gang are the same people.",
          skill: "perception",
          difficulty: "Everyday",
        },
      ],
      playerBrief:
        "You're in line outside the Symphony Hall after sundown. Nobody checks for weapons. Inside is a staging of Dracula with real teeth behind the theatre — and plenty to notice if you're watching.",
      checks: [
        // The note said what the check WOULD FIND, which handed the model the
        // answer before the player had it. It is a truth now; the note names
        // where to look.
        { skill: "Perception", dv: 9, note: "The Campus Security officers out front." },
      ],
      exits: [{ to: "noodles_and_info", label: "Work the leads after the show" }],
    },
    {
      id: "noodles_and_info",
      type: "dev",
      title: "Noodles and Info",
      page: 10,
      gmBrief:
        "The Philharmonic Vampyres make contact on their own terms: their servant Renfield delivers a note arranging a meeting, then the Vampyres melt back into the crowd. They are not looking for a fight — provoke them and they flee behind Smoke Grenades, leaving only the note. The note points back to the Symphony Hall to meet The Master.",
      playerBrief:
        "The Vampyres approached you, not the other way around. A servant pressed a note into your hand: a meeting, back at the Symphony Hall, with someone they call The Master.",
      exits: [{ to: "darkness_and_light", label: "Go to the meeting the note arranges" }],
    },
    {
      id: "empty_office_hours",
      type: "opdev",
      title: "Empty Office Hours (optional)",
      page: 11,
      gmBrief:
        "Professor Huntver's office, fourth floor of the social sciences building. He has not answered mail in weeks and the door is locked. Describe the room as somebody finds it — academic clutter, regalia on a hook, a mini-fridge with a lock on it — and let them search. What searching turns up is the engine's to say, not yours: do not decide what is in here.",
      truths: [
        {
          id: "photo",
          kind: "physical",
          fact: "A photograph of Network 54 anchor Barbara Dahl on Huntver's desk, kissed so often the print has worn through.",
          skill: "perception",
          difficulty: "Everyday",
        },
        {
          id: "costume",
          kind: "physical",
          fact: "Behind the academic regalia: a bloodstained clown costume and an Inquisitor uniform, both hidden rather than stored.",
          skill: "perception",
          difficulty: "Difficult",
        },
        {
          id: "head",
          kind: "physical",
          fact: "The locked mini-fridge holds good vodka and a preserved human head — Kenneth Dahl, Barbara's late husband.",
          skill: "perception",
          difficulty: "Professional",
        },
        {
          id: "huntver_is_ruthven",
          kind: "deception",
          fact: "Professor Huntver is Lord Ruthven. The man the campus has been mailing about a thesis is the one taking the women.",
          skill: "deduction",
          difficulty: "Difficult",
          // The costume and the head, not the photograph. Those two are what
          // make the man the monster; the photograph is why, and a motive on
          // its own convicts nobody.
          needs: ["costume", "head"],
        },
      ],
      playerBrief:
        "Professor Huntver's office, fourth floor of the social sciences building. He has not answered mail in weeks, and the door is locked.",
      checks: [
        {
          skill: "Pick Lock",
          dv: 9,
          note: "The office door (or DV13 Athletics to bust it; automatic with a Melee Weapon).",
        },
        // A check's note goes to the model with the brief, so these said what
        // searching the room WOULD FIND — the photograph, the costume, the head
        // — which is the leak the truths above exist to close. What is here to
        // find is the engine's to say; a note's job is to name the place a
        // character can put their hands.
        { skill: "Perception", dv: 9, note: "The desk and what is standing on it." },
        { skill: "Perception", dv: 13, note: "The closet, behind the academic regalia." },
        {
          skill: "Perception",
          dv: 13,
          note: "The locked mini-fridge (DV13 Athletics / DV9 Pick Lock to open it).",
        },
        {
          skill: "Criminology",
          dv: 13,
          note: "Putting a name to what the room turns up (Library Search or Streetwise also work).",
        },
      ],
      exits: [
        {
          to: "darkness_and_light",
          label: "Take what you've learned to the Vampyres",
          sets: ["knows_ruthven"],
        },
        {
          to: "monster_hunt",
          label: "Skip the theatrics — go straight for Ruthven",
          sets: ["knows_ruthven"],
        },
      ],
    },
    {
      id: "darkness_and_light",
      type: "cliff",
      title: "Darkness and Light",
      page: 11,
      gmBrief:
        "The Crew returns to the Symphony Hall and is received warmly — cherry-red drinks, tasteless cookies, blown kisses — and led to The Master, a flawless Bela Lugosi replica. He confesses the truth: Lord Ruthven funded the Vampyres' rebirth after the war but has since gone cyberpsycho and become a true monster, beyond their control. He sanctions the kill, hands over Ruthven's lair location — the Union Chapel Building, just across the border in South Night City — and a wooden stake. Do it right and earn the Vampyres' favor.",
      playerBrief:
        "You're back in the Symphony Hall as a guest, not an intruder, being walked toward The Master. The Vampyres want to talk about whatever has been taking women off their campus.",
      exits: [
        {
          to: "monster_hunt",
          label: "Head to the Union Chapel to end Ruthven",
          sets: ["has_stake", "knows_lair"],
        },
      ],
    },
    {
      id: "monster_hunt",
      type: "climax",
      title: "Monster Hunt",
      page: 12,
      encounter: true,
      gmBrief:
        "The Union Chapel squats on the Combat Zone border, its open door lit by a flickering neon 'Open' sign like a mouth waiting to be fed. Inside is a charnel house — a carpet of stitched human skin, skinless bodies seated at rotting tables, cybered heads guttering red wax on the bar. Surviving lieutenants (the Monk and/or the Clown) and their mooks guard the way, backed by automated turrets (NET Architecture, Floor DV8). Then Lord Ruthven himself — black medical uniform, hooded cloak, jagged metal fangs — attacks to the death: 'Witness my supremacy, vermin!' There is a tapestry on the far wall. Do not say what is behind it.",
      truths: [
        {
          id: "behind_the_tapestry",
          kind: "physical",
          fact: "Behind the tapestry: a medical pod holding six women biosculpted to resemble Barbara Dahl. Only Lucy Rhinemeyer is still alive.",
          skill: "perception",
          difficulty: "Everyday",
          // Whatever else happens, a Crew that clears this room finds her. The
          // job cannot end with Lucy undiscovered because nobody rolled.
          revealedAt: "epilogue",
        },
      ],
      playerBrief:
        "The Union Chapel Building on the Combat Zone border, door propped open under a flickering neon OPEN sign. Lord Ruthven is inside, and so — if anyone is still breathing — is Lucy.",
      opposition: [
        "The Monk and the Clown (surviving lieutenants)",
        "Bozo and Inquisitor Mooks (count = crew size − 2)",
        "Automated Turrets (NET Architecture)",
        "Lord Ruthven (cyberpsycho, pg. 17)",
      ],
      // Clearing this room IS recovering her: `behind_the_tapestry` is revealed
      // at the epilogue precisely so the job cannot end with Lucy undiscovered
      // because nobody rolled, and the objective closes on the same guarantee.
      exits: [
        {
          to: "epilogue",
          label: "Cut down Ruthven and free the survivor",
          completes: ["recover_lucy"],
        },
      ],
    },
    {
      id: "epilogue",
      type: "resolution",
      title: "Epilogue",
      page: 14,
      gmBrief:
        "With therapy, Lucy Rhinemeyer will live a full life again. The other six women are returned to their families; Rocklin Augmentics pays for postmortem biosculpting so they can be buried with their own faces. The Crew is paid the remainder of their wages. If they staked Ruthven through the heart — or did something equally dramatic, like taking his head — they've earned a favor with the Philharmonic Vampyres. The curtain falls on Night City. Lock your doors.",
      playerBrief: "It's over. Time to settle up, and to see what the night cost you.",
      exits: [],
    },
  ],
};
