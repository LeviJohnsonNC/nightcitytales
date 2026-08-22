/**
 * In-voice descriptions for catalog items, written in the Night City house
 * style (see src/lib/prose-style.ts). Grounded in each item's real stats and
 * rules; adds attitude, not new mechanics. The info modal shows this alongside
 * the exact stat line and mechanical notes.
 *
 * Keyed by catalog item id. An item with no entry falls back to its stats and
 * mechanical notes/description alone.
 */
export const ITEM_FLAVOR: Record<string, string> = {
  // ---- Weapons: standard ----
  light_melee: `The knife, the tomahawk, the thing you can hide up a sleeve. A light melee weapon is quiet, cheap, and legal to carry almost anywhere, and it ends a lot of arguments before anyone hears a shot. 1d6 doesn't sound like much until it's in your kidney.`,
  medium_melee: `Bats, crowbars, machetes. The workhorse of a Night City brawl. A medium melee weapon hits hard enough to matter and doubles as a tool when nobody's looking. Cheap, deniable, and always in reach.`,
  heavy_melee: `A lead pipe, a sword, a spiked bat swung with both hands. Heavy melee is the choice when you want the fight short and the message loud. 3d6 says you were serious.`,
  very_heavy_melee: `Chainsaw, sledge, naginata. This is not subtle and was never meant to be. A very heavy melee weapon is for people who want to be remembered, or at least talked about after. Bring a strong back.`,
  medium_pistol: `The sidearm the whole city carries. A medium pistol is concealable, affordable, and enough gun for most of what The Street throws at you. Not the biggest bang, but it's the one on your hip when it counts.`,
  heavy_pistol: `A step up in stopping power for people who expect trouble. The heavy pistol still tucks under a jacket but hits like it means it. The standard answer to a bad night.`,
  very_heavy_pistol: `About as much gun as you can hold in one hand. A very heavy pistol trades a little concealment for serious punch, the kind that goes through armor and attitude alike. Show it and most conversations end.`,
  smg: `Spray and pray, in a package you can hide under a coat. The SMG puts a lot of rounds downrange fast with Autofire, which is exactly what you want when the room fills up with people who don't like you.`,
  heavy_smg: `The SMG's bigger cousin. Same run-and-gun idea, more weight behind every burst. When you need to hold a hallway by yourself, the heavy SMG is a good friend to have.`,
  shotgun: `Up close, nothing settles a room faster. The shotgun is loud, brutal, and forgiving of bad aim, which is why every gang armory has a rack of them. 5d6 at bad-breath range.`,
  assault_rifle: `The soldier's tool, and half this city did their time in somebody's war. The assault rifle reaches out, lays down Autofire, and makes people reconsider. It does not fit under a jacket, and it is not trying to.`,
  sniper_rifle: `One shot, one very bad day for somebody far away. The sniper rifle is patience and reach, the weapon of people who plan. You won't carry it into a bar, but you'll be glad you have it on a rooftop.`,
  bows_crossbows: `Silent, off the grid, no serial number to trace. Bows and crossbows are slow to reload but they kill quiet, and out in the Badlands where ammo is gold, an arrow you can walk over and pick back up is worth a lot.`,
  grenade_launcher: `When the problem is a wall, or a crowd, or a wall of crowd. The grenade launcher lobs ordnance that removes cover and everyone behind it. Heavy, illegal almost everywhere, and worth it.`,
  rocket_launcher: `The answer to a question nobody should be asking. A rocket launcher deletes vehicles, doors, and arguments in a single 8d6 breath. If you're carrying one of these, the plan has gone somewhere interesting.`,

  // ---- Weapons: exotic ----
  air_pistol: `Looks like a pistol, spits paintballs. Useless in a firefight, priceless when you need somebody alive: load the balls with acid and every hit eats a point of their armor. The pro's tool for a capture job.`,
  battleglove: `A slab of armored gauntlet with three cyberarm option slots built in, so your meat arm can pack chrome tricks without the surgery. Bulky, impossible to hide, and exactly the thing that makes a bouncer nervous.`,
  hurricane_assault: `Constitution Arms built a shotgun that doesn't know when to stop: sixteen shells in a drum, two shots a turn, and a reload so long you'd better have finished it early. You need BODY 11 just to hold it steady. Overkill, bottled.`,
  dartgun: `An exotic very heavy pistol that only feeds special arrows, eight to a clip. It's the delivery system for the nasty stuff, poison, biotoxin, sleep, in a frame you can actually carry. Quiet, clean, and deeply unfair.`,
  flamethrower: `Exactly what it says. Fired with Heavy Weapons, it throws incendiary shells and leaves targets burning for 4 a turn until they stop, drop, and roll. No finesse, no aimed shots, just a persuasive argument against standing still.`,
  kendachi_mono_three: `A crystal katana that vibrates four thousand times a minute and cuts through anything under SP11 like it isn't there, but only for the hand holding the right biometric key. Set a laser in the hilt for the glow. Rich, deadly, very Night City.`,
  malorian_3516: `The legend. An excellent very heavy pistol that hits for 5d6 on a single shot with a Smartgun Link baked in, and needs your plugs to fire at all. They almost never come up for sale, and when they do the price is obscene. You know whose gun this was.`,
  microwaver: `No bullets, no bang. The Microwaver cooks a target's cyberware and electronics: beat a DV15 Cybertech or watch two of your systems die for a minute. Runs on rechargeable packs. The nightmare of anyone who's mostly chrome.`,
  cowboy_u56: `Militech's belt-fed answer to a crowd. Four grenades, two a turn, any grenade type you can load. Needs BODY 11 and a two-turn reload, but when it opens up, a whole intersection reconsiders its choices.`,
  rhinemetall_railgun: `A railgun that shrugs off anything under SP11 and fires with Heavy Weapons. Four shots, no autofire, no finesse, just a magnetic slug that treats most armor like a suggestion. Slow to reload, heavy to carry, worth it when the target is hard.`,
  shrieker: `A very heavy pistol that screams instead of shooting. Beat a DV15 Resist Torture/Drugs or your ear is gone, and if you fire it without ear protection, so is yours. Runs on battery packs. Cruel in a way that feels personal.`,
  stun_baton: `The bouncer's best friend. A one-handed baton that drops a target to unconscious at 1 HP instead of killing them, no criticals, no armor damage. When the job is to bring them in breathing, this is the tool.`,
  stun_gun: `A pistol that puts people to sleep instead of in the ground: reduce a target below 1 HP and they're just unconscious at 1 instead. Runs on rechargeable packs. For when you need answers, not a body.`,
  tsunami_helix: `An assault rifle that only knows one word: Autofire. Forty rounds, twenty gone per pull, and damage that multiplies by how badly you beat the DV, up to five times. Needs BODY 11 and a two-turn reload. A firehose of bullets.`,

  // ---- Armor ----
  leathers: `Cheap, easy, and the reason bikers and Nomads still look cool doing it. Leathers won't stop a serious round, but SP4 turns a lot of near-misses into bruises instead of holes, and they never slow you down.`,
  kevlar: `The everyday vest, worn under a shirt by anyone with sense. Kevlar's SP7 is enough to make a mugger reconsider and a pistol round think twice. Light, cheap, invisible under a jacket. No excuse not to.`,
  light_armorjack: `The working edgerunner's default. Light Armorjack weaves ballistic protection into normal-looking clothes for SP11 and no penalty, which is why half the people on The Street are wearing it right now. Protection you can live in.`,
  bodyweight_suit: `SP11 spread over the whole body in a sleek second skin, cut for movement and for Netrunners who need to jack in without looking like a tank. Pricey, but it covers everything and never gets in your way.`,
  medium_armorjack: `One step up from Light for a little more coin. Medium Armorjack's SP12 costs you nothing in speed and buys real peace of mind. The sweet spot for people who expect to get shot at occasionally.`,
  heavy_armorjack: `SP13, and you start to feel it. Heavy Armorjack is for the jobs where you know rounds are coming, and it slows you just enough to remind you it's there. Solos wear it to work.`,
  flak: `Military surplus, and it looks it. Flak armor's SP15 will turn away serious fire, at the cost of moving like you're wrapped in a mattress. When the plan involves a firefight, not a getaway, this is the pick.`,
  metalgear: `The heaviest thing you can wear and still walk. SP18 of rigid plate that shrugs off rifle rounds and costs a small fortune. You will be slow, you will be obvious, and you will probably live. C-SWAT's favorite.`,
  bulletproof_shield: `A slab you hold between you and the incoming. The bulletproof shield doesn't cover a location, it soaks hits until it's chewed through, then it's scrap. Cheap insurance for the person on point.`,

  // ---- Ammunition ----
  basic_ammo: `Lead and brass, sold by the ten. Basic ammunition does exactly one thing, which is go where you point it and make a hole. No tricks, no surprises, cheap enough to practice with. Most of what gets fired in this city is this.`,
  ap_ammo: `For when the other guy sprang for armor. Armor-Piercing rounds chew through protection twice as fast, turning a heavy vest into a suggestion. Costs more, but so does getting shot at by someone in Metalgear.`,
  biotoxin_ammo: `Delivery, not damage. Biotoxin ammo skips the armor and goes straight for the meat: fail the save and it's 3d6 into your body no matter what you're wearing. Nasty, expensive, and the kind of thing that gets you a reputation.`,
  emp_ammo: `The chrome-killer. An EMP grenade doesn't scratch you, it just switches off two pieces of your cyberware or gear for a minute, which in this city can be the whole fight. Netrunners and full-borgs lose sleep over these.`,
  expansive_ammo: `Ammunition designed to make a bad wound worse. When it causes a Foreign Object injury, it rolls up a second Critical on top. Field surgeons hate it, which is sort of the point.`,
  flashbang_ammo: `The room-clearer. No damage, just a wall of light and noise that leaves everyone who fails the save blind and deaf for a minute. Lawmen breach with these. So do people pretending to be Lawmen.`,
  incendiary_ammo: `Fire in a shell. Punch through armor with it and the target lights up, taking 2 a turn until they stop and roll. Cruel, effective, and very hard to ignore. Good against things that regenerate, great against things that panic.`,
  poison_ammo: `The cheaper cousin of biotoxin. Skips the armor, forces a save, and drops 2d6 straight into the body of anyone who fails. Loaded into arrows and grenades by people who want the kill quiet and deniable.`,
  rubber_ammo: `Less-lethal, mostly. Rubber rounds won't crit, won't chew armor, and won't drop someone below 1 HP, so they hurt like hell without making a corpse. Crowd control, or a capture job with a conscience.`,
  sleep_ammo: `Chemical lights-out in a shell. Fail the save and you're on the floor, unconscious for a minute or until somebody wakes you the hard way. The professional's choice for taking a mark alive and unmarked.`,
  smart_ammo: `Rounds that argue with a miss. With a Targeting Scope in your eyes, a shot that misses by a hair gets a second, smarter chance to correct and land. Expensive, and useless without the chrome to guide it.`,
  smoke_ammo: `A wall you can walk through and they can't see through. One shell fills a ten-meter square with smoke for a minute and slaps a -4 on anything anyone tries to do inside it. Cover you carry in your pocket.`,
  teargas_ammo: `Weaponized misery. A teargas round leaves anyone with meat eyes who fails the save weeping and half-blind for a minute. Standard-issue for riot cops and anyone who wants a crowd to become a stampede.`,

  // ---- Fashionware ----
  biomonitor: `A subdermal readout that quietly watches your vitals and pipes them to your Agent, so you know you're crashing before you feel it. Cheap, common, and the thing a Medtech begs their crew to install. Style meets not-dying.`,
  chemskin: `Change your skin to any hue you like, permanently, until you pay to change it again. Chemskin is fashion you wear under the clothes, and paired with Techhair it'll bump your grooming game. In this city, the look is the resume.`,
  emp_threading: `Glowing silver circuit-lines traced across your body, catching the neon just right. EMP Threading does nothing but look expensive, which on The Street is the entire point. Pure attitude, worn on the skin.`,
  light_tattoo: `Ink that glows on command. Stack three or more and your Wardrobe & Style gets a real bump, because in Night City a body that lights up in the dark is a body people remember. Cheap flash with a payoff.`,
  shift_tacts: `Implanted lenses that change your eye color whenever the mood takes you. Shift Tacts are small, subtle, and endlessly cool, the kind of chrome that says you can afford to spend Humanity on style. Blink and you're a different person.`,
  // ---- Gear ----
  airhypo: `A pressurized injector that puts a dose through skin and clothing in a second flat. Medtechs carry one loaded with painkillers, everyone else carries one loaded with worse. No needle, no fuss, no time to argue.`,
  anti_smog_breathing_mask: `Night City air is a chemistry experiment nobody consented to. The mask filters the worst of the airborne toxins so you can walk a Combat Zone morning without coughing up your lining. Cheap insurance against the sky.`,
  braindance_viewer: `The headset that lets you ride somebody else's memories from the inside: their eyes, their skin, their heartbeat. Entertainment for most, evidence for the rest. Editors and Lawmen both live in these.`,
  braindance_wreath: `The recorder half of the braindance trade, worn like a crown while you live through something worth selling. Everything you see, feel, and think goes to chip. Careful what you're thinking about.`,
  carryall: `A big, ugly, indestructible bag. Holds the guns, the ammo, the tools, and the change of clothes you'll want after. Nobody looks twice at a carryall, which is exactly why you own one.`,
  computer: `A laptop or a desk rig: the boring, essential box where the research, the forged paperwork, and the accounting happen. It won't get you onto the NET, but it'll get you ready to go.`,
  cyberdeck: `The entry-level runner's rig, seven slots of Programs and Hardware, and the difference between looking at the NET and being in it. Everything a Netrunner is starts with one of these strapped on.`,
  duct_tape: `The universal solvent of problems. Patches armor, seals a suit, silences a hostage, holds a bumper on. Comes in every color, including glow-in-the-dark, because this city can't leave anything plain.`,
  flashlight: `A beam in a city that keeps losing power. Basements, maintenance tunnels, dead arcologies, the inside of somebody's chest cavity: light first, then decisions.`,
  food_stick: `One awful meal compressed into bar form. Tastes like chalk and regret, keeps you upright through a stakeout. Everyone has three in the glovebox and admits to none.`,
  glow_paint: `Spraypaint that burns bright in the dark. Gangs mark turf with it, runners mark exits with it, and Media use it when they want a wall to still be shouting at three in the morning.`,
  handcuffs: `Steel restraints that hold anyone who isn't stronger than a door. Standard on every Lawman's belt, and increasingly on the belts of people who only dress like Lawmen.`,
  inflatable_bed_sleep_bag: `Self-inflating mattress and a bag rated for a cold night. The difference between sleeping in a squat and sleeping badly in a squat. Nomads and squatters swear by it.`,
  kibble_pack: `One meal's worth of the protein slurry this city runs on. Nobody likes Kibble. Everybody eats Kibble. It's cheap, it's everywhere, and it keeps you alive to complain about it.`,
  lock_picking_set: `Slim picks and tension wrenches in a roll of cloth, for the doors that still use metal instead of code. Quiet, patient work, and no alarm log to scrub afterward.`,
  medtech_bag: `The field kit: clamps, patches, drugs, and a folding tray that has seen things. It's the tools that let a Medtech stabilize somebody on a warehouse floor instead of losing them there.`,
  memory_chip: `Standard data storage, small enough to swallow, valuable enough that people do. Half the jobs in this city are a chip changing hands and nobody getting shot afterward. Half.`,
  mre: `A self-heating foil bag of something the label calls a meal. Pull the tab, wait, eat it hot in the rain. Nomads and mercs live on these for weeks and it shows.`,
  personal_carepak: `Soap, razor, dental, the whole civilized kit in one pouch. Turning up clean is a professional advantage in a city that assumes you slept in a car, and you did.`,
  radar_detector: `A palm-sized box that tells you when something is watching from a distance. Useful on the Badlands runs, more useful when the thing watching is airborne and armed.`,
  radiation_suit: `Sealed head to boot for the hot places: old reactors, dead zones, the stretch of Badlands nobody maps. Ugly, hot to wear, and the only reason you come back with your teeth.`,
  radio_communicator: `An earpiece with a mile of range. Cheap crew comms that don't touch the NET and don't show up in anyone's data logs. Old technology, still the hardest to trace.`,
  radio_scanner_music_player: `Sweeps the local bands for chatter, or plays your music while you wait. Half the Fixers in this city built their careers on hearing a police dispatch six seconds before everyone else.`,
  rope_60m_yd: `Sixty meters of nylon. Fire escapes, elevator shafts, cliff faces, and the occasional person who needs to be lowered somewhere quietly. Weighs nothing, saves everything.`,
  scrambler_descrambler: `Turns your comms into noise for anyone listening, and their noise into words for you. Standard kit for a crew that assumes it's being recorded, which is the correct assumption.`,
  techscanner: `Reads what a machine is doing without opening it up. A Tech waves this over a lock, a drone, or a corpse full of chrome and gets the story the hardware won't tell.`,
  techtool: `The all-in-one multitool a Tech never puts down. Drivers, cutters, probes, and clamps in one grip. It won't fix everything, but it'll get you far enough to improvise the rest.`,
  tent_and_camping_equipment: `Shelter for one, packed down to a bundle. Out past the city limits there's nothing between you and the weather but this, and the weather out there is not friendly.`,
  video_camera: `Glass, lens, and storage: the Media's oldest weapon. Point it at the thing they told you not to point it at. Footage has toppled more Night City execs than bullets have.`,
};

