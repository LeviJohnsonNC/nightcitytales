/**
 * UI copy ONLY. Nothing here is a Cyberpunk RED rules value: every number a
 * player acts on is read from /src/data/rules/. These strings are orientation
 * text for the wizard, written in the house voice (see src/lib/prose-style.ts).
 */
import type { CreationMethod } from "@/engine";

export type MethodCopy = {
  id: CreationMethod;
  /** What the choice is, in plain words. The rulebook's name sits under it. */
  plain: string;
  headline: string;
  body: string;
  choice: string;
  time: string;
  /** How much the player decides, 1 (fewest choices) to 3 (every choice). */
  level: 1 | 2 | 3;
  /** What happens to each of the three things a method decides, in plain words. */
  decides: { body: string; skills: string; gear: string };
};

export const METHOD_COPY: MethodCopy[] = [
  {
    id: "streetrat",
    plain: "Fast lane",
    headline: "One roll for your body. Your Role hands you the skills and the kit.",
    body: "One roll of 1d10 hands you a whole pre-built STAT row, no haggling, and the house gives you a reroll if you hate it. Your Skills come set for your Role, and so do your guns, armor and chrome, with a few picks along the way. You still walk the full Lifepath, and you still pocket 500eb to spend however you please.",
    choice: "Low",
    time: "~5 minutes",
    level: 1,
    decides: { body: "One roll", skills: "Set for your Role", gear: "Your Role's kit, and cash" },
  },
  {
    id: "edgerunner",
    plain: "Roll the dice",
    headline: "Let fate hand you your body. You decide what you learned to do with it.",
    body: "You roll 1d10 per STAT against your Role's table and live with what the dice give you, bar the one reroll the house allows. The Skills are yours, though: 86 points to spread across your Role's 20 Skills however you see fit. Your gear comes set for your Role, with a few picks, plus 500eb in your pocket.",
    choice: "Medium",
    time: "~15 minutes",
    level: 2,
    decides: {
      body: "Rolled, one by one",
      skills: "You choose",
      gear: "Your Role's kit, and cash",
    },
  },
  {
    id: "complete_package",
    plain: "Full control",
    headline: "Every number is yours. Build exactly the person you can already see.",
    body: "62 points to buy your STATs, 86 Skill Points for any Skills you like, and 2,550eb to work the Night Market yourself. On top of that, 800eb that only burns on Fashion and Fashionware, because looking good is part of the job.",
    choice: "Total",
    time: "~40 minutes",
    level: 3,
    decides: { body: "You set it", skills: "You choose", gear: "You shop for all of it" },
  },
];

/** Playstyle line per Role, in the house voice. Flavor guidance, not mechanics. */
export const ROLE_PLAYS_LIKE: Record<string, string> = {
  rockerboy:
    "Plays like: the crowd is your weapon. Talk, play, and turn a room full of strangers into your movement.",
  solo: "Plays like: the one who walks out. You read the fight before it starts and end it before it's fair.",
  netrunner:
    "Plays like: a second game inside the game. You jack into the NET while the crew holds the meat world.",
  tech: "Plays like: the one who makes the broken work. Build it, fix it, upgrade it past what the manual allows.",
  medtech:
    "Plays like: the reason the crew comes home. You put bodies back together mid-job, no questions asked.",
  media:
    "Plays like: the truth as a crowbar. You dig up what the Corps bury and put it on every screen in the city.",
  exec: "Plays like: running the corporation instead of robbing it. Money, staff, and favors do your fighting.",
  lawman:
    "Plays like: the badge in a city that eats badges. Authority, backup, and calls nobody else will make.",
  fixer:
    "Plays like: the number everyone has saved. Deals, contacts, and getting hold of the impossible for a cut.",
  nomad:
    "Plays like: wheels, family, and open road. You move the crew and the cargo, and you always know the way out.",
};

/**
 * The hook on a Role's tile, in the player's own second person.
 *
 * Six or seven words, because the grid has to start persuading before anybody
 * clicks. Deliberately not the tagline: `roles.json` carries the book's own
 * third-person line ("Rockerboys are street poets…"), which is an encyclopedia
 * entry, and an encyclopedia entry has never made anybody want to be something.
 * The book's text is still on the page, below the fold, where somebody already
 * sold wants to sink into it.
 */
export const ROLE_HOOK: Record<string, string> = {
  rockerboy: "Turn a crowd into a movement.",
  solo: "Be the one who walks out.",
  netrunner: "Hear what is running inside the walls.",
  tech: "Build what the city will not sell you.",
  medtech: "Be the reason the crew comes home.",
  media: "Print what they paid to bury.",
  exec: "Have money and people do the fighting.",
  lawman: "Hold a line nobody thanks you for.",
  fixer: "Be the number everyone has saved.",
  nomad: "Always know the way out.",
};

/**
 * "On your first night": what each Role is like to BE, told as a scene rather
 * than a rule. No Rank, no dice, no STATs — a player deciding who to be wants
 * the feeling first. The numbers are not dropped: they are `roleOpening` in
 * the engine, computed from the functions play runs on, and the Role page
 * shows them under "Read the printed rule".
 *
 * Every beat is a promise the game keeps. Each one names, in the comment
 * beside it, what in the engine makes it true; if that changes, this does.
 */
export type FirstNightBeat = { title: string; body: string };

