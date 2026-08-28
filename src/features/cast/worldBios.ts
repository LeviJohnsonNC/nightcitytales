/**
 * Dossier text for the wider world: the fixers who hand out jobs, the patrons
 * paying for them, named targets, factions and the hostile archetypes you meet
 * at the wrong end of an alley.
 *
 * Written by hand in the house voice (see src/lib/prose-style.ts). Presentation
 * copy only. No rules data lives here, and the engine never imports it.
 */

export const WORLD_BIOS: Record<string, string> = {
  // ── Job-giving fixers ─────────────────────────────────────────────────────
  "rogue-amendiares": `The Queen of the Afterlife. Rogue came up as a solo in the ugliest decade this city ever had, ran with the worst and loudest people in it, and did the one genuinely impossible thing: she got old. When the shooting stopped she bought a club built in a converted morgue, put her name over the door in nothing at all, and turned the place into the closest thing Night City has to an institution.

The Afterlife runs on a single rule, and it is the rule that made her: drinks are named after dead legends, and you do not get one named after you until you have earned it. That is not decoration. That is a filing system for reputation. Every merc who matters in this city has stood at that bar waiting to find out what they are worth, and Rogue has been quietly deciding, for years, in public.

She still brokers, selectively, at rates that reflect exactly how much she does not need your business. Work for Rogue and you get clean intel, honest terms and zero patience. She has heard every excuse a gun for hire can produce, usually from people who are now drinks. Waste her time once and you are welcome to keep coming to the club. You will simply never be offered anything again.`,

  "wakako-okada": `Wakako Okada is Westbrook, and Westbrook is Tyger Claws territory, and she has spent a very long career making both of those facts work for her. She holds court in a pachinko parlor, sits behind a low table, pours tea, and speaks to hardened killers exactly like a disappointed aunt. It works far better than shouting ever did.

Her network runs through the entertainment district: club owners, braindance studios, hostess bars, ripperdocs with celebrity clientele, and a large number of young people who owe her for a debt she settled before it became a problem. Wakako's specialty is delicate work in places with money. Retrieval, escort, persuasion, the quiet removal of an embarrassment. She has an eye for who a job will actually break, and she matches people carefully.

Understand the terms before you accept. Wakako is scrupulously fair on payment and completely unsentimental about protection: she has connections she cannot spend on you, and she will tell you so up front rather than let you assume. Cross the Claws on one of her jobs and she will not lie for you, she will not warn them either, and she will absolutely still expect the work done.`,

  "sebastian-padre-ibarra": `They call him Padre because he works out of a church, and the church is real, and so, in his own peculiar way, is he. Sebastian Ibarra keeps the lights on in a Heywood parish that the diocese quietly gave up on, and he pays for it by brokering work for the people who live around it. He does not consider this a contradiction and will happily explain why over bad coffee.

His jobs come with conditions. No collateral damage in his neighborhood. Nobody's family touched. Kids stay out of it. Break one of those and the money still arrives, because a deal is a deal, and then the door closes forever. Padre's local intelligence is unmatched in Heywood because half the district talks to him about things they would never tell a fixer, and he keeps that line very clearly in his own head even when nobody else can see it.

He is also the man who buries people who cannot afford it, sits with the families, and knows precisely which of the bodies he is burying came out of a job he arranged. Padre is not at peace about any of this. He is simply the only person doing it.`,

  "dakota-smith": `Dakota Smith works the Badlands, which means she works the thing the city pretends does not exist: everything comes in on a road, and every road belongs to somebody. She sits in a dust-caked outpost with a rooftop of antennas, runs her business over radio as much as agent, and knows which convoys are running, which crews are hungry, and which stretch of highway is currently a bad idea.

She is nomad by upbringing and blunt by policy. Dakota will tell you your plan is stupid, tell you why, and then help you do it anyway if you insist, because she is a professional and it is your funeral. Her contracts skew toward escort, recovery, hardware runs and the kind of work where the real enemy is distance, heat and a vehicle with no coolant.

Where she becomes genuinely valuable is the network behind her. Dakota can put you in touch with people who move things the corps have decided should not move, and she vouches for you personally when she does it. That vouch is the most expensive thing she owns. Waste it and you will discover exactly how large the Badlands are and how few friends you have out there.`,

  "regina-jones": `Regina Jones was a journalist before she was a fixer and she has never really stopped. She works out of Watson, keeps an obsessive eye on the district's data feeds, and treats her contract board as an editorial beat: who is missing, what went wrong on Sixth Street last night, which chromed-out unfortunate has stopped answering calls and started hurting people.

Her jobs are cheaper than the glamour work and considerably more useful to the neighborhood, which is her whole point. Regina cares about Watson in a way that most fixers find embarrassing. She would rather pay you to bring somebody in alive, and she will make that preference clear in the brief, and she will notice if the answer keeps coming back dead.

She is not naive. Regina has been in this city long enough to know what she is buying and from whom, and she keeps files on every operator she hires. Do good work for her and you get steady, unglamorous, reliable money and a fixer who will actually pick up at four in the morning. Lie to her about how a job went and you will find out what a career built on sources does to a person's memory.`,

  "guadalupe-mama-welles": `El Coyote Cojo is a Heywood bar with a limping coyote over the door, good food, and a proprietor who has been refusing to retire for longer than most of her regulars have been alive. Guadalupe Welles, Mamá to everyone including people she has thrown out, runs the room and quietly runs a fair amount of the block along with it.

She is Heywood to the bone: Valentinos drink in her place, respect the house, and take their business outside when she looks at them. Mamá does not broker like a fixer. She mentions things. Somebody's cousin needs a hand, a delivery needs an escort, a girl in the next building has a problem with a man, and the mention lands in front of the right person at the right table with a plate of food next to it.

Payment is usually less than the work is worth and comes with something you cannot buy: standing in a neighborhood that closes ranks. People who look after Mamá's people eat free forever and get warned when trouble is coming. People who take advantage of her generosity find that Heywood is a very small place with a very long memory.`,

  // ── Patrons and clients ───────────────────────────────────────────────────
  "adele-voss": `Adele Voss works in Arasaka Subcontracts, which is a department designed so that the words "Arasaka" and "you" never appear in the same document. She is the buffer. Her job is to convert a requirement from somewhere upstairs into a contract with a freelancer, execute it, and leave a paper trail that terminates in a shell company nobody has ever visited.

She is immaculate, pleasant, and entirely made of process. Meetings happen in leased conference space with the building's own catering. She will use the phrase "asset recovery" about a person. She will not answer a question about who the client is, not out of cruelty but because she genuinely has not been told and considers not knowing to be a professional virtue.

Her contracts pay extremely well and are enforced with the full weight of a legal department that could bury your fixer's fixer. Deliver and you get paid to the minute. Improvise, exceed scope, leave anything traceable, and the same machinery turns around with no change in tone. Adele will be just as courteous during the conversation where she explains that you are now a liability being managed.`,

  "emil-kovac": `Emil Kovač owns a salvage yard on the industrial edge of the city and buys, in his words, whatever falls off. Vehicles, machinery, prefab structures, the contents of an office that went bankrupt on a Tuesday, and quite often things that were still bolted down at the time. He is loud, filthy, hilarious, and much richer than the yard suggests.

He hires street muscle for street reasons. Somebody is stripping his fence line. A load needs collecting from a lot with a very short window before the receivers arrive. A rival yard has an item he considers to be, spiritually, already his. Kovač briefs badly, gets numbers slightly wrong, and always has a second forklift's worth of complication he forgot to mention.

He also pays cash on the same day, feeds you, and treats a merc like a tradesman rather than an appliance. That counts for a lot. Kovač has a long-standing feud with the scavvers who work the same corridor, and he is very clear that anyone who works for him is expected to have an opinion about it. Ask about the fingers on his left hand at your own risk. It is a forty minute story.`,

  "dr-priya-raman": `Dr. Priya Raman does not treat anyone. She works billing and recovery for a Trauma Team subscription operation, which is a polite way of saying she is the person who finds out where the client went after the extraction and who is going to pay for the helicopter. Emergency medicine at the top of the market runs on invoices, and the invoices have to be enforced.

She hires freelancers to do the parts an insurer cannot: locate a lapsed subscriber, recover leased hardware from a body the family did not report, verify that a claim actually happened the way the claim says. It is grim, well-documented, and shockingly lucrative. Raman briefs like a case file, expects photographic confirmation, and considers emotion in a report to be noise.

There is a person under there somewhere. She was a working physician once and does not discuss why she is not one now, and she has been known to quietly waive a pursuit on a file where the numbers were fine and something else was not. Never ask her to do it. Contractors who try to negotiate her ethics get replaced with contractors who do not.`,

  "the-quartermaster": `You have never seen the Quartermaster and you never will. The contact is a voice on a scrambled channel, flat, unhurried, faintly amused, using a callsign rather than a name. The work is Militech-shaped without ever being Militech: hardware moved, a competitor's shipment delayed, a site surveyed, a specific crate that must arrive intact and unopened, all of it deniable down to the last screw.

The briefings are extraordinary. Precise coordinates, current patrol patterns, contingency instructions, an abort phrase. Whoever is on the other end has access to intelligence that a freelancer has no business receiving, and the sheer quality of it is the reason people keep answering. Payment lands early. There is never a haggle.

The catch is that you are one component in something you cannot see, and components get replaced. Crews have completed flawless jobs for the Quartermaster and then found the drop-off site under observation, or been told, calmly, that the schedule has changed and to leave the item where it is and walk. The voice never explains. There is a standing theory that there is no single person at all, just a desk with a rota.`,

  "odalys-ferrer": `Odalys Ferrer is media relations for Night Corp, which means she manages what this city believes about itself. Her official job is press liaison and community engagement. Her actual job is making sure that certain footage never trends, certain neighborhoods photograph well, and certain incidents get reported as weather.

She is warm, funny, deeply fluent in gossip, and utterly relentless. Odalys will hire you to retrieve a braindance master before it is copied, to persuade a witness that an interview is a bad idea, to be visibly present at a location so that a rival's story falls apart, and she will frame every single one of those as helping people. The unsettling part is how often she has a point.

She pays through legitimate-looking consultancy invoices, which is a genuine convenience, and she keeps her freelancers at arm's length in public and remembers them in private. Get on her good side and unflattering things about you stop appearing on feeds. Get on the other one and you will discover that a media apparatus does not need to lie about you. It just has to be selective.`,

  "toshiro-bell": `Toshiro Bell is an independent ripperdoc with a taste for the experimental, and he is upfront about the fact that the two words in that sentence are doing a lot of work. He designs. He fabricates. He runs a clinic that looks like a machine shop with a bed in it and a wall of prototypes that he will happily talk about for hours to anyone who shows the slightest interest.

He hires runners because innovation needs inputs. Specific components that are export controlled. Research data from a lab that is not selling. A unit recovered from somebody who is done using it. Bell will describe exactly what he needs, in loving detail, with no apparent awareness that he is asking for a felony, and then thank you sincerely when it arrives.

His prices for installation work are startlingly low if you are one of the people who fetches for him, which is how he builds a client base. It is also how he builds a test population. Bell is not a butcher and he does not lie about risk, but he is a man who wants to see what happens, and he will always be a little more excited than the situation warrants.`,

  // ── Named target ──────────────────────────────────────────────────────────
  "cira-nwosu": `Cira Nwosu is a records clerk. That is the whole thing. She worked a desk in an unglamorous office reconciling shipping documentation, she noticed that a set of numbers did not reconcile, and instead of doing the sensible Night City thing and forgetting immediately, she made a note. Then she made another. Then she kept them somewhere that was not her workstation.

She is not a spy, an activist or a whistleblower. She is a careful person with good handwriting and an inconvenient sense that things should add up, and she is now the most expensive problem several people have. There are contracts out on her that describe her as an asset, a liability and a witness, sometimes in the same brief, and at least three parties want different outcomes.

Meet her and you will find someone entirely out of her depth doing surprisingly well. She has moved twice, changed her routine, stopped using her agent, and she is scared in the controlled way of someone who has decided not to fall apart until later. She will ask you, directly, what happens to her after. Have an answer ready. She will know if you do not.`,

  // ── Factions ──────────────────────────────────────────────────────────────
  maelstrom: `Maelstrom believes flesh is a rough draft. They came out of Northside as the survivors of a gang war that should have finished them, rebuilt themselves out of stolen medical stock, and turned that necessity into an entire theology of chrome. Red optics, exposed cabling, faces rebuilt into something that photographs badly on purpose. If it can be replaced, they have replaced it, and if replacing it hurt, that was part of the point.

They run guns, drugs and bodies out of Watson and hold territory the way a machine holds a grudge. Negotiation with Maelstrom is possible, occasionally even reliable, because they do like money and they do buy hardware. It is also completely unpredictable, because you are dealing with individuals who are running very hard on the edge of their own heads and have made a virtue of not slowing down.

Fighting them is a specific kind of ugly. They are armored, they are wired, they do not disengage for reasons that would make anyone else disengage, and they get louder the worse it goes. Every experienced merc in Night City has a rule about Maelstrom. The rule is always some version of: do not start it in their building.`,

  "tyger-claws": `The Tyger Claws own the night in Japantown, and they own it in the way a landlord owns a block: quietly, comprehensively, and with paperwork somewhere. Clubs, bars, braindance studios, hostess houses, a large slice of the entertainment economy in Westbrook, all of it running under a syndicate structure that is far older and far more organized than the street-level gang it resembles.

They dress the part. Neon-lit synthleather, gleaming chrome arms, sculpted bikes that you hear four blocks out, and blades, always blades, because the Claws have a cultural preference for making it personal. Underneath the styling is discipline. They have a hierarchy, they have territory agreements, they collect on schedule, and their reprisals are proportionate right up until the moment they are meant to be a message.

Doing business in Westbrook means doing business adjacent to them whether you planned to or not. They are decent partners on anything that protects their revenue and implacable about anything that touches their standing. Take a job that embarrasses the Claws in their own district and the problem does not stay in that district. They have a long reach and an extremely good memory for faces.`,

  "6th-street": `Sixth Street started as veterans coming home from a war to a city that had stopped functioning, deciding that if the police were not going to protect the neighborhood then they would. That story is true. That is exactly what happened, and in parts of Santo Domingo they are still the reason a street is safe to walk at night, and they will tell you so.

The rest of the story is what happens when a militia funds itself. There are tolls that are not taxes. There is protection that has a price attached. There are trucks moving things that a neighborhood watch has no business moving, and there is the specific arrogance of armed men who believe absolutely in their own legitimacy. They wear the flags, they keep the uniforms, they run the vehicles, and they hold parades.

Deal with Sixth Street respectfully and they are among the most predictable groups in the city: they honor agreements, they defend their own, and they do not much like random violence. Treat them as a gang to their faces and you will get the full patriotic lecture, followed by everything that comes after the lecture.`,

  "corporate-security-officer": `Corporate security is not a gang and forgetting that gets people killed. These are salaried professionals with matching kit, real training, real communications, and a policy manual that tells them exactly what to do when someone like you turns up on a floor you were not invited to. They are not brave, they are not personally invested, and they are not going to fight you fairly. They are going to withdraw to a chokepoint, call it in, and wait for the response team.

The gear is uniform and the tactics are worse news than the gear. Layered armor, standardized weapons, cameras that they are actually watching, and a habit of moving in pairs on a schedule. Individually, most corpo security are unremarkable operators having an average day at work. Collectively, in a building designed by their employer, they are a system, and systems do not panic.

There is one reliable exploit and every runner knows it: they are employees. They will absolutely take cover, absolutely follow procedure, and absolutely not chase you past the property line, because nothing in their contract pays for that. Make it expensive, make it slow, and let the incident report be someone else's problem.`,

  "militech-contractor": `Militech does not send its own people to do deniable work in Night City, because Militech sells arms to governments and cannot be seen kicking in doors on a Tuesday. It sends contractors. Ex-military, well paid, kitted out of a catalogue that ordinary mercs read like pornography, and hired through enough intermediaries that the invoice is a work of fiction.

They are the most professional opposition a freelancer is likely to meet. They breach properly. They cover each other properly. They carry surplus military hardware in calibers that make a difference, and they arrive with an actual plan and a fallback for it. Nobody is showboating, nobody is monologuing, and nobody is going to take a stupid risk to look good in front of the crew.

The upside, if you can call it that, is that they are on the clock. Contractors are paid for an objective, not for revenge, and once the objective is unachievable or the exposure gets too expensive, they pull out cleanly and go home. Beat a Militech contract team and they will not hunt you. The people who hired them, however, are a completely separate conversation.`,

  // ── Hostile archetypes ────────────────────────────────────────────────────
  "street-thug": `The street thug is not a soldier, a professional or a member of anything. He is a person in a bad month with a cheap weapon and a plan that extends about ninety seconds into the future. He works alone or in a loose pair, he picks targets who look distracted or drunk or lost, and he does his real work with volume and proximity rather than skill.

Do not romanticize it and do not underestimate it either. A knife in a stairwell has ended a lot of promising careers that survived far more dangerous rooms, because armor helps least when you did not know it was starting. Thugs go for the surprise, the grab, the shove into a doorway, and they will absolutely run the instant the situation turns into an actual fight.

That is the practical read: this is the one category of Night City violence that reliably de-escalates. Look like work and most of them find somewhere else to be. Draw and the majority are gone. The ones who do not run are the ones who are desperate rather than opportunistic, and desperate people make choices that no risk assessment covers.`,

  scavver: `Scavengers harvest people. That is the business, stated plainly, with no gang mythology attached. They take someone off a street where nobody is watching, strip out the chrome, the organs and anything else the black clinics will buy, and dispose of the remainder. They favor the alleys behind clubs, the transport stops in dead districts, and anyone whose absence will not generate a report.

They work in crews, they carry restraints and sedatives alongside weapons, and they are equipped for capture rather than combat, which is the only good news in this entry. A scavver would much rather have you unconscious and intact than dead, because dead is worth less. That changes how they fight: nets, shocks, numbers, and a van running somewhere close by.

Everyone in Night City hates them, including the other gangs, including people who do genuinely appalling things for a living. Fixers pay bounties on scavver operations that nobody has to justify. Ripperdocs who buy from them do it quietly and lie about it. If there is a single act of violence in this city that will never cost you standing anywhere, it is this one.`,

  ganger: `The ganger is the working infantry of Night City's street economy. Colors, corner, crew, a weapon that is probably secondhand, and a genuine loyalty to a set of people that outsiders consistently underestimate. He is not there to be dramatic. He is there because that corner is worth money to somebody and it is his shift.

Combat with gangers is mostly about territory and audience. They are far more likely to escalate in front of their own people than alone, they will not back down where backing down is visible, and they have a very developed instinct for whether an outsider is disrespecting the block or just passing through. A lot of gang violence is a negotiation conducted badly, and quite a lot of it can be conducted better.

They also do not forget, because they cannot afford to. Killing one ganger is a tactical event with strategic consequences: there are more of them, they live here, and you probably have to come back down this street. Every experienced operator in this city has at some point paid a gang for something that a rookie would have shot their way past.`,

  "boostergang-chromer": `The chromer is what happens when the chrome becomes the personality. Boostergang members buy hardware faster than their heads can absorb it, tune themselves up before a night out, and go looking for a reason. Reflex boosters, subdermal plate, blades in the arms, optics that make the whole face wrong, and an aesthetic built entirely around being visibly dangerous at a distance.

Fighting one is a speed problem. They close, they hit disproportionately hard for a street-level opponent, and they are extremely difficult to make afraid, because backing off is precisely the thing their entire self-image forbids. They also frequently have no tactical discipline at all, do not use cover in any serious way, and will charge into an obviously bad angle because charging is the point.

That is the handle. A chromer will take the bait every single time. Position first, let them come to you, and be somewhere that rewards a prepared shooter over a fast body. The ones who survive long enough to learn better generally stop being chromers and start being solos, and by then they will have replaced almost everything they were born with.`,
};
