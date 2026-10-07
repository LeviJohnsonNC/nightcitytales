# Soundtrack

The music for Night City Tales, and how to make more of it in the same voice.
Generated with Suno (v6). Reference points the owner loves: Scandroid, Nine Inch
Nails, Gunship, The Midnight. Suno will not take artist names, so every prompt
describes the sound instead.

## How to enter a track in Suno

- **Lyrics box**: the Structure block below. `[Instrumental]` at the top is what
  keeps it instrumental; there is no switch.
- **Styles box**: the Styles line, which starts with `instrumental`.
- **More Options → Exclude styles**: the Exclude line.
- **Vocal Gender**: leave both unselected.
- **Duration**: Custom, the length given.
- **Max Mode**: On if credits allow.
- **Weirdness**: as given. **Style Influence**: 75% (85% if a take drifts).
- **Variety**: Normal. **Personalize**: Off.

Generate two to four takes and keep the best. Upload the chosen take through
Lovable under the exact file name, or commit the file itself into
`src/assets/creator/` (an `.m4a` or `.mp3`, not a `.wav`).

## One shuffled playlist, in the creator and the game

The creator does not give each step its own music. It used to, and it did not
survive play: a player spends thirty seconds on one step and ten minutes on the
next, so a cue either cut off before it went anywhere or looped until it wore
thin. Now every track plays one after another in a shuffled order, each fading
into the next over five seconds, and the order reshuffles when every track has
played (never opening on the one that just ended). Choosing "Enter Night City"
carries the track that is playing straight into the game, which takes the same
playlist up without a break: the player sits under the campaign header on a
desktop and in the status bar on a phone, and a player who pressed Stop stays
silent. The cold open ducks it for the descent and swells it back at the cut.

**Two playlists, told apart by file name.** NCAmp's playlist window has a
switch at the top. **NIGHT SHIFT** is the original score — every file named
`music-…`, all instrumental — and it is the one the player opens on, for
everybody, until they choose otherwise (the choice is remembered in their
browser). **RADIO FREE NIGHT CITY** is the songs with vocals — every file named
`radio-…`. Each plays on its own shuffle; switching crossfades into the new
list, or clears a paused player so Play opens it. Which names belong to which
list is `PLAYLISTS` in `src/features/music/soundtrack.ts`.