export const ROLE_FIRST_NIGHT: Record<string, FirstNightBeat[]> = {
  rockerboy: [
    // Charismatic Impact against a crowd (engine/roleAbility.ts, CHARISMATIC_AUDIENCES).
    {
      title: "The room turns.",
      body: "You step up onto a crate outside a shuttered club and forty strangers stop scrolling. You don't need a gun when a crowd will do the shoving for you.",
    },
    // charismaticFavor: a fan won over owes a real favour.
    {
      title: "One person, won over.",
      body: "The guard, the bartender, the scared kid with the keys. Win one of them and they owe you something real: a door left unlocked, your name said in the right ear.",
    },
    {
      title: "Your face opens doors.",
      body: "Half the city has heard your songs. The other half has heard about you. Both let you in.",
    },
  ],
  solo: [
    // Threat Detection.
    {
      title: "You saw it from the door.",
      body: "Two men by the noodle cart, one hand in a pocket. You already know which one moves first.",
    },
    // Initiative Reaction + Spot Weakness.
    {
      title: "It starts on your time.",
      body: "When it goes loud, you are already moving, and your first shot is already where it needs to be.",
    },
    // Damage Deflection.
    {
      title: "The first one that finds you hurts less.",
      body: "You have been hit before. You have learned exactly how to take it, and how to keep walking.",
    },
  ],
  netrunner: [
    // Unbuilt: roleOpening.netrunner.unbuilt.
    {
      title: "Not tonight.",
      body: "The NET is getting its own update. Everything else about a Netrunner works, but jacking in does not yet. Pick another Role for now, and come back when the wires are live.",
    },
  ],
  tech: [
    // Field Expertise: repairs.
    {
      title: "It's broken. Good.",
      body: "A jammed pistol, a lock that sparked dead, a drone that fell out of the sky. Everyone else sees junk. You see an evening's work.",
    },
    // planFabrication: materials at a fraction of the price, a week of bench time.
    {
      title: "What the city won't sell you, you build.",
      body: "A blade nobody stocks, a part nobody makes any more. Give you the scrap and a week at the bench and it's yours, for a fifth of what it costs across a counter.",
    },
    // A failed build costs the time, never the materials.
    {
      title: "Failure is just Tuesday.",
      body: "When a build goes wrong you lose the week, not the parts. They're still on the bench in the morning. Try again.",
    },
  ],
  medtech: [
    {
      title: "Somebody is bleeding out on a bar floor.",
      body: "Everyone is shouting. You're already kneeling, gloves on, counting.",
    },
    // Pharmaceuticals: Speedheal.
    {
      title: "Your own pharmacy.",
      body: "The good drugs aren't sold in Night City. You make them, and one dose of what you cook puts a friend back on their feet.",
    },
    {
      title: "Back on the street first.",
      body: "You patch yourself better than anyone patches you. You're up and working while the rest of the crew is still healing.",
    },
  ],
  media: [
    {
      title: "Somebody paid to bury this.",
      body: "You found it anyway: the file, the witness, the photo nobody was meant to see. Now you decide who reads it.",
    },
    // storyImpactFor: a proven story sets a faction back.
    {
      title: "Print it, and it costs them.",
      body: "Prove it and publish, and whatever they were building against you slows to a crawl. The local ones lose their jobs. Sometimes they lose their freedom.",
    },
    // Evidence is counted from discovered truths, never typed in.
    {
      title: "They'll know it was you.",
      body: "Every organisation that runs this city reads the feeds. Your byline is a weapon, and it has your name on it.",
    },
  ],
  exec: [
    // Team Members.
    {
      title: "You don't do it yourself.",
      body: "Somebody on your payroll does the thing you would otherwise have to. They have opinions about it. You pay them not to share them.",
    },
    // Corporate housing.
    {
      title: "The company keeps a roof over you.",
      body: "Rent is somebody else's problem, which in Night City is most of a salary.",
    },
    {
      title: "Your name still opens doors.",
      body: "Not every door, and never the same one twice. Spend it carefully.",
    },
  ],
  lawman: [
    // Backup: a call that can fail (roll under Rank).
    {
      title: "Shots fired. You call it in.",
      body: "If the dispatcher comes through, four armed officers are on their way, and they shoot at whoever is shooting at you. Tonight, they might even be on time.",
    },
    {
      title: "Run the plate.",
      body: "A name, a face, a licence plate. You can check any of them against what the file holds, and the file holds a lot.",
    },
    {
      title: "The badge does half the work.",
      body: "Most of this city is more afraid of paperwork than of a fight. You carry the paperwork.",
    },
  ],
  fixer: [
    // Reach: a price category always sourceable.
    {
      title: "Three calls.",
      body: "Whatever they need, you know someone who has it. Short of the truly exotic, it's never a question of whether. Only of when, and what it costs them.",
    },
    // hagglePercent.
    {
      title: "Nobody pays the first price.",
      body: "The first number a seller says is never the one you pay. They know it. You know it. You both enjoy the dance.",
    },
    {
      title: "Everyone owes you.",
      body: "Favours are a currency in this city, and you're the only one in the room keeping the ledger.",
    },
  ],
  nomad: [
    // motorpoolFor: the first vehicle, parked.
    {
      title: "Your car's outside.",
      body: "Right where you left it, keys in your pocket. You cross Night City faster than any cab, and you never wait on a corner hoping one comes.",
    },
    // The rest of the Family Motorpool, one out at a time.
    {
      title: "The Family has more.",
      body: "A bike, a boat, a gyrocopter that doesn't care about bridges. Call for it tonight and the Family has it waiting for you in the morning.",
    },
    {
      title: "You always know the way out.",
      body: "Which is the difference between a bad night and a story you get to tell.",
    },
  ],
};
