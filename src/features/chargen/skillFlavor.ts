/**
 * In-voice skill descriptions, written in the Night City house style
 * (see src/lib/prose-style.ts). Each blurb is grounded in the skill's accurate
 * mechanical description from skills.json; this adds attitude, not new rules.
 * The info modal shows this flavor alongside the exact mechanical text.
 *
 * Keyed by skill id. A skill with no entry here falls back to its mechanical
 * description alone.
 */
export const SKILL_FLAVOR: Record<string, string> = {
  concentration: `Focus is a weapon when the whole city is screaming at you. Concentration is memory, recall, and shutting out distractions long enough to actually think. The runners who can hold a thought under fire are the ones who remember where the exit was.`,

  conceal_reveal_object: `Everybody in Night City is carrying something they shouldn't be. This is the skill of tucking a piece under your jacket, and of clocking the bulge when the other guy tries the same trick. Pat-downs are for amateurs.`,

  lip_reading: `Two suits arguing behind soundproof glass across the club? You don't need the audio. Lip Reading pulls the words straight off their mouths. Half of Media work is knowing what people said when they were sure nobody was listening.`,

  perception: `The city hides things: clues, traps, a Solo folded into the shadow of a dumpster. Perception is spotting them before they spot you. It finds people using Stealth, but a weapon hidden under a coat is a different game, that one's Conceal/Reveal.`,

  tracking: `Somebody ran. You follow. Tracking reads the trail, the scuffs, the dropped wrapper, the blood, and tells you where they went. Works on scavvers in the Badlands and marks in the megabuildings alike.`,

  athletics: `Jump the gap, climb the fence, swim the canal, haul the body. Athletics is raw physical competence, the difference between clearing the rooftop and eating twelve stories of concrete. Boring until the exact second it saves your life.`,

  contortionist: `Cuffs, zip ties, a maintenance duct built for a drone. Contortionist folds you out of bindings and into spaces you have no business fitting into. Every good escape story starts with somebody who could bend.`,

  dance: `Not shuffling at a club. Professional-grade movement, the kind that puts you on a stage, into a braindance, or close enough to a mark to matter. In this town, looking good in motion is its own currency.`,

  endurance: `The Time of the Red is cold, poisoned, and long. Endurance is your body flatly refusing to quit through heat, frost, hunger, and the miles. Solos and Nomads live on it.`,

  resist_torture_drugs: `Sooner or later somebody wants what's in your head, and they won't ask nicely. This is keeping your mouth shut through pain, interrogation, and whatever they push into your veins. Everyone talks eventually. You just talk later.`,

  stealth: `Move quiet, hide, do the thing before anyone clocks you. Stealth is the whole ballgame for infiltration, and the other guy's Perception is the only thing in your way. Loud is easy. Quiet gets paid.`,

  drive_land_vehicle: `Wheels on the ground, foot on the floor. Drive Land Vehicle is groundcars, bikes, kombis, anything that grips asphalt. In a city built on chases and cargo runs, a good wheelman never buys their own drinks.`,

  pilot_air_vehicle: `AVs, gyros, anything that leaves the ground. Flying is expensive to learn and expensive to crash, which is why it costs double. Get it right and you skip every checkpoint in the city.`,

  pilot_sea_vehicle: `The coast and the Bay are their own kind of Badlands. Pilot Sea Vehicle runs boats, skiffs, and subs, moving people and product past eyes that only ever watch the roads.`,

  riding: `Fuel is not a given out past the city limits. Riding is handling a living mount when the engines quit and the road runs out. Old skill, new apocalypse.`,

  accounting: `Money leaves a trail, and Accounting is how you read it, cook it, or catch somebody else cooking it. Budgets, false books, the day-to-day math of a running operation. Fixers love a runner who can spot a skimmed ledger.`,

  animal_handling: `Guard dogs, pack animals, whatever a Nomad family keeps out in the dust. Animal Handling trains them, calms them, and keeps them working. Cheaper than a drone and twice as loyal, mostly.`,

  bureaucracy: `Every wall in Night City has a clerk in front of it. Bureaucracy is knowing which clerk, which form, which line, and how to squeeze a straight answer out of an agency built to give you nothing. Slower than a gun. Quieter, too.`,

  business: `Supply, demand, payroll, procurement, the machinery under every gig. Business is knowing how the deal actually works so the other side can't run it on you. Execs live here, and so do the Fixers who beat them.`,

  composition: `Words that land. Composition is writing songs, articles, and stories at a level that moves a crowd or a Data Pool. A Rockerboy with a message still needs somebody who can actually write it down.`,

  criminology: `Fingerprints, ballistics, evidence, the police files nobody's supposed to see. Criminology works a scene like a pro and rebuilds what went down. Lawmen use it to close cases. Everyone else uses it to make sure theirs never opens.`,

  cryptography: `Everything worth stealing is locked, and everything worth hiding is scrambled. Cryptography encrypts your messages and cracks theirs. In a city that runs on secrets, this is the key ring.`,

  deduction: `A pile of clues that don't add up, and you make the leap the machine can't. Deduction jumps from scattered evidence to the answer nobody else caught, a hidden motive, a diagnosis, the tell under the tell. Detectives and Medtechs both live on it.`,

  education: `Read, write, do the math, know enough history not to get played. Education is the baseline schooling the Dark Future doesn't hand out for free. Sounds basic. Half the Street can't do it.`,

  gamble: `Cards, dice, odds, and the nerve to ride them. Gamble is figuring the real numbers and playing games of chance like you mean to win. The house always has an edge. This is how you shave it.`,

  language: `Night City speaks a hundred tongues and trusts none of them. Language is fluency in one specific tongue, and you pick which every time you level it. The right word in the right dialect opens doors a gun only closes.`,

  library_search: `The truth is out there, buried in databases, Data Pools, and archives nobody's opened in years. Library Search digs it out. It's slow, it's unglamorous, and it wins more jobs than any firefight.`,

  local_expert: `Every neighborhood is its own country, with its own gangs, bosses, and rules. Local Expert is knowing one of them cold: who runs it, who's feuding, where the bodies and the exits are. Pick your turf. It's never bigger than a single block.`,

  science: `Real lab work: experiments, papers, hypotheses, the arguments academics have at 3 a.m. Science covers one field you name, physics, biology, chemistry, whatever. Rare on The Street, priceless when a job turns weird.`,

  tactics: `When it's more than a shootout, when it's a battle, Tactics is the skill of running it. Read the enemy, move your people, take the ground. Solos who have it come home. The ones who don't fill the wound wards.`,

  wilderness_survival: `Past the city there's the Badlands, and the Badlands do not care about you. Wilderness Survival keeps you fed, watered, and breathing where there's no vending machine for a hundred klicks. Nomad birthright.`,

  brawling: `No blade, no gun, just knuckles and bad intentions. Brawling is fighting and grappling on pure muscle: the bar, the alley, the grab that ends it. Everyone should know a little. A lot of people only know this.`,

  evasion: `Somebody swings and you're not there anymore. Evasion is slipping melee attacks, and if your REF is 8 or higher you can even dance out of the way of bullets. The best defense is not being where the hit lands.`,

  martial_arts: `Trained fighting with a real Form: Karate, Judo, Aikido, whatever you drill. Each Form is its own study and its own moves, so it costs double and you pick one at a time. Slower to learn, deadlier to meet.`,

  melee_weapon: `Knives, bats, monoblades, anything with an edge or a weight behind it. Melee Weapon is close and personal, no ammo to run dry, no muzzle flash to give you away. Quiet, cheap, and very final.`,

  acting: `Become someone else and sell it. Acting is disguise, false identity, and faking every emotion on cue, the mask that gets you past the guard and into the room. Half of Media and every good con runs on it.`,

  play_instrument: `Real playing, real chops, on whatever you choose: guitar, synth, drums, your own voice. Play Instrument is the difference between noise and a set that fills a room. Rockerboys don't get famous on vibes alone.`,

  archery: `Bows and bolt-throwers, silent and off the grid. Archery puts a broadhead where you aim it: no bang, no serial number, no ammo shortage. Old tech, but a body's still a body.`,

  autofire: `Hold the trigger and let it scream. Autofire is keeping a full-auto weapon on target while recoil tries to walk it off the mark. Costs double, because spray-and-pray gets you killed and controlled bursts get you paid.`,

  handgun: `The Street's default answer. Handgun is accurate fire with pistols, the piece on your hip that settles most arguments in Night City. If you learn one Ranged skill, it's probably this one.`,

  heavy_weapons: `Grenade launchers, rockets, the hardware that removes cover and the people behind it. Heavy Weapons is aiming ordnance that turns a problem into a crater. Costs double, weighs a ton, worth every eb when the wall has to go.`,

  shoulder_arms: `Rifles and shotguns, braced against the shoulder for reach and punch. Shoulder Arms reaches across a rooftop or clears a hallway in one pull. When a pistol just isn't enough gun, this is.`,

  bribery: `Everyone in this city has a price. The trick is naming it. Bribery is knowing when to grease a palm, how to approach, and exactly how much. Too little insults them. Too much tells them you're desperate.`,

  conversation: `The soft interrogation. Conversation pulls what you need out of somebody without them ever realizing they handed it over. No pain, no threats, just a friendly chat and a very good listener.`,

  human_perception: `Faces leak. Human Perception reads expression and body language to clock a mood, a lie, a tell. It's how you know the Fixer is holding out before the deal even goes sideways.`,

  interrogation: `The hard version. Interrogation is forcing information out of someone who does not want to give it, through pressure, fear, or worse. Ugly, effective, and the kind of skill that follows you home.`,

  persuasion: `Talk them into it. Persuasion is convincing, influencing, and swaying people to your side of the table. The Exec's real weapon, and a lot cheaper than a Team Member.`,

  personal_grooming: `Looking good is not vanity in Night City, it's armor. Personal Grooming is knowing how to maximize what you've got: the cut, the face, the presentation. People buy the package before they hear the pitch.`,

  streetwise: `The Street has rules nobody writes down, and Streetwise is knowing them. Find contraband, talk to the criminal element, read a bad block, and get out before it turns on you. This is the skill that keeps runners breathing between gigs.`,

  trading: `Never pay sticker. Trading is haggling a merchant or a mark down to a price that favors you: buy low, sell high, and know what a thing is really worth. Fixers build whole careers on this.`,

  wardrobe_style: `You're broke and your apartment's a shipping container. Doesn't mean you dress like it. Wardrobe & Style is knowing what to wear and when, because in this town the right look opens doors the wrong one gets slammed in your face.`,

  air_vehicle_tech: `AVs and gyros are gorgeous until they aren't. Air Vehicle Tech keeps them flying and puts them back together when they don't. Rare skill, because the alternative to fixing an aircraft is falling in one.`,

  basic_tech: `The catch-all. Basic Tech identifies, understands, and repairs the simple electronic and mechanical junk no other skill covers. It won't touch your cyberdeck, but it'll get the door, the generator, and the busted vending machine working again.`,

  cybertech: `Chrome breaks like anything else, only it's bolted to somebody's nervous system. Cybertech identifies, understands, and repairs cyberware. Techs who know it never go hungry, because half this city is more machine than meat.`,

  demolitions: `Explosives, set and defused, and knowing exactly how much brings the wall down without the ceiling. Demolitions costs double for a reason: the margin for error is measured in body parts. Get it right and doors stop being a problem.`,

  electronics_security_tech: `Computers, cyberdecks, alarms, bugs, tripwires, pressure plates, the whole nervous system of a secure site. Electronics/Security Tech builds it, breaks it, and slips past it. Costs double, opens everything, and every crew wants one.`,

  first_aid: `Somebody's bleeding out and the Medtech is three blocks away. First Aid patches the most common Critical Injuries and keeps a body from flatlining until real help shows. Cheap, fast, and the reason your friends are still your friends.`,

  forgery: `Papers, IDs, permits, the documents that say you belong here. Forgery makes them convincing and spots the fakes when somebody runs the trick on you. In a city obsessed with credentials, a good forger is worth a fortune.`,

  land_vehicle_tech: `Groundcars and bikes take a beating, and Land Vehicle Tech keeps them running through it. Tune it, patch it, get it rolling before the gang catches up. A Nomad without this is just a pedestrian with attitude.`,

  paint_draw_sculpt: `Real art, professional grade: canvas, ink, clay, whatever the medium. Paint/Draw/Sculpt makes work people actually pay for, or a Rockerboy's message people actually see. Beauty still sells, even here.`,

  paramedic: `One tier up from First Aid. Paramedic handles every Critical Injury that doesn't need Surgery (that stays a Medtech's Role Ability) and keeps the dying alive. Costs double, saves lives, makes you the most popular person in any firefight.`,

  photography_film: `Photos, video, braindances, the record that proves it happened. Photography/Film captures the shot a Media builds a career on, or the edit that puts a Corp on the ropes. In this town, footage is ammunition.`,

  pick_lock: `The old-school locks that don't answer to a cyberdeck. Pick Lock bypasses mechanical tumblers, quiet and clean, no alarm log, no trace. Sometimes the low-tech door is the one nobody's watching.`,

  pick_pocket: `Lift the wallet, palm the keycard, walk the shelf item out the door. Pick Pocket is stealthy retrieval off a person and quiet shoplifting, all without a hand felt or an eye raised. Half a con is this skill and a smile.`,

  sea_vehicle_tech: `Salt and water eat machines alive. Sea Vehicle Tech keeps boats and skiffs seaworthy, patching hulls and engines out where a breakdown means swimming. Niche, until you're a mile from shore.`,

  weaponstech: `A jammed gun is a very expensive club. Weaponstech repairs and maintains weapons of every kind, keeping your hardware firing when it counts. Every crew has one, or wishes it did.`,
};
