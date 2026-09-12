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
  patron: "George Edward Rhinemeyer (Rocklin Augmentics) — hiring through a representative",
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
        },
      ],
      playerBrief:
        "Seven women have vanished from the University District in four weeks. The latest is Lucy Rhinemeyer, 19. Her father's representative is offering 2,000eb per head, 500 up front, to bring her back — in whatever state you find her.",
      objectives: ["Recover Lucy Rhinemeyer"],
      exits: [{ to: "hook", label: "Take the job" }],
    },
    {
      id: "hook",
      type: "hook",
      title: "The Hook",
      page: 6,
      gmBrief:
        "NCPD and Campus Security both like the Philharmonic Vampyres for this and neither can move on them on their own turf. The patron's task is plain: get inside one of the Vampyres' parties and investigate from there.",
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
      exits: [{ to: "getting_tickets", label: "Find a way into the Vampyres' party" }],
    },
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
      ],
      playerBrief:
        "You're in line outside the Symphony Hall after sundown. Nobody checks for weapons. Inside is a staging of Dracula with real teeth behind the theatre — and plenty to notice if you're watching.",
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
      exits: [{ to: "epilogue", label: "Cut down Ruthven and free the survivor" }],
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
