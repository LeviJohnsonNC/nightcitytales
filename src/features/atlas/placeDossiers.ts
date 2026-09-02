/**
 * Long-form dossier text for the districts and locations of Night City, and the
 * picture that goes with each one.
 *
 * Written by hand in the house voice (see src/lib/prose-style.ts). Presentation
 * copy only. No rules data lives here, and the engine never imports it: the
 * atlas JSON stays what the publisher printed, and this is what the player
 * reads. A place with no entry here falls back to its atlas blurb.
 *
 * `image` is a file under public/images/places. Keys are the atlas's own place
 * and district keys, so nothing has to be kept in step by hand.
 */

export type PlaceDossierEntry = {
  /** File name (no extension) under public/images/places. */
  image: string;
  /** Paragraphs, in order. */
  text: string;
};

export const PLACE_DOSSIERS: Record<string, PlaceDossierEntry> = {
  little_europe: {
    image: "little-europe",
    text: `Little Europe is what happens when a city tries to build its future without first clearing away its past. Old brick tenements, narrow storefronts, Catholic stonework, fire escapes, and century-old façades stand shoulder to shoulder with glass towers, corporate residential blocks, neon-washed megastructures, and construction cranes hauling the next version of Night City into the sky. Before the Fourth Corporate War, this part of the city drew heavily from Little Italy, Northside, and the architectural DNA of places like New York, Boston, and old European cities. After the War smashed neighborhoods together and turned urban planning into triage, those pieces became Little Europe. The result is not harmonious. It is layered. Walk three blocks and you can cross forty years, two tax brackets, and several incompatible ideas about what Night City is supposed to become.

The divisions run deeper than architecture. Little Europe is a district of people who can see one another's lives through the windows. A corporate employee steps out of a climate-controlled tower and walks past a family business whose owners have been working the same battered counter since before the skyline changed. Execs sleep behind hardened security at Camden Court while Cube-A-Rama tenants fold their entire existence into rooms scarcely larger than closets. Danger Gal operatives roar home from a job to a building full of hot-pink chaos while, a few streets away, Holy Angels feeds people who have nothing. At Paradiso Terrestre, somebody spends more on dinner than another resident will see in a month. Neither person has to travel far enough to forget the other exists. Little Europe does not separate rich and poor cleanly. It rubs them against one another until sparks come off.

That friction is part of what keeps the district alive. Unlike the polished corporate enclaves where everything belongs to somebody with a security contract, Little Europe still feels inhabited rather than administered. People know their bartenders. Shopkeepers know which kids steal. Old veterans occupy the same tables every Thursday. Netrunners trade secrets over drinks at Short Circuit. Pool sharks ruin newcomers at Greta's. Fixers maintain booths, bartenders maintain secrets, priests maintain truces, and neighborhood businesses survive because enough people have quietly decided they deserve to. Even the megacorps have been forced to squeeze themselves into an existing social ecosystem rather than simply bulldoze it flat. Continental Brands can build a vertical neighborhood. It cannot stop the residents from giving every corridor insulting nicknames. Little Europe absorbs everything eventually, even the things trying to replace it.

And replacement is coming. Around 2045, executives and Fixers organized through a Chamber of Commerce had already begun carving away part of Little Europe and calling it Downtown, betting that the district could be transformed into Night City's next economic center. Development pushes upward. NCART links it to the Executive Zone and Watson. Megabuildings rise to accommodate the displaced. Across the water, new infrastructure promises another wave of construction, while the Hot Zone still glows to the east as a reminder of what happened the last time Night City's future became too ambitious. Little Europe stands between those two horizons: one side cranes and investment capital, the other radioactive history. The question hanging over every property deed and demolition notice is not whether the neighborhood will change. It is how much of it will still be recognizable when the money finishes arriving.

That makes Little Europe one of the best places in Night City to actually live a story. A job here rarely stays neatly in one world. Follow a corpo out of a skyscraper and they may disappear into a century-old pub. Chase a Netrunner through a cube hotel and the trail can end inside a church where drawing a weapon makes everyone in the room your enemy. A five-thousand-eurobuck suit can be fitted two streets from a bar with a functioning meat grinder. A private investigator, mobster, veteran, street kid, Exec, priest, Solo, and Tech can all plausibly cross the same intersection before lunch. That's Little Europe. Not old Night City. Not new Night City. Both of them, fighting over the same pavement. And for the moment, neither has won.`,
  },

  a1: {
    image: "camden-court",
    text: `Camden Court sells one thing better than almost anywhere else in Little Europe: the illusion that the city cannot reach you here. The apartment complex has been expensive for decades, favored by Solos with enemies and Execs with expense accounts, with the kind of security that makes ordinary residents feel comforted and professional killers start counting cameras. The lobby is polished without being ostentatious, the elevators behave themselves, the hallway lights work, and strangers lingering outside somebody's door tend to become security's problem very quickly. In Night City, these qualify as luxury amenities.

The residents are an unusual blend of corporate predators and people professionally employed to shoot corporate predators. You might share an elevator with a Petrochem middle manager carrying synth-groceries, a Solo coming home with dried blood beneath their fingernails, and a lawyer pretending not to recognize either of them. Nobody asks questions. Camden Court has developed its own quiet etiquette: don't stare at the cyberware, don't ask why the elevator was locked down last night, and if somebody from the sixth floor suddenly disappears, you never knew them.

For an edgerunner, Camden Court is simultaneously sanctuary and pressure cooker. A client might rent an apartment here because they know the building is hard to penetrate. A target might live here for exactly the same reason. Getting through the front door is one problem. Getting back out after the building realizes you do not belong is another. And somewhere behind all those expensive doors, people are still having affairs, hiding contraband, negotiating betrayals, and trying desperately to believe that enough money can make them safe.`,
  },

  a2: {
    image: "choppers",
    text: `The sign says Chopper's, and you don't need anybody to explain the joke. The place used to be a butcher shop, back when there was enough real meat moving through Night City for neighborhood butchers to matter. When the meat stopped coming, the butcher shop died. The hardware survived. Today the refrigerated display cases are packed with cold bottles instead of steaks, customers belly up to the old counters on high stools, and Norman, the owner, serves drinks across surfaces that once held cuts of beef. The industrial meat grinder is still in the building. It still works. Nobody has ever produced a convincing explanation for why.

Chopper's has the atmosphere of a place that has heard too much and intends to testify about none of it. The lighting is bad. The booze is strong. Half the furnishings look salvaged from the original shop, because they were, and there's something deeply Night City about drinking cheap whiskey beside an antique refrigeration unit while deals worth thousands of eurobucks are whispered three stools away. Regulars know which booths are good for private conversations, which bathroom lock is broken, and which subjects make Norman stop polishing glasses and start paying attention.

Everybody jokes about the grinder. Need a problem taken care of? Talk to Norman. Lose a friend? Check the sausages. Usually it's just black humor, the kind people cultivate when the mortality rate gets embarrassing. Usually. But Chopper's has been around long enough to understand an important Night City principle: a joke becomes much funnier when nobody is completely certain it's a joke.`,
  },

  a3: {
    image: "continental-brands",
    text: `Somewhere in the Continental Brands corporate hierarchy, a marketing executive decided employees shouldn't merely live in company housing. They should experience the Continental Brands lifestyle. The result is the Vertical Neighborhood, a residential tower in which every floor has been dressed as a different corner of the world. Apartments hide behind fake storefronts. Corridors twist into artificial streets. Scent vents pump manufactured aromas into the air while holographic vendors hawk imaginary goods to exhausted residents trying to remember whether the elevators are past the simulated noodle stand or beside the fake Moroccan spice market. Corporate calls it immersive. The people who live here call it a nightmare.

Getting lost is practically part of the lease. Ask three residents how to reach Apartment 47C and you may receive four answers, two shortcuts, and a warning never to take the "Venetian" stairwell after maintenance hours. The theming becomes surreal late at night, when holographic crowds continue their cheerful routines through nearly empty hallways and recorded street noise follows lone employees trudging home from another twelve-hour shift. It is difficult to describe the feeling of standing beneath an artificial sunset while your company-issued Agent informs you that you're late for work because you spent eleven minutes trying to find the real elevator.

For outsiders, the chaos can be useful. A courier can disappear into it. A thief can exploit it. A security team can curse it. Somewhere among the fake cafés, decorative alleyways, utility corridors, and branded cultural pastiche are thousands of small places where somebody can hide a package, conduct a meeting, or wait with a gun. The residents may hate the layout, but for an edgerunner being hunted through the tower, Continental Brands accidentally built one hell of a dungeon.`,
  },

  a4: {
    image: "cube-a-rama",
    text: `From the street, Cube-A-Rama almost looks respectable. Its original brick exterior survived the building's conversion into a cube hotel, leaving it with a kind of battered old-world charm that has become increasingly rare in Little Europe. Then you walk inside and discover that the charming historic shell contains row upon row of human storage compartments. Welcome home. Your bedroom is a box, your neighbors are separated from you by materials chosen largely because they were inexpensive, and every cubic centimeter has been engineered to remind you that privacy is something richer people purchase.

Yet Cube-A-Rama has life. People personalize their little cells with stickers, cheap lights, braindance posters, prayer cards, weapons, family photographs and whatever fragments of identity can be compressed into a few square meters. Conversations spill into common spaces because there's nowhere else for them to go. Arguments become public theater. Romance becomes an exercise in scheduling. Somebody is always showering, cooking, hacking, sleeping, screaming, laughing, or quietly packing everything they own into a bag. The notorious Short Circuit bar is close enough that some residents appear to navigate home largely through muscle memory.

Then there are the Netrunners. A group of them lives here, purpose unknown, and locals swear they sometimes communicate with one another in binary. Maybe it's performance. Maybe it's an in-joke. Maybe they're running something underneath the hotel that nobody has discovered yet. Nobody knows, which makes them considerably more interesting. At three in the morning, when half the hotel is asleep and the other half is pretending to be, you can sometimes hear fingers hammering keyboards behind closed cubes and wonder just how much of Night City is being quietly rewritten from inside a room barely large enough for a mattress.`,
  },

  a5: {
    image: "danger-gal-housing-facility",
    text: `You know you've reached Danger Gal employee housing because the building looks like somebody armed an art-deco architect with a corporate credit card and told them pink, but dangerous. The waterfront facility sits directly across from Danger Gal's headquarters, dressed inside in hot pink, pastel chartreuse, neon violet and black light. Arcade cabinets glow in common areas. Employees come and go at all hours. Security is tight, but the atmosphere is anything but sterile. This isn't a barracks. It's a clubhouse for heavily armed investigators who have decided adulthood is optional.

The residents call it the Danger Zone, and the nickname fits. Common spaces contain firing ranges, manga nooks, obstacle courses, beanbag pits, Kibble-cookie stations and Smash dispensers. Parties metastasize through the building with alarming regularity, often accumulating enough guests that you'd assume somebody had forgotten the definition of "secure corporate housing." Rumor says Piranhas show up often enough to qualify for frequent-visitor benefits. The result feels less like an apartment block and more like somebody welded a college dormitory to a private security contractor and then removed every adult responsible for saying no.

Don't mistake the chaos for weakness. The people drinking on the furniture are investigators, bodyguards, surveillance specialists, troubleshooters and professional violence-adjacent weirdos. That woman annihilating you at an arcade cabinet might have spent the afternoon tracking a kidnapping crew through the Combat Zone. The guy asleep in the beanbag pit may have a concealed handgun and a Trauma Team subscription. If you're invited to a party here, enjoy yourself. Make friends. Try the cookies. Just remember: in a building full of private investigators, somebody will notice everything you do.`,
  },

  a6: {
    image: "danger-gal-offices",
    text: `Danger Gal's headquarters rises over Little Europe as a thirteen-story art-deco monument to the proposition that intelligence work doesn't have to be beige. A decorative clocktower crowns the building. Below it, the company's private investigators, security specialists, analysts and operatives conduct business amid an interior aesthetic featuring hot-pink carpeting, mascot characters, model robots, pop-culture shrines and brightly colored firearms. There's even a go-kart circuit. You could mistake the place for a particularly unhinged entertainment company right up until you notice the armories. There are two. One contains the equipment Danger Gal admits owning.

Beneath the playful surface sits a serious intelligence operation founded by Michiko Sanderson, with investigations and security work stretching far beyond Night City. Vehicles cycle through the ground-level garage. AVs come and go from the rooftop hangar. Sensitive information moves through secured systems, operatives prepare for field assignments, and somewhere inside the building are archives containing the sort of information people kill to possess. That isn't speculation in the abstract. Edgerunners have tried breaking into those archives before. It went badly.

The upper floors are where the joke stops being funny. The eleventh and twelfth are reserved for the elite Puma Squad, with living quarters, training facilities, R&D space, meeting areas and an extensive armory. Breaking into Danger Gal HQ therefore poses an unusual tactical problem: even if you defeat the building's security, you may simply have succeeded in attracting the attention of people whose profession is finding people like you. Come here as a client and you may leave with answers. Come here as an enemy and you may leave through the garage in a container nobody asks about. Come here planning to steal from the archives, and you had better make peace with the possibility that Danger Gal already knows your name.`,
  },

  a7: {
    image: "fiddlers-green",
    text: `Fiddler's Green is an Irish pub in much the same way a plastic shamrock taped to a vending machine is Irish. There's green everywhere. Green lights. Green upholstery. Green drinks nobody in Dublin would admit to recognizing. The walls are crowded with Celtic knots, faded military photographs, cracked rugby memorabilia, and enough manufactured heritage to make the whole establishment feel like Saint Patrick's Day survived a nuclear exchange and opened a franchise. The clientele knows it. The staff knows it. Nobody particularly cares. The beer is cold, the portions are generous, and that's usually enough.

What gives the place some actual weight are the people behind the decoration. Fiddler's Green is run by Kate Mulvaney, her wife Audrey, and their extended family, with roots stretching back to veterans of the South American Wars. Beneath the tourist-pub veneer sits the easy camaraderie of people who have seen violence, survived it, and learned that sometimes the best response is another round and a story nobody entirely believes. Kate herself can occasionally be found mopping the floor, because apparently surviving a war and running a bar still doesn't exempt anybody from cleaning up somebody else's beer.

The place becomes more interesting after midnight. Veterans occupy their usual tables. Mercs trade exaggerated war stories with people who can tell exactly which parts are exaggerated. Somebody starts singing. Somebody else starts crying. Arguments become loud, but violence inside the Green is unusual because there is always the uncomfortable possibility that the grey-haired woman drinking quietly in the corner has killed more people than everyone else in the room combined. Come here looking for authentic Ireland and you'll be disappointed. Come looking for old soldiers, old stories, and people who know what the Fourth Corporate War did to the world, and suddenly Fiddler's Green becomes considerably more genuine.`,
  },

  a8: {
    image: "gretas",
    text: `There are pool halls, and then there is Greta's. The place has been around since the early days of Night City, beginning life as a straightforward lesbian bar before gradually becoming famous for something else entirely: some of the nastiest amateur pool players on the West Coast. By the Time of the Red, Greta's is widely considered the best pool hall in Night City, its tables guarded with the territorial seriousness other establishments reserve for vaults. The lesbian clientele remains an important part of the place's identity, but anyone who respects the room, pays their tab, and understands the difference between confidence and stupidity can walk through the door.

The real currency here isn't liquor. It's reputation. Money changes hands constantly around the tables as spectators bet on games, side bets attach themselves to other side bets, and somebody inevitably discovers that the quiet woman holding a battered cue has been setting them up for the last forty minutes. Greta's regulars know every imperfection in the felt, every strange bounce off the rail, every player worth backing and every newcomer pretending they aren't good. A thousand eurobucks can move across the room because one chipped ball kissed a cushion half a centimeter differently than expected.

That makes Greta's a marvelous place to conduct business. Nobody pays attention to two people talking beside a table when there's five hundred eb riding on the eight ball. Fixers scout talent here. Solos wager equipment. Romantic disasters unfold over drinks. Rivalries can last years without anybody drawing a firearm because settling the matter across green felt is considerably more humiliating. If somebody challenges you to a game at Greta's and casually asks what you're willing to bet, look at the room before you answer. Everybody else already knows how this ends.`,
  },

  a9: {
    image: "holy-angels-church",
    text: `In a city where nearly everything has a price, Holy Angels has rules instead. The old stone Catholic church has survived decades of Night City reinventing itself around it, and through all of them Father Kevin and Father Paul have maintained something almost absurdly precious: neutral ground. Gang members come here. Corpos come here. Solos come here. People who would happily murder one another six blocks away sit across the same table because once you enter Holy Angels, the weapons come off. Firearms, blades, ammunition, even weaponized cyberware gets surrendered for safekeeping. No exceptions. Father Kevin has spent decades making that rule stick.

Don't mistake sanctuary for softness. Father Kevin Sullivan is a former Solo, born in Belfast, and by 2045 he's seventy-five years old with absolutely no intention of letting age, gangs, corporations, or heavily armed idiots interfere with his church. His reputation as a mediator is extraordinary. Holy Angels has settled disputes between gangs and corporations that would otherwise have ended with bodies cooling in the street. The church feeds the hungry twice a day, shelters people with nowhere else to go, stores emergency food and water, and survives largely through donations, ingenuity, and the willingness of its community to protect it. Even 6th Street treats the church as something worth guarding.

That creates scenes found almost nowhere else in Night City. A Maelstrom lieutenant can sit three pews away from an NCPD detective. A corporate negotiator can break bread with somebody whose crew sabotaged their convoy last week. Outside, those people may be enemies. Inside, they are guests. Sometimes the silence in Holy Angels feels heavier than gunfire because everyone understands exactly how much violence is waiting beyond the doors. If Night City has anything resembling sacred ground, it might be this battered church where dangerous people voluntarily leave their weapons at the entrance and trust an old priest to keep the world from ending for another hour.`,
  },

  a10: {
    image: "paradiso-terrestre",
    text: `Paradiso Terrestre. Earthly Paradise. The name would be unbearably pretentious almost anywhere else. Here, somehow, they earn it. This is Southern Neo-Italian dining rebuilt for a world where authentic ingredients can require corporate logistics, agricultural contacts, smugglers, or all three. Reservations are mandatory. You do not simply wander in because you happen to be hungry. Somebody knows you're coming. Somebody has prepared for you. A table has been allocated, ingredients sourced, and your evening placed into a schedule that probably has more security than some Night Markets.

Inside, Paradiso Terrestre cultivates the rarest commodity in Night City: calm. Conversation remains low. Service is deliberate. The lighting flatters everyone. Plates arrive looking almost insultingly beautiful compared with the packaged food most citizens survive on. Neo-Italian cuisine doesn't pretend the old world survived untouched. It adapts. Synth proteins are treated with technique instead of apology. Hydroponic herbs matter. A genuine tomato might receive more reverence than a bottle of vintage wine did a century earlier. Nobody asks where certain ingredients came from unless they want the answer to ruin dinner.

And that's why Paradiso is useful for much more than eating. This is where an Exec brings somebody when the meeting cannot look like a meeting. Where a Fixer demonstrates that tonight's conversation is worth real money. Where a marriage proposal, corporate acquisition, murder contract, or betrayal can arrive between courses with exactly the same polished discretion. The staff does not stare. The neighboring tables do not stare. The bill eventually arrives, and for a moment you understand why the apocalypse failed to kill fine dining: civilization may collapse, supply chains may burn, but somebody will always pay obscene money to eat beautifully while the city dies outside.`,
  },

  a11: {
    image: "short-circuit",
    text: `Short Circuit is what happens when you give Night City's Techs and Netrunners a clubhouse and fail to establish any meaningful definition of the word safe. The reinforced three-story bar sits close to the Hot Zone, rebuilt in 2040 by Brain and his husband 3-Piece as an homage to the original Short Circuit, destroyed during the Fourth Corporate War. Downstairs, people drink beside workbenches while dismantling scavenged electronics. Broken drones, scorched circuit boards, salvaged military hardware and mysterious components migrate across tables beneath half-finished drinks. Brain encourages the practice and provides tools. Trash comes through the door. Sometimes something extraordinary leaves.

The second floor belongs to Netrunners. Comfortable chairs surround custom NET Architectures functioning as virtual clubs, and the entire building contains a shared Architecture called the Library, where patrons exchange information. Every December 24, an unknown Netrunner calling themselves S.A.N.T.A. has developed the charming seasonal habit of dumping classified corporate data into it. Nobody knows who S.A.N.T.A. is. Plenty of corporations would like to find out. Short Circuit's security takes that possibility seriously: biometric locks, cameras, paid Netrunners, patrolling Zhirafa drones, and an exterior elevator rigged to fill with sleeping gas if somebody gets clever.

The third floor is family territory: Brain's workshop, 3-Piece's recording space, their apartment, and the occasional location of 3-Piece's Joint, an invitation-only Night Market filled with salvaged equipment Brain has repaired, modified, or improved. Getting invited requires becoming a trusted regular, earning Brain or 3-Piece's confidence, and then surviving the final security test: their daughter Bug, who has an uncanny talent for spotting cops, corpos, and traitors. Short Circuit therefore occupies a strange place in Night City's ecosystem. It's a bar, workshop, data exchange, Night Market, social club, family home, and technological petri dish. Walk in with a fried cyberdeck and somebody may fix it. Walk in with a genuinely interesting piece of unknown hardware and suddenly you've bought yourself drinks for the evening. Walk in wearing a wire and Bug will probably know before you've ordered one.`,
  },

  a12: {
    image: "sopranos",
    text: `Soprano's has made an extraordinary business decision: theme an entire Italian restaurant around organized crime in a city where actual organized crime lives nearby. Red leather booths. Dark wood. Framed photographs of men looking vaguely threatening. Servers who talk about "the family." Menu items with names that make tourists giggle nervously. Somewhere, undoubtedly, a violin is working much harder than necessary. The commitment to the bit is absolute.

The remarkable thing is that the real Mob appears to have decided this is fine. Members of organizations such as the Skiv Family generally leave Soprano's alone, apparently regarding it with the same weary tolerance a shark might show toward a child wearing a shark costume. Perhaps it's too ridiculous to be insulting. Perhaps somebody important likes the pasta. Perhaps burning down a restaurant for having faux-mafia décor would constitute admitting that the décor bothered them. Whatever the reason, Soprano's has received the most valuable endorsement available in Little Europe: the people being parodied have chosen not to kill anybody over it.

Naturally, this makes it irresistible to aspiring criminals. Low-level boosters hold meetings here because it makes them feel important. Wannabe Fixers occupy corner booths and cultivate mysterious expressions. Tourists whisper when somebody with obvious cyberware walks through the door, convinced they've just witnessed a genuine mobster. Occasionally, inevitably, an actual member of the Mob comes in for dinner, and the entire restaurant spends two hours pretending not to notice. That's the essential charm of Soprano's: everyone is playing gangster except the people who really are gangsters, and those people mostly just want you to stop staring at them while they eat.`,
  },

  a13: {
    image: "torrell-and-chiang",
    text: `In Night City, clothing can tell people how much money you have, who you work for, whether you're armed, and how difficult killing you is likely to be. Torrell & Chiang understand all four. Considered by many to be the finest bespoke tailors in Night City, their Little Europe headquarters combines manufacturing space with a discreet storefront catering to people for whom five thousand eurobucks is an acceptable price for a three-piece suit. A properly cared-for Torrell & Chiang piece is expected to last roughly twelve years, assuming bullets, blood, fire, acid, and Night City don't revise the schedule.

Their genius lies in making protection disappear. Torrell & Chiang specialize in concealed armor and stain-resistant treatments, producing clothing that belongs in an executive boardroom while quietly acknowledging that the board meeting may end in gunfire. The cut is precise. The materials are expensive. Armor panels disappear beneath tailoring that never makes the wearer look like they're attending negotiations dressed as a tactical refrigerator. They produce coats, waistcoats and trousers, among other bespoke pieces, while happily sending customers elsewhere for mundane accessories like shirts, socks and cufflinks. They also produce lingerie because apparently elegance, discretion, and ballistic paranoia need not end when the trousers come off.

Walking into Torrell & Chiang's feels different from entering most Night City shops. Nobody rushes you. Nobody needs to. The staff knows almost instantly whether you're buying, browsing, or pretending. Measurements are taken with forensic precision. Questions are polite but revealing: Where will you be wearing this? How much movement do you require? Do you expect trouble? A client might be an Exec, Fixer, Rockerboy, diplomat, high-end Solo, or criminal whose profession is never spoken aloud. Shears, one of the shop's known tailors, has likely fitted people who intended to attend funerals and people who intended to cause them. In another city, a beautiful suit is vanity. In Night City, the finest compliment Torrell & Chiang can receive is that nobody noticed the armor until the shooting started.`,
  },
};

/** The dossier for a district or location key, when one has been written. */
export function placeDossier(key: string): PlaceDossierEntry | undefined {
  return PLACE_DOSSIERS[key.trim().toLowerCase()];
}

/** Where the picture for a dossier lives. */
export function placeImage(entry: PlaceDossierEntry): string {
  return `/images/places/${entry.image}.png`;
}
