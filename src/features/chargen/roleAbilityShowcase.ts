/**
 * The Role Ability, sold.
 *
 * The Role page named the ability and stopped there: a word on the right of a
 * row, and behind a link at the bottom, 2,000 characters of rank table. This is
 * what opens when that word is clicked — the pitch, one moment of it working,
 * and the ladder from Rank 1 to Rank 10 with where you start lit.
 *
 * Copy, not rules. Every tier restates the printed rule in `roles.json` beside
 * this Role (the `mechanicalText` is the source of truth, and the modal links
 * to it); the figures a player can count on during their first night come from
 * `roleOpening` in the engine, not from here. Each `moment` is pitched at the
 * starting Rank, so nothing in it is something the character cannot yet do.
 */
export type AbilityTier = {
  /** The Rank this arrives at. */
  rank: number;
  title: string;
  body: string;
};

export type AbilityShowcase = {
  /** The one line that should make somebody want it. */
  pitch: string;
  /** The ability working, as a scene, at the starting Rank. */
  moment: string;
  /** Ascending by Rank. */
  tiers: AbilityTier[];
};

export const ROLE_ABILITY_SHOWCASE: Record<string, AbilityShowcase> = {
  rockerboy: {
    pitch: "Your fans will do anything you ask. The bigger you get, the more “anything” means.",
    moment:
      "The bouncer says the club is full. You start singing on the sidewalk. By the second chorus the line is chanting your name, and the bouncer is the one holding the door.",
    tiers: [
      { rank: 1, title: "Small local clubs", body: "A fan buys you a drink, gives you a lift." },
      {
        rank: 3,
        title: "Well-known clubs",
        body: "One fan puts their name on the line for you. A local following buys every recording.",
      },
      {
        rank: 5,
        title: "The big rooms",
        body: "A fan will shoplift or swing in a fight for you. A small crew becomes your posse.",
      },
      {
        rank: 7,
        title: "Concert halls, the local feed",
        body: "A single fan risks their life without asking why. Your crowd fights rival fans.",
      },
      {
        rank: 9,
        title: "The national feed",
        body: "Fans commit major crimes on your word. Crowds riot, and they do not stop.",
      },
      {
        rank: 10,
        title: "Stadiums. The world.",
        body: "A worldwide following. A private army built on nothing but your voice.",
      },
    ],
  },
  solo: {
    pitch: "Before the first shot you spend your edge: faster, harder to hurt, impossible to miss.",
    moment:
      "The door comes off its hinges and you already know where everyone in the room will be in three seconds. You have decided who goes first. They have not decided anything yet.",
    tiers: [
      {
        rank: 1,
        title: "Reflexes on demand",
        body: "Every point is +1 to Initiative or +1 to spot the ambush. Reassign them any time.",
      },
      { rank: 2, title: "Roll with it", body: "Take 1 less damage from the first hit each Round." },
      { rank: 3, title: "Precision", body: "+1 to every attack you make." },
      {
        rank: 4,
        title: "No more fumbles",
        body: "Natural 1s stop being disasters when you shoot. Or stack the points into damage.",
      },
      {
        rank: 6,
        title: "+2 to hit",
        body: "Or shrug off 3 damage a Round. Your call, every fight.",
      },
      { rank: 9, title: "+3 to hit", body: "The best shot in any room you walk into." },
      {
        rank: 10,
        title: "Untouchable",
        body: "Ten points to split: deflect 5 damage a Round, or wreck the first target you hit.",
      },
    ],
  },
  netrunner: {
    pitch: "Every locked door in Night City is a wall of code. You walk through walls.",
    moment:
      "The crew is pinned behind a car. You are in a stairwell with your eyes closed, walking the building's guts. One thought and every turret on the floor turns around.",
    tiers: [
      {
        rank: 1,
        title: "The whole toolkit",
        body: "Backdoor, Cloak, Control, Eye-Dee, Pathfinder, Scanner, Slide, Virus, Zap. Two NET Actions a Turn.",
      },
      {
        rank: 4,
        title: "Three NET Actions",
        body: "More moves in the Net than anyone has in meat.",
      },
      {
        rank: 7,
        title: "Four NET Actions",
        body: "You clear an Architecture before the ICE wakes up.",
      },
      { rank: 10, title: "Five NET Actions", body: "A legend. Black ICE checks the logs for you." },
    ],
  },
  tech: {
    pitch:
      "If it exists, you can fix it, improve it, or build it from scrap. If it doesn't, you invent it.",
    moment:
      "The AV's engine dies at forty metres. You have a multitool, a roll of tape and ninety seconds. It flies. It should not. It does.",
    tiers: [
      {
        rank: 1,
        title: "Field Expertise",
        body: "Jury-rig anything back to perfect as an Action. It holds long enough to matter.",
      },
      {
        rank: 1,
        title: "Upgrade Expertise",
        body: "Make a pistol concealable, add armor, raise gear to Excellent quality.",
      },
      {
        rank: 1,
        title: "Fabrication Expertise",
        body: "Build gear from materials one price category cheaper than the street sells it.",
      },
      {
        rank: 1,
        title: "Invention Expertise",
        body: "Describe something that doesn't exist yet. Then build it.",
      },
      {
        rank: 4,
        title: "Eight Specialty Ranks",
        body: "Every Rank adds one to two Specialties. You start with eight to spread.",
      },
      {
        rank: 10,
        title: "Twenty Specialty Ranks",
        body: "Luxury-grade work on your own bench. Things nobody else in the city can make.",
      },
    ],
  },
  medtech: {
    pitch: "Death is a deadline, and you keep moving it.",
    moment:
      "Your Solo is bleeding out in the back of a van doing ninety. One hand on the wound, the other on a syringe you cooked yourself last night. They will walk off this job.",
    tiers: [
      {
        rank: 1,
        title: "Pick your medicine",
        body: "Each Rank is a point: two levels of Surgery, a drug you can cook, or cryo gear.",
      },
      {
        rank: 2,
        title: "Speedheal and Stim",
        body: "Two drugs you cook yourself: heal a body in one dose, or ignore wounds for an hour.",
      },
      {
        rank: 3,
        title: "A cryotank of your own",
        body: "Installed in a room you choose. Somebody's death gets put on hold.",
      },
      {
        rank: 5,
        title: "The whole pharmacy",
        body: "Antibiotic, Rapidetox, Speedheal, Stim, Surge — or Surgery deep enough to install chrome.",
      },
      {
        rank: 10,
        title: "Miracle worker",
        body: "Surgery at its ceiling and a ward of cryotanks. The crew stops being afraid of dying.",
      },
    ],
  },
  media: {
    pitch: "The truth is a weapon only you can aim, and enough of it can topple a corporation.",
    moment:
      "One clip. Thirty seconds of a Militech VP saying the quiet part. You hit publish and watch the whole neighbourhood find out at once.",
    tiers: [
      {
        rank: 1,
        title: "The neighbourhood listens",
        body: "Rumours find you twice a week. Local gang bosses take your calls.",
      },
      {
        rank: 3,
        title: "A known local voice",
        body: "Minor politicians and Corp Execs answer. Your stories get bad guys arrested.",
      },
      {
        rank: 5,
        title: "Citywide",
        body: "Major players return your calls. Your stories change the city. Laws get passed.",
      },
      {
        rank: 7,
        title: "Statewide",
        body: "Mayors and Corp presidents. Mid-size corporations fall when you publish.",
      },
      { rank: 9, title: "National", body: "Large corporations and governments can be toppled." },
      {
        rank: 10,
        title: "The world is watching",
        body: "World leaders and Megacorp heads. Your story can bring down a Megacorp.",
      },
    ],
  },
  exec: {
    pitch: "You don't fight. You hire people who fight, and the Corp pays for the house.",
    moment:
      "Nobody on your side draws a gun. You make one call, and the bodyguard on your payroll makes the problem go away before your coffee is cold.",
    tiers: [
      {
        rank: 1,
        title: "Signing bonus",
        body: "A full Businesswear suit that marks you as the elite on sight.",
      },
      {
        rank: 2,
        title: "Corporate housing",
        body: "A Company Conapt, rent-free for as long as you stay with the Corp.",
      },
      {
        rank: 3,
        title: "Your first hire",
        body: "A Team Member — bodyguard, driver, netrunner, technician — loyal while you treat them right.",
      },
      { rank: 5, title: "A second hire", body: "Now you have a team, not an assistant." },
      {
        rank: 6,
        title: "Trauma Team Silver",
        body: "If you go down, an armed AV comes for you. The Corp pays the premium.",
      },
      { rank: 7, title: "A house in Beaverville", body: "The Executive Zone. Lawns. Guards." },
      { rank: 8, title: "Trauma Team Executive", body: "The top tier. They come faster." },
      { rank: 9, title: "A third hire", body: "A full crew that answers to you." },
      {
        rank: 10,
        title: "The penthouse",
        body: "A McMansion or a luxury penthouse. You are the Corp now.",
      },
    ],
  },
  lawman: {
    pitch: "Call it in, and the law comes running — with guns.",
    moment:
      "Six gangers corner you in a parking garage. You key your radio. Seconds later two patrol cars scream down the ramp and suddenly they are the ones who are cornered.",
    tiers: [
      { rank: 1, title: "Corporate Security", body: "Four renta-cops on foot with heavy pistols." },
      {
        rank: 3,
        title: "Beat Cops",
        body: "Four officers in two patrol cars, armored and armed.",
      },
      {
        rank: 5,
        title: "Sheriff's Department",
        body: "County Mounties in a pursuit car with assault rifles and heavy armorjack.",
      },
      {
        rank: 8,
        title: "Recovery Zone Marshal",
        body: "One marshal on a superbike with a grenade launcher. One is enough.",
      },
      {
        rank: 9,
        title: "C-SWAT",
        body: "A Psycho Squad in Metalgear with rocket launchers, dropped from an AV-4.",
      },
      {
        rank: 10,
        title: "Netwatch. Interpol. The Feds.",
        body: "Two of them arrive. They stay on the case until it closes.",
      },
    ],
  },
  fixer: {
    pitch: "Anything can be bought. You know who's selling.",
    moment:
      "Nobody in the city can find the thing your client needs this week. You have it by Thursday, at a price the seller thinks was their idea.",
    tiers: [
      {
        rank: 1,
        title: "The neighbourhood",
        body: "Cheap and everyday goods, always. Haggle 10% either way. Local gangs know your face.",
      },
      {
        rank: 3,
        title: "Up to Expensive",
        body: "Buy five, get one free. Another culture and its language on the street.",
      },
      {
        rank: 5,
        title: "The Night Market",
        body: "Once a month, gather the city's fixers and source anything at all. Job pay up 20%.",
      },
      {
        rank: 7,
        title: "Very Expensive",
        body: "Pay half now, half in a month. Mayors and Corp presidents take meetings.",
      },
      {
        rank: 9,
        title: "The Midnight Market",
        body: "A market inside the market. Haggle 20%. You pass inside Corp and government halls.",
      },
      {
        rank: 10,
        title: "Anything. Anyone.",
        body: "Any item, any time. Double the pay on dangerous jobs. Even secret societies let you in.",
      },
    ],
  },
  nomad: {
    pitch: "Your family owns a motorpool, and you drive anything in it better than anyone alive.",
    moment:
      "The checkpoint slams shut. You take the dry riverbed at a hundred and forty with the lights off. Your family taught you that road when you were nine.",
    tiers: [
      {
        rank: 1,
        title: "Born behind the wheel",
        body: "Your Rank on every drive, pilot and vehicle-tech roll. Car, bike, gyro or jetski from the Family.",
      },
      {
        rank: 5,
        title: "Helicopters and speedboats",
        body: "A high-performance groundcar, a helicopter or a speedboat joins the motorpool.",
      },
      {
        rank: 7,
        title: "An AV-4",
        body: "Or a superbike, or a cabin cruiser. You fly over the walls.",
      },
      {
        rank: 9,
        title: "Aerozeps and yachts",
        body: "An AV-9, a super groundcar, an airship. The family's best.",
      },
      {
        rank: 10,
        title: "You lead the Family",
        body: "Every Family vehicle out at once. The convoy moves when you say.",
      },
    ],
  },
};
