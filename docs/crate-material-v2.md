# Crate material revision 2

2026-10-11. The user requested a calmer finish for the industrial crate.
Source: `public/images/combat/night-shift/cargo-states.webp`.
Edit generated with the imagegen skill/tool from that source atlas. Instruction:
preserve all three equal cells, exact camera, silhouette, ground contact and damage
states; broad matte olive panels, dark blue-grey frames, readable seams and latches,
sparse corner wear; remove dense silver speckle and decorative LED accents; true alpha.

Output: `public/images/combat/night-shift/cargo-states-v2.webp`, 2172×724 RGBA,
three 724px cells. Encoded losslessly without resizing via Sharp, matching the
sprite-atlas settings in `tools/art/webp.mjs`. Original atlas remains in place.
The source key and existing crop/registration stay unchanged; preload selects the
versioned URL. This is presentation-only for all scenes using the cargo atlas.

Generated PNG retained locally at:
`/Users/levijohnson/.codex/generated_images/01a12b66-843f-7a70-86c1-77681c3d2c1f/exec-fa86f1b5-6ab2-4eff-b95a-3bb7091aef7a.png`.

## Matching repair workbench

The reused procedural workbench was visibly flat in the actual scene, so the street
art override now supplies a matching painted bench, vise, tools and spare parts.
`public/images/street-props/workbench-states-v1.webp` is a lossless 2171×724 alpha
atlas. Rounded thirds retain all source pixels (724/723/724px cells). Ground contact
is measured at x≈308/724, y≈652/724 with 0.88 frame-width registration; damage states
keep that registration. Only rotation0 is supplied; rotation90 and missing art retain
the existing procedural fallback. Existing indoor scenes retain their original kit.
Prompt used the new crate atlas as its camera/material reference; requested a low
olive drawer/shelf workbench, dark wood top, small vise, repair parts and rag, intact,
damaged and collapsed states, no floor/shadow/glow, matching footprint and true alpha.
Generated source: `/Users/levijohnson/.codex/generated_images/01a12b66-843f-7a70-86c1-77681c3d2c1f/exec-f4b4e079-da38-4369-a1b2-ce08849dd057.png`.
