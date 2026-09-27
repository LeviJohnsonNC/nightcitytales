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

Generate two to four takes and keep the best. Cues that loop should hold a
steady groove to the very end; the reveal should land its first drop fast.
Upload the chosen take through Lovable under the exact file name. A cue with no
file is silence, so tracks can arrive in any order.

Where they play is `src/features/chargen/music/soundtrack.ts`.

## Character creation

### `music-meet.mp3` — "Rain on Glass"

The Meet: choosing a fixer. Duration 2:30. Weirdness 55%.

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

Role, method and the Lifepath. Loops. Duration 3:30. Weirdness 35%.

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

The Lifepath's "who is still out there" chapter. Loops. Duration 3:00.
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

STATs, Skills, gear, chrome, home and name. Loops. Duration 3:30.
Weirdness 35%.

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

The file read back, carrying on into night one. Plays once. Duration 2:30.
Weirdness 40%.

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

## Elsewhere in the game

- `neon-storm-front.mp3`: the combat track, played under the battlefield by
  `src/features/play/useCombatFeedback.ts`.
