# Cyberware that still needs an image

30 of 96 cyberware items have art; 66 still need it. Pictures live in `public/images/cyberware/<id>.webp` (with a `-512` twin) and are registered in `src/data/art/manifest.json` under `itemArt` as `cyberware.<id>`.

To add one: drop `<id>.png` in `public/images/`, move it to `public/images/cyberware/`, run `node tools/art/webp.mjs public/images/cyberware --widths=1024,512`, and add its manifest entry. `src/features/chargen/__tests__/artFiles.test.ts` fails if an entry names a file that is missing.

Items marked ★ share an id with a **gear** picture that already exists (keyed `gear.<id>`, so it is not used for the cyberware version), which could be reused or restyled.

## Still needed

### Neuralware (2)

- Chemical Analyzer (`chemical_analyzer`) ★
- Memory Chip (`memory_chip`) ★

### Cyberaudio (12)

- Cyberaudio Suite (`cyberaudio_suite`)
- Amplified Hearing (`amplified_hearing`)
- Audio Recorder (`audio_recorder`) ★
- Bug Detector (`bug_detector`) ★
- Homing Tracer (`homing_tracer`) ★
- Internal Agent (`internal_agent`)
- Level Damper (`level_damper`)
- Radio Communicator (`radio_communicator`) ★
- Radio Scanner / Music Player (`radio_scanner_music_player`) ★
- Radar Detector (`radar_detector`) ★
- Scrambler / Descrambler (`scrambler_descrambler`) ★
- Voice Stress Analyzer (`voice_stress_analyzer`)

### Internal (13)

- AudioVox (`audiovox`)
- Contraceptive Implant (`contraceptive_implant`)
- Enhanced Antibodies (`enhanced_antibodies`)
- Cybersnake (`cybersnake`)
- Gills (`gills`)
- Grafted Muscle and Bone Lace (`grafted_muscle_bone_lace`)
- Independent Air Supply (`independent_air_supply`)
- Midnight Lady™ Sexual Implant (`midnight_lady`)
- Mr. Studd™ Sexual Implant (`mr_studd`)
- Nasal Filters (`nasal_filters`)
- Radar / Sonar Implant (`radar_sonar_implant`)
- Toxin Binders (`toxin_binders`)
- Vampyres (`vampyres`)

### External (4)

- Hidden Holster (`hidden_holster`)
- Skin Weave (`skin_weave`)
- Subdermal Armor (`subdermal_armor`)
- Subdermal Pocket (`subdermal_pocket`)

### Cyberlimbs (30)

- Cyberarm (`cyberarm`)
- Standard Hand (`standard_hand`)
- Big Knucks (`big_knucks`)
- Cyberdeck (Cyberarm) (`cyberarm_cyberdeck`)
- Grapple Hand (`grapple_hand`)
- Medscanner (Cyberarm) (`cyberarm_medscanner`)
- Popup Grenade Launcher (`popup_grenade_launcher`)
- Popup Melee Weapon (`popup_melee`)
- Popup Shield (`popup_shield`)
- Popup Ranged Weapon (`popup_ranged`)
- Quick Change Mount (`quick_change_mount`)
- Rippers (`rippers`)
- Scratchers (`scratchers`)
- Shoulder Cam (`shoulder_cam`)
- Slice 'N Dice (`slice_n_dice`)
- Subdermal Grip (`subdermal_grip`)
- Techscanner (Cyberarm) (`cyberarm_techscanner`)
- Tool Hand (`tool_hand`)
- Wolvers (`wolvers`)
- Cyberleg (`cyberleg`)
- Standard Foot (`standard_foot`)
- Grip Foot (`grip_foot`)
- Jump Booster (`jump_booster`)
- Skate Foot (`skate_foot`)
- Talon Foot (`talon_foot`)
- Web Foot (`web_foot`)
- Hardened Shielding (`hardened_shielding`)
- Plastic Covering (`plastic_covering`)
- Realskinn™ Covering (`realskinn_covering`)
- Superchrome® Covering (`superchrome_covering`)

### Borgware (5)

- Artificial Shoulder Mount (`artificial_shoulder_mount`)
- Implanted Linear Frame ß (Beta) (`implanted_linear_frame_beta`)
- Implanted Linear Frame ∑ (Sigma) (`implanted_linear_frame_sigma`)
- MultiOptic Mount (`multioptic_mount`)
- Sensor Array (`sensor_array`)

## Done

Anti-Dazzle, Biomonitor, Braindance Recorder, Chemskin, Chipware Socket, Chyron, Color Shift, Cybereye, Dartgun, EMP Threading, Image Enhance, Interface Plugs, Kerenzikov, Light Tattoo, Low Light / Infrared / UV, MicroOptics, MicroVideo, Neural Link, Olfactory Boost, Pain Editor, Radiation Detector, Sandevistan, Shift Tacts, Skill Chip, Skinwatch, Tactile Boost, Targeting Scope, Techhair, TeleOptics, Virtuality
