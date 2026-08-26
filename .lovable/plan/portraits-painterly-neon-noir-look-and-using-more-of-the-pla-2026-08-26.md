# Portraits: painterly neon-noir look, and using more of the player's choices

## Critique of the style prompt you pasted

It is a great *environment* prompt and a bad *portrait* prompt as written. Three
things in it actively fight a character close-up:

- "Cinematic ultra-wide" and "epic scale / dense vertical city" pull the camera
  back until the character is a speck.
- "Small human figures may appear for scale, usually silhouetted or viewed from
  behind" is the opposite of a face you can recognise on a roster card.
- "Large areas of atmospheric negative space, often sky or haze" wastes a 3:4
  frame that should be filled with head and shoulders.

Everything else in it is worth keeping and is a real upgrade over the current
"grainy photographic realism, street photojournalist's flash" look: the
painterly matte-painting finish, the navy/cobalt/cyan/violet/magenta palette
with a warm sunset accent, wet chrome and rim light, volumetric haze, and the
retrofitted-onto-an-old-city grime. That grime rule is exactly Cyberpunk RED.

So: adopt the *rendering, palette, lighting and material* language; drop the
*framing and scale* language; keep the city only as a shallow, hazy backdrop
behind the subject.

Second critique, on the current prompt itself: it says "Grainy photographic
realism" and "no anime styling" in the same breath as neon noir, which is a
muddled instruction — the model splits the difference and the roster ends up
looking like stock photography. One committed rendering style reads better and
stays more consistent across characters.

## Player choices that should show up but don't

Today the portrait only sees: Role, Role Ability, pronouns, and five Lifepath
glance tables (personality, clothing style, hairstyle, affectation, cultural
origin), plus the optional self-description.

Missing, in order of visual payoff:

1. **Cyberware installed.** The single biggest omission. A character who bought
   Cybereyes, a Cyberarm, Neural Link ports or Chrome should visibly wear them.
   Only externally visible pieces get described; internal implants stay
   invisible, as they should.
2. **Fashion bought on the Lifestyle step.** The player literally spends money
   choosing a Fashion style (Generation Gap, Gangsta, Bag Lady, etc.) per slot.
   That should beat, or at least sit alongside, the rolled Clothing Style.
3. **Worn armor.** A Light Armorjack over street clothes reads completely
   differently from a Kevlar vest or nothing at all.
4. **Signature weapon, carried not aimed.** Holstered or slung, never pointed at
   camera — a Solo with a heavy pistol on the hip is a different picture.
5. **Humanity loss.** A heavily chromed, low-Humanity character should look
   colder and harder-eyed. Subtle, one clause, no horror-show.
6. **Body type from STATs.** High BODY reads as heavy-built, low BODY as wiry.
   One adjective, derived from the number, not invented.
7. **Role-specific Lifepath flavour** where it is visual (a Nomad's family
   markings, a Rockerboy's stage look, a Media's press rig).
8. **Lifestyle/housing tier** as a faint condition cue — cared-for vs. worn.

Deliberately left out: skills, money totals, and any narrative Lifepath entry
about events (enemies, tragic love, life goals). Those do not draw.

## The plan

**1. Rewrite the house look.**
Replace the `HOUSE_LOOK` constant in `src/features/chargen/portraitPrompt.ts`
with a portrait-scoped version of your prompt: painterly digital
oil-painting/matte-painting finish with visible brush texture, waist-up single
subject filling a 3:4 frame, neon-noir palette (deep navy, cobalt, electric
cyan, violet, magenta, hot pink, one warm sunset or rose accent), strong
coloured rim light, soft neon bloom, wet chrome and reflective metal, shallow
hazy megacity backdrop dissolving into fog behind the shoulders, grounded and
lived-in with aging metal and grime, late-80s/90s cyberpunk anime and Blade
Runner noir in spirit. Negatives stay: no text, no logos, no watermark, no
weapons aimed at camera, no extra people, no collage. The "small figures for
scale / ultra-wide / large negative space" clauses are not carried over.

**2. Widen the facts the prompt is built from.**
Extend `buildPortraitFacts` so it also reads, from the state that already
exists: visible cyberware installs, bought fashion lines, worn armor, a carried
weapon, Humanity band, BODY-derived build, visual role-specific Lifepath
entries, and lifestyle tier. Each becomes one labelled fact line, exactly as the
Lifepath facts do now. Nothing is invented: if the player did not buy it, the
line is absent, and the existing "Render exactly the person described. Do not
add gear, tattoos, or cybernetics that were not described." rule stays and gets
stronger for it.

**3. Keep the guard rails.**
`PortraitFacts` grows fields; the Zod schema on
`src/routes/api/generate-portrait.ts` grows with it, with the same length and
array caps so the prompt cannot be stuffed from the client. The fact list cap
goes from 12 to ~20.

**4. Tests.**
Extend `src/features/chargen/__tests__/portraitPrompt.test.ts`: visible
cyberware appears, internal-only cyberware does not, bought fashion overrides
rolled clothing style, an unarmed/unarmored character produces no armor or
weapon lines, and the painterly style tags are present.

## Technical notes

- Files touched: `src/features/chargen/portraitPrompt.ts` (main change),
  `src/routes/api/generate-portrait.ts` (schema), the portrait prompt test. No
  UI, model, cost, storage or store changes — `PortraitStudio`, the streaming
  route, the takes cache and the 6-generation cap all stay as they are.
- Model stays `openai/gpt-image-1-mini` at `quality: "low"`, `1024x1536`,
  streaming with one partial frame.
- No Cyberpunk RED rules values are invented; cyberware, armor, weapon and
  lifestyle names come from the existing loadout state and rules JSON, and the
  visible/internal split is a presentation list kept in the prompt module.
- Existing portraits already generated are untouched; the new look applies to
  the next generation.