**Any file named `music-…` or `radio-…` is in a rotation.** Adding a song is an
upload, never a code change; `soundtrack.ts` finds them by name. A test checks
that every track has its prompt here, so write the prompt down when you add one.
A finished song with vocals that did not come from a Suno prompt we kept
(Radio Free's first nine) gets a short entry saying so rather than an invented
one.

**Give it a title.** NCAmp, the player in the creator's top bar, lists each
song by the title it has here. Add the new song's title to `SONG_TITLES` in
`src/features/music/trackTitles.ts` (a test fails until you do); a
track without one still plays, named after its file.

**A second take is `-v2` on the end** (`music-badlands-highway-v2.m4a`, then
`-v3`, and so on). Every take plays, never straight after another take of the
same song, and they all share the song's one prompt below.

What that asks of a track, now that any of them can play under any step:

- **Stay under the reading.** It plays at a third of full volume behind text
  the player is reading. A steady groove beats a big drop.
- **Three to four minutes.** Long enough to settle in, short enough that the
  mix keeps moving.
- **Start and end gently.** The crossfade covers the joins, but a track that
  opens on a hit or ends mid-phrase still lurches. `[Outro: …, gentle fade]` is
  fine now; nothing loops any more.

The first five were written as scene cues, and their names still say so. They
all play everywhere now.

### `music-meet.mp3` — "Rain on Glass"

Written for the meet. Duration 2:30. Weirdness 55%.

Structure:

```text
[Instrumental]
[Intro: rain and low drone]
[Sparse felt piano motif]
[Drone swells, distant sirens]
[Piano motif returns, quieter]
[Outro: rain and drone sustain, no fade]
```

Styles:

```text
instrumental, dark ambient industrial, heavy rain on glass, distant city hum and far-off sirens, detuned felt piano, deep sub-bass drone, granular textures, tape hiss, sparse and brooding, cinematic noir, 60 bpm, no drums
```

Exclude: `vocals, drums, upbeat, EDM, acoustic guitar, medieval, strings`

### `music-interview.mp3` — "The Back Booth"

Written for the interview. Duration 3:30. Weirdness 35%.

Structure:

```text
[Instrumental]
[Intro: warm pads and synth bass]
[Groove A: gated snare, steady]
[Saxophone phrase, sparse]
[Groove B]
[Groove A]
[Saxophone phrase]
[Outro: groove continues steady, no fade]
```

Styles:

```text
instrumental, nostalgic noir synthwave, slow late-night groove, warm analog pads, gated reverb snare, round fretless synth bass, lonely smoky saxophone used sparingly, rain-soaked city at 3am, melancholic but cool, steady and unobtrusive, 86 bpm
```

Exclude: `vocals, big drop, aggressive, trap hi-hats, dubstep, acoustic guitar`

### `music-people.mp3` — "Names You Know"

Written for the Lifepath's "who is still out there" chapter. Duration 3:00.
Weirdness 40%.

Structure:

```text
[Instrumental]
[Intro: pulsing bass]
[Build: cold arpeggios enter]
[Tension plateau: choir pads, industrial hits]
[Build]
[Tension plateau]
[Outro: pulse continues, no fade]
```

Styles:

```text
instrumental, darksynth, minor key, pulsing sequenced bassline, cold glassy arpeggios, industrial percussion hits, ominous choir pads, slow tension build that never fully releases, cinematic cyberpunk noir, 100 bpm
```

Exclude: `vocals, happy, major key, EDM festival, acoustic guitar`

### `music-build.mp3` — "Chrome and Muscle"

Written for the build. Duration 3:30. Weirdness 35%.

Structure:

```text
[Instrumental]
[Intro: bright arpeggio]
[Verse groove: punchy drums, octave bass]
[Lead synth hook]
[Verse groove]
[Lead synth hook]
[Bridge]
[Lead synth hook]
[Outro: groove continues, no fade]
```

Styles:

```text
instrumental, driving retro synthwave, bright analog arpeggios, punchy LinnDrum-style drums, rolling octave bassline, heroic lead synth hooks, confident forward motion, neon cityscape at night, 112 bpm
```

Exclude: `vocals, lo-fi, trap, dubstep, acoustic guitar, slow`

### `music-reveal.mp3` — "Night City Wants You"

Written for the reveal. Duration 2:30. Weirdness 40%. The loudest track in
the rotation; if it jumps out of the mix, it is the one to remake gentler.

Structure:

```text
[Instrumental]
[Short Intro: 4 bar riser]
[Drop: huge synth lead, gated drums]
[Anthem lead]
[Breakdown]
[Build]
[Drop]
[Outro]
```

Styles:

```text
instrumental, epic cyberpunk anthem, short riser into a huge cinematic synth drop, gated reverb drums, distorted industrial bass, soaring lead synth, triumphant and dangerous, neon night city skyline, 118 bpm
```

Exclude: `vocals, slow intro, lo-fi, acoustic, soft`

Optional vocal take: pick a Vocal Gender, drop `vocals` from Exclude and
`instrumental` from Styles, and use this Structure:

```text
[Short Intro: 4 bar riser]
[Drop]
(vocoder) Night City... wants you...
[Anthem lead]
[Breakdown]
(vocoder) Night City... wants you...
[Drop]
[Outro]
```

### Five more for the rotation

Written for the playlist rather than for a step, so each one is steady, sits
under text, and eases in and out. They spread the mix in different directions
so a long session does not blur into one track: a night drive, a market, the
desert edge, something colder and harder, and a slow after-hours one.

### `music-neon-arteries.mp3` — "Neon Arteries"

A night drive through the city. Duration 3:45. Weirdness 35%.

Structure:

```text
[Instrumental]
[Intro: filtered bass pulse fades in]
[Groove A: driving bassline, tight drums]
[Lead synth melody, restrained]
[Groove B: arpeggios join]
[Breakdown: pads and bass only]
[Groove A]
[Lead synth melody]
[Outro: drums drop away, pulse fades out gently]
```

Styles:

```text
instrumental, darkwave synthwave night drive, pulsing sixteenth-note analog bassline, tight gated drums, cool restrained lead synth melody, shimmering arpeggios, wet streets and passing headlights, hypnotic and steady, melancholic forward motion, 104 bpm
```

Exclude: `vocals, big drop, dubstep, trap, acoustic guitar, happy, festival EDM`

### `music-kabuki-market.mp3` — "Kabuki Market"

A crowded night market, noodles and stolen chrome. Duration 3:30. Weirdness 50%.

Structure:

```text
[Instrumental]
[Intro: plucked koto-like synth motif, rain]
[Beat enters: dusty trip-hop drums, deep bass]
[Motif and warm pads]
[Variation: glitchy vocal-less chops, distant crowd murmur]
[Motif returns]
[Outro: beat drops out, plucks and rain fade gently]
```

Styles:

```text
instrumental, cyberpunk trip-hop, Japanese-inflected plucked synth like a koto, dusty swung downtempo drums, deep warm sub bass, glitchy textures, humid neon night market ambience, distant crowd murmur, mysterious and laid-back, 88 bpm
```

Exclude: `vocals, anime pop, happy, EDM drop, acoustic guitar, orchestral`

### `music-badlands-highway.mp3` — "Badlands Highway"

The desert edge of the city, a nomad convoy at dusk. Duration 3:45. Weirdness 40%.

Structure:

```text
[Instrumental]
[Intro: wind and a long reverb-drenched guitar note]
[Groove: slow driving drums, warm synth bass]
[Baritone guitar melody over analog pads]
[Build: arpeggios and a second guitar line]
[Groove, wider]
[Baritone guitar melody]
[Outro: drums fall away, guitar and wind fade gently]
```

Styles:

```text
instrumental, outrun desert synthwave, clean twangy reverb-drenched electric baritone guitar, warm analog synth bass, wide dusky pads, slow driving drums, heat haze and long empty highway at sunset, lonely and cinematic, 96 bpm
```

Exclude: `vocals, country vocals, acoustic guitar, banjo, happy, EDM drop, metal`

### `music-chrome-heart.mp3` — "Chrome Heart"

Colder and harder: industrial, machines and ripperdoc steel. Duration 3:15.
Weirdness 45%.

Structure:

```text
[Instrumental]
[Intro: mechanical clanks and a low distorted drone]
[Beat: heavy mechanical kick, sequenced EBM bass]
[Metallic percussion and dark synth stabs]
[Breakdown: drone and machinery only]
[Beat returns, tighter]
[Outro: sequence stutters and powers down gently]
```

Styles:

```text
instrumental, industrial EBM, dark electronic body music, heavy mechanical kick, sequenced distorted bassline, metallic percussion and machine clanks, cold detuned synth stabs, restrained and menacing rather than loud, cyberware surgery and steel, 118 bpm
```

Exclude: `vocals, screaming, metal guitar, happy, EDM festival drop, acoustic guitar`

### `music-after-hours.mp3` — "After Hours"

Slow and late: an empty bar at 4am, the job done or not yet started. Duration
4:00. Weirdness 30%.

Structure:

```text
[Instrumental]
[Intro: electric piano chords, soft rain]
[Slow beat: brushed electronic drums, round bass]
[Muted trumpet-like synth lead, sparse]
[Electric piano solo, gentle]
[Slow beat]
[Lead returns]
[Outro: piano alone, rain, gentle fade]
```

Styles:

```text
instrumental, slow noir synth jazz, warm Rhodes electric piano, brushed electronic drums, round soft synth bass, sparse muted-trumpet-like synth lead, rain on a window, empty bar at 4am, intimate and weary, 72 bpm
```

Exclude: `vocals, upbeat, big drop, trap, acoustic guitar, swing big band`

### Five more, second round

Another spread. "Coyote Run" is the one that stays closest to "Badlands
Highway" — the same guitar, later at night and in more trouble. The others
go elsewhere: a corporate tower, a drowned resort, the Net, and the one
dawn in a playlist that is otherwise all night.

### `music-coyote-run.mp3` — "Coyote Run"

A nomad smuggling run across the border after dark, headlights off. The
darker sibling of "Badlands Highway". Duration 3:45. Weirdness 45%.

Structure:

```text
[Instrumental]
[Intro: desert wind, a low tremolo guitar swell]
[Groove: rolling toms, pulsing analog bass]
[Tremolo baritone guitar melody, spaghetti western]
[Build: dark arpeggios and a distant whistle-like synth]
[Groove, heavier]
[Guitar melody, doubled an octave up]
[Outro: drums drop away, tremolo guitar and wind fade gently]
```

Styles:

```text
instrumental, dark desert noir synthwave, spaghetti western tremolo baritone guitar drenched in spring reverb, rolling tom drums, pulsing analog synth bass, dark minor arpeggios, whistle-like synth lead used sparingly, moonlit border crossing with the headlights off, tense and cinematic, 92 bpm
```

Exclude: `vocals, country vocals, acoustic guitar, banjo, harmonica, happy, EDM drop, metal`

### `music-ninety-floors-up.mp3` — "Ninety Floors Up"

A corporate tower at night: glass, money and somebody watching. Sleek rather
than loud. Duration 3:30. Weirdness 35%.

Structure:

```text
[Instrumental]
[Intro: glassy bell motif, soft sub pulse]
[Groove: crisp minimal drums, sequenced bass]
[Bell motif and cold string-like pads]
[Variation: FM plucks answer the motif]
[Breakdown: bells and sub only]
[Groove]
[Outro: drums fall away, bell motif fades gently]
```

Styles:

```text
instrumental, sleek corporate cyberpunk, minimalist electronic, glassy FM bell motif, crisp minimal drums, tight sequenced synth bass, cold string-like synth pads, polished and expensive, quietly sinister, penthouse office above a neon skyline, 108 bpm
```

Exclude: `vocals, big drop, dubstep, trap, acoustic guitar, happy, orchestral`

### `music-drowned-arcade.mp3` — "Drowned Arcade"

Pacifica: a resort that was never finished, half flooded, the arcade signs
still flickering. The slowest and dreamiest in the rotation. Duration 4:00.
Weirdness 55%.

Structure:

```text
[Instrumental]
[Intro: waves, a detuned chord through tape echo]
[Dub pulse: soft kick, deep round bass]
[Echoing chord stabs and warbling pads]
[Variation: a faded arcade melody, chorus and delay]
[Dub pulse]
[Outro: beat drops out, echoes and waves fade gently]
```

Styles:

```text
instrumental, dub techno vaporwave, deep round sub bass, soft muffled kick, echoing chord stabs through tape delay, warbling detuned pads, faded arcade melody drowned in chorus, ocean waves, abandoned beach resort at night, flickering neon, hazy and melancholic, 80 bpm
```

Exclude: `vocals, upbeat, big drop, trap, acoustic guitar, happy, hard techno`

### `music-black-ice.mp3` — "Black ICE"

A netrunner jacked in: data, speed and something waiting in the dark. The
most propulsive in the rotation, still steady enough to read over. Duration
3:30. Weirdness 45%.

Structure:

```text
[Instrumental]
[Intro: data chatter, a filtered arpeggio fades in]
[Groove A: breakbeat drums, driving sequenced bass]
[Cold lead synth hook]
[Groove B: second arpeggio, glitch fills]
[Breakdown: arpeggio and pads only]
[Groove A]
[Cold lead synth hook]
[Outro: drums fall away, arpeggio filters down gently]
```

Styles:

```text
instrumental, darksynth breakbeat, fast sequenced analog arpeggios, chopped breakbeat drums, driving distorted synth bass, cold digital lead synth hook, glitch fills and data chatter, netrunner diving through black ICE, focused and relentless but not loud, 124 bpm
```

Exclude: `vocals, dubstep wobble, EDM festival drop, trap, acoustic guitar, happy, metal`

### `music-first-light.mp3` — "First Light"

Dawn over the city after a long night. The one warm, hopeful track in the
rotation, bittersweet rather than bright. Duration 3:45. Weirdness 30%.

Structure:

```text
[Instrumental]
[Intro: soft synth pads swell, distant traffic]
[Groove: warm gated drums, round synth bass]
[Chorused clean guitar melody]
[Lead synth answers the guitar]
[Groove, fuller]
[Guitar and lead together]
[Outro: drums drop away, pads and guitar fade gently]
```

Styles:

```text
instrumental, nostalgic dreamy synthwave, warm lush analog pads, chorused clean electric guitar melody, gated reverb drums, round warm synth bass, soaring gentle lead synth, sunrise over a tired city after a long night, bittersweet and hopeful, 100 bpm
```

Exclude: `vocals, big drop, aggressive, trap, dubstep, acoustic guitar, metal`

## Radio Free Night City

The songs with vocals, in a playlist of their own so the score can stay what it
is: something that sits under the reading. These are the opposite — songs to be
listened to — which is why they are not mixed into the rotation above. They
were added as finished `.m4a` files; the Suno prompts and lyrics were not kept
here, so each entry below records the title only. Add the prompt when one turns
up. Files are `radio-<title-in-kebab-case>.m4a`; the player's titles are in
`SONG_TITLES` (`trackTitles.ts`).

### `radio-bad-for-business.m4a` — "Bad for Business"

### `radio-dead-man-dancing.m4a` — "Dead Man Dancing"

### `radio-heavens-got-a-back-door.m4a` — "Heaven's Got a Back Door"

### `radio-hotwire-me.m4a` — "Hotwire Me"

### `radio-like-you-stole-me.m4a` — "Like You Stole Me"

### `radio-nice-try.m4a` — "Nice Try"

### `radio-one-more-first-time.m4a` — "One More First Time"

### `radio-take-me-nowhere.m4a` — "Take Me Nowhere"

### `radio-tell-me-im-good.m4a` — "Tell Me I'm Good"

## No Quiet Hours

An album: ten songs with vocals, in a playlist of their own, and the one playlist
with a running order. NCAmp lists it in that order and plays it front to back
whenever shuffle is off; with shuffle on it shuffles like the others. The order
is `order` on the playlist in `soundtrack.ts`, by file name. Files are
`quiet-<title-in-kebab-case>.mp3`; the titles are in `SONG_TITLES`
(`trackTitles.ts`). They were added as finished files, so each entry records the
title only.

1. `quiet-the-night-wants-us.mp3` — "The Night Wants Us"
2. `quiet-looks-like-trouble.mp3` — "Looks Like Trouble"
3. `quiet-touch-without-a-trace.mp3` — "Touch Without a Trace"
4. `quiet-a-little-more.mp3` — "A Little More"
5. `quiet-make-it-feel-real.mp3` — "Make It Feel Real"
6. `quiet-in-the-blackout.mp3` — "In the Blackout"
7. `quiet-not-yours-to-keep.mp3` — "Not Yours to Keep"
8. `quiet-call-me-back.mp3` — "Call Me Back"
9. `quiet-ours-until-morning.mp3` — "Ours Until Morning"
10. `quiet-the-city-can-wait.mp3` — "The City Can Wait"

## Elsewhere in the game

- `neon-storm-front.mp3`: the combat track, played under the battlefield by
  `src/features/play/useCombatFeedback.ts`. While it is audible the playlist
  steps aside (`holdMusic`, which fades it out and leaves it where it was) and
  comes back after (`releaseMusic`); the player's marquee says what is holding
  it. A player who asks for music by name during a fight (Play, Next, a track in
  the list) gets it, and the hold ends.
