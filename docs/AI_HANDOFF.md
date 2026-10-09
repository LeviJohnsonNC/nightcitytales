# Night City Tales — resume here

Updated 2026-10-09. PR330 full-block composition follow-up.
https://github.com/LeviJohnsonNC/nightcitytales/pull/330
Repo LeviJohnsonNC/nightcitytales; remote branch codex/workshop-depth.
Last verified open/unmerged/mergeable, head 7db20b054fba7afa60726e9dfc0f9d5453994b3f.
Main baseline 3ac6137b051c2ca96447308950bcd2c3a642ee18.
Local history reconstructed: NEVER git push. Publish selected files through
GitHub tree/commit/update_ref with expected-head lease. Levi merges; keep unmerged
until latest exact-head visuals inspected. No new generated assets authorized.
Preserve unrelated dirty courtyard/cityBlock.ts, untracked cityBlock.test.ts,
and recovery files. Parent sources/ is read-only.

## Verified fixes published
67559a81 fixes screenshot clip coordinates (viewport, not document scroll),
asserts clip fits viewport and PNG size matches canvas. Corrected full framing.
This alone did NOT fix ghost rings: seed7 still showed detached duplicates.
f96db189 isolates SVG overlay with translateZ(0). Exact-head CI37970318683 and
visual37970318688 passed. Actual downloaded after pixels for seed0-play,
seed7-play, seed8-play/reveal inspected clean, single anchored rings.
Downloaded city-block-after (4).zip SHA256
fd8ff46acd33a3bb488e91b785ab9dc3a8d7dbcdacab81b14aca25087ad402d5
matches artifact11635686947. Extracted /tmp/nct-330-isolated/after.
Earlier bad captures retained /tmp/nct-330-fixed and /tmp/nct-330-transfer.
All original CI audio fixes retained; actual-media-only suppression preserves
Vite JS imports. All visual states/overlay diagnostics, no retries, seed8 180s,
suite420s. Passing CI alone is not visual acceptance.

## Composition implementation — not visually accepted yet
Levi approved proceeding with substantial composition after review.
New commercialTerrace.ts recesses tall commercial upper floors inside saved
footprints, leaves outdoor podium terraces, steps their silhouettes and relocates
roof equipment to fit. Occupied repair/studios keep their balconies/envelope.
composedEnvironment.ts clips original facade to podium, renders new upper mass;
light-pass roof masks/equipment follow the inset. residentialRoof.ts retains
neighbour ballast versus shop membrane materials on the constructed upper roof.
Seed8 new recipe14 extends market canopy across frontage with deeper projection;
old snapshots retained. No ground collision, cover, entrance or route changes.
occupiedFrontage.ts brightens repair interiors and adds recessed doorway reveals.
Tests cover equipment/room bounds, snapshot immutability and recipe migration.
Local full suite: 4122 passed, one material regression found (neighbour roof).
Fixed by retaining ballast; all15 targeted material tests, typecheck/lint/build pass.
Composition published b230f4d, followed by7db20b0 window lighting alignment.
Local commits23a57e6 and77a1d43; remote trees1de6b6e and949e944 respectively.
CI37971581606 and visual37971581661 BOTH passed for7db20b0, all three seeds.
Downloaded exact paired ZIPs verified by SHA256, /tmp/nct-330-composition.
After artifact11636901324 hash5fed231306ad8aed566b07a333d635caa884b0515a8de8161d5830dabea21089.
Before artifact11637440410 hash11d38844b3a462a61e96ff255c9a0d785f124b712cdec67714ee0c16ed1bf090.
Pixels reviewed: all3 play/reveal; seed8 neutral, lights-off, compact-play,
destroyed/restored. Rings clean throughout these inspected after frames.
Terraces/canopy read clearly, painted repair bays brighter; still crisp/procedural
rather than final painterly finish. Baseline seed8play/reveal and seed0play viewed.
Found full-width canopy removed pink blade sign because placement required space
beside awning. Current follow-up restores it above canopy end bay on tall fronts;
22 storefront tests, lint and typecheck pass. Publish follow-up then check
new exact-head CI/pixels. Keep330 unmerged pending final sign capture review.

## Environment
Local Vite listen failed EPERM; use CI for live browser evidence this session.
Attachment helper/network ZIP downloads fail, but Chrome UI artifact downloads
work and /Users/levijohnson/Downloads files are readable. Verify SHA256 against API.
Chrome owned task tab2110509047 on GitHub Actions. Download link appears twice;
getByRole(link, exact Download city-block-after (opens in a new tab)).nth(1).click()
works; no download-event waiter needed. Extract in /tmp, then tools.view_image.
No claims from filenames/diagnostics alone. No git push, no PR merge.