/**
 * In-voice descriptions for the specific weapons behind a catalog category
 * (e.g. Light Melee Weapon → Combat Knife or Tomahawk). Keyed by the exact
 * variant string printed in src/data/rules/catalog.json → weapons[].variants.
 * These add colour only: every stat still comes from the parent catalog row.
 */
export const VARIANT_FLAVOR: Record<string, string> = {
  // Light Melee Weapon
  "Combat Knife": `Short, balanced, and boring enough that nobody looks twice at it. A combat knife rides in a boot or a sleeve, clears a zip-tie, opens a ration pack, and goes into a throat without a sound.`,
  Tomahawk: `A hatchet built for hands, not firewood. Heavier at the head than a knife, so it bites deeper and sticks, and it throws well enough that some people never bother closing the distance.`,

  // Medium Melee Weapon
  "Baseball Bat": `The most deniable weapon in Night City. Nobody gets arrested for owning a bat. Long reach, plenty of swing, and a sound on impact you don't forget.`,
  Crowbar: `A tool first, which is exactly why it works. It opens doors, vents, and crates all shift, then opens the guy who objects. Steel all the way through, impossible to break.`,
  Machete: `A blade long enough to keep someone at arm's length and heavy enough to go through what's in the way. Cheap, common in the Badlands, and it cuts brush as happily as it cuts people.`,

  // Heavy Melee Weapon
  "Lead Pipe": `Two hands, no edge, all mass. A length of pipe costs nothing, comes off a wall in any abandoned block, and breaks bones through armour that shrugs off a knife.`,
  Sword: `An anachronism that keeps proving itself. A two-handed blade is a statement about how the next thirty seconds are going to go, and in a city full of gunfire, nobody expects it.`,
  "Spiked Bat": `A bat somebody improved with a fistful of nails. Same swing, same reach, worse outcome. Booster gangs love it because the damage it leaves is a signature.`,

  // Very Heavy Melee Weapon
  Chainsaw: `Loud before it touches anything, which is half the point. It's slow, it's heavy, it needs fuel, and the noise clears a room faster than the blade does.`,
  Sledgehammer: `Built to break concrete, repurposed to break everything else. No edge to dull, no mechanism to fail. Swing it once and whatever it hits stops being structurally sound.`,
  "Helicopter Blades": `Scrap-yard art: a rotor blade cut down and wrapped with a grip. Absurdly long, absurdly heavy, and it takes a whole doorway to swing in. Pure Nomad theatre with a lethal edge.`,
  Naginata: `A curved blade on a long shaft, kept alive by Arasaka drill halls and the people who trained in them. Reach, precision, and a discipline that reads as very expensive.`,

  // Bows & Crossbows
  Bow: `Silent, serial-number-free, and the arrow is still there after. Slow between shots and it takes real arm to draw, but out where ammo costs more than food, that matters.`,
  Crossbow: `The bow's patient cousin. Slower to load, but it holds at full draw all night, so you can sit on a doorway for an hour and still put a bolt through it.`,
};

