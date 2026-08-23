/**
 * "A Night at the Opera" — the opening Tale from Tales from the RED (pg. 5-14),
 * transcribed into a beat graph. The book's own recommended starter: an
 * investigation in the University District that ends in a cyberpsycho showdown.
 *
 * Faithful to the printed Beat Chart. GM briefs summarize each beat for the AI
 * to narrate; DVs are copied from the source and set in advance. The player is a
 * single Edgerunner (solo-scaling applies to the combat beats per the plan).
 */
import type { Mission } from "../mission";

export const NIGHT_AT_THE_OPERA: Mission = {
  id: "night-at-the-opera",
  title: "A Night at the Opera",
  subtitle: "Darkness and Desire in Night City",
  source: "Tales from the RED: Street Stories, pg. 5-14",
  patron: "George Edward Rhinemeyer (Rocklin Augmentics) — via a Philharmonic Vampyre intermediary",
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
        "Net 54 Crimewatchers: a string of missing persons across the University District claims its latest victim — Lucy Rhinemeyer, 19, daughter of Rocklin Augmentics Executive Engineer George Edward Rhinemeyer. Seven women gone in four weeks; NCPD has no leads. Early the next morning, a message arrives from Mr. Rhinemeyer's representative offering 2,000eb per head — 500 up front — to recover Lucy, in whatever state you find her.",
      gmBrief:
        "Set the neon-noir tone. The job looks like a straightforward recovery for a grieving Exec. It is not: the Edgerunner is a pawn in a scheme by The Master, a Philharmonic Vampyre leader, to quietly deal with one of their own.",
      objectives: ["Recover Lucy Rhinemeyer"],
      exits: [{ to: "hook", label: "Take the job" }],
    },
    {
      id: "hook",
      type: "hook",
      title: "The Hook",
      page: 6,
      gmBrief:
        "Rhinemeyer is bankrolling (bribing) NCPD to prioritize his daughter's case, but the cops are swamped with gang activity and can't move on the prime suspects — the Philharmonic Vampyres — on their own turf. Campus Security suspects the Vampyres but can't act. The patron's task: get into one of the Vampyres' parties and investigate from the inside.",
      exits: [{ to: "getting_tickets", label: "Find a way into the Vampyres' party" }],
    },
    {
      id: "getting_tickets",
      type: "dev",
      title: "Getting Tickets",
      page: 7,
      gmBrief:
        "A garish poster advertises 'A Night at the Opera with the Philharmonic Vampyres' at the old Night City Symphony Hall, just off campus — tomorrow night, tickets via Garden Patch, dress code 'Old World meets New World: Drama, Sensuality, Black Velvet, Danger.' Six students at the bus stop gossip: the shows are theatrical (and notoriously debauched), and the missing women have everyone on edge. One student gripes that their psychology thesis advisor has gone silent and stopped answering mail — a thread worth pulling.",
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
        "Just after sundown, a line forms outside the symphony hall; a battered Campus Security aerodyne is parked out front. A top-hatted, ghost-white host barks invitations while burlesque dancers writhe. No one checks for weapons. Inside, a futuristic staging of Dracula unfolds — style, swagger, and menace. Watch for what's off beneath the spectacle.",
      checks: [
        {
          skill: "Perception",
          dv: 9,
          note: "The two Campus Security officers out front have Vampyres cyberware installed.",
        },
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
      exits: [{ to: "darkness_and_light", label: "Go to the meeting the note arranges" }],
    },
    {
      id: "empty_office_hours",
      type: "opdev",
      title: "Empty Office Hours (optional)",
      page: 11,
      gmBrief:
        "Professor Huntver's office, fourth floor of the social sciences building. The evidence, if searched, is damning: a kissed photo of Network 54 anchor Barbara Dahl; a bloodstained clown costume and Inquisitor uniform hidden behind academic regalia; a locked mini-fridge holding good vodka and a preserved human head — the late Kenneth Dahl, Barbara's husband. Huntver is Lord Ruthven. Learning this can send the Crew straight at Ruthven, or to the Vampyres first.",
      checks: [
        {
          skill: "Pick Lock",
          dv: 9,
          note: "The office door (or DV13 Athletics to bust it; automatic with a Melee Weapon).",
        },
        {
          skill: "Perception",
          dv: 9,
          note: "Desk: a photo of Barbara Dahl, kissed in faded red lipstick.",
        },
        {
          skill: "Perception",
          dv: 13,
          note: "Closet: a bloodstained clown costume and Inquisitor uniform.",
        },
        {
          skill: "Perception",
          dv: 13,
          note: "Desk: a locked mini-fridge (DV13 Athletics / DV9 Pick Lock) hiding a preserved human head.",
        },
        {
          skill: "Criminology",
          dv: 13,
          note: "The head is Kenneth Dahl, Barbara Dahl's late husband (Library Search or Streetwise also work).",
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
        "The Union Chapel squats on the Combat Zone border, its open door lit by a flickering neon 'Open' sign like a mouth waiting to be fed. Inside is a charnel house — a carpet of stitched human skin, skinless bodies seated at rotting tables, cybered heads guttering red wax on the bar. Surviving lieutenants (the Monk and/or the Clown) and their mooks guard the way, backed by automated turrets (NET Architecture, Floor DV8). Then Lord Ruthven himself — black medical uniform, hooded cloak, jagged metal fangs — attacks to the death: 'Witness my supremacy, vermin!' Behind the tapestry: a medical pod of six women biosculpted to resemble Barbara Dahl. Only Lucy Rhinemeyer still lives.",
      opposition: [
        "The Monk and the Clown (surviving lieutenants)",
        "Bozo and Inquisitor Mooks (count = crew size − 2)",
        "Automated Turrets (NET Architecture)",
        "Lord Ruthven (cyberpsycho, pg. 17)",
      ],
      exits: [{ to: "epilogue", label: "Cut down Ruthven and free the survivor" }],
    },
    {
      id: "epilogue",
      type: "resolution",
      title: "Epilogue",
      page: 14,
      gmBrief:
        "With therapy, Lucy Rhinemeyer will live a full life again. The other six women are returned to their families; Rocklin Augmentics pays for postmortem biosculpting so they can be buried with their own faces. The Crew is paid the remainder of their wages. If they staked Ruthven through the heart — or did something equally dramatic, like taking his head — they've earned a favor with the Philharmonic Vampyres. The curtain falls on Night City. Lock your doors.",
      exits: [],
    },
  ],
};