/* ---- Gear: personal electronics, tools, and stage kit ---- */
Object.assign(ITEM_FLAVOR, {
  agent: `Everyone's got one. A pocket AI that answers your calls, screens your contacts, digs through the data pools for you, and quietly tells you that jacket doesn't work. Lose it and you're nobody.`,
  audio_recorder: `Twenty-four hours of sound on a single chip. Medias live off these: leave one running in the wrong room and the tape does the reporting for you.`,
  auto_level_dampening_ear_protectors: `Compact plugs that clamp down the instant the noise turns dangerous. Standing next to a shotgun, a Shrieker, or a stack of amps stops costing you an eardrum.`,
  binoculars: `Two or three times closer, from somewhere they can't reach you. Rooftop work, stakeouts, and knowing how many are in the room before you're in it.`,
  bug_detector: `Beeps when there's a listening device within a couple of metres. In this city that beep goes off more than it should, which is exactly why you carry one.`,
  chemical_analyzer: `Point it at a powder, a drink, or a puddle and it names the compound off a sample database. Handy for Medtechs, essential for anyone buying from strangers.`,
  disposable_cell_phone: `Burner. Makes calls, holds nothing, and goes in a storm drain the second the job's done. Cheap enough to buy in packs.`,
  drum_synthesizer: `Every drum ever built, in one box, no van needed. Plug it into an amp and a Rockerboy can fill a lot from the back of a bike.`,
  electric_guitar_other_instrument: `The instrument, whichever one is yours. Electric means it needs an amp, and an amp means a crowd. Half the revolutions in this city started with somebody plugging in.`,
  glow_stick: `Snap it and get four metres of light for ten hours. No batteries, no heat, no muzzle flash giving you away. Combat zone standard.`,
  grapple_gun: `Thirty metres of line and a hook that holds. Gets you up the outside of a building or off the roof in a hurry. Not a weapon, whatever you were thinking.`,
  homing_tracer: `Stick the tracer, follow from a mile out. Fixers use them on cargo, Solos use them on people, and nobody admits to owning one.`,
  medscanner: `Reads vitals and names the problem before you cut. In a Medtech's hands it's the difference between stabilising someone and guessing at them.`,
  pocket_amplifier: `Two instruments, six hours a charge, small enough to carry to the corner you're about to make loud. Street shows don't need a venue, just this.`,
  road_flare: `A hundred metres of hard red light for an hour. Marks a landing zone, blinds a pursuit, or tells the convoy where the trouble is.`,
  smart_glasses: `Ordinary-looking frames with two Cyberoptic option slots inside, so you get the chrome tricks without a scalpel in your eye socket. Take them off at the border.`,
  tech_bag: `Drivers, cutters, tape, and spares in one shoulder bag. It won't rebuild an engine, but it'll get the door open and the drone flying again.`,
  vial_of_biotoxin: `A sealed vial of something that shouldn't exist outside a lab. 3d6, ignores armour entirely, and only a hard Resist Torture/Drugs keeps you upright. Handle it like it hates you.`,
  vial_of_poison: `Old-fashioned murder in a glass tube. 2d6 straight past armour unless they can tough it out. Quiet, deniable, and very hard to explain if you're searched.`,
  virtuality_goggles: `Lays NET imagery over the real world, so the data floats in the room with you. Netrunners love them. Wearing them while crossing a street is how people die.`,
});
