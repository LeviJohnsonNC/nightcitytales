# City-block visual review — 8 October 2026

## Verdict

The deployed intersection passes the manual checks below. It is a clear improvement,
but does not yet match the reference image. This is not a passing automated
before/after run, a comprehensive regression verdict or a measured performance test.

## Scope and provenance

Reviewed the live `https://nightcitytales.lovable.app/scene-review` page in Chrome.
An already-open tab initially showed older art; after reload, updated traffic
signals, facade services and roof walk pads appeared. No deployed commit identifier
was exposed, so do not claim these captures prove an exact deployment SHA.
Remote main's `cityBlock.ts` blob and the local recovery file both hash to
`73c1845007b1d603bf2ade0139212ccf3dbfda82`; that proves source agreement only.

Local evidence: `docs/evidence/city-block-live/` in the `city-block-recovery`
checkout. Screenshots are committed locally, not uploaded in this notes PR.
The old `seed7-play.jpg` is the stale-tab capture; use
`seed7-play-refreshed.jpg` for the refreshed scene.

## Checks actually observed

| Check                   | Result                  | Evidence / limitation                                                                               |
| ----------------------- | ----------------------- | --------------------------------------------------------------------------------------------------- |
| Seeds 7, 8 and 0 render | Pass                    | Refreshed seed 7, tactical seed 8 and scenery/tactical seed 0 inspected                             |
| Lighting switch         | Pass for seed 8         | Fixture pools and reflections disappear with lights off, return with lights on                      |
| Neutral lighting        | Pass for seed 0         | Materials remain visible; no obvious detached facade detail in inspected view                       |
| Destroyed cover         | Pass for seed 8         | Cars and stall become wrecks; destroyed labels update; intact selection restores them               |
| Building reveal         | Pass for seed 8         | Upper mass is removed, lower frontage retained; no obvious floating upper fixture in inspected view |
| Target obstruction      | Pass for seed 8         | Lookout selection reports sedan engine block obstructing shot and marks it in the way               |
| Firing-position helper  | Pass for seed 8         | Alternative firing squares highlight; no movement or combat action was submitted                    |
| Compact layout          | Pass for horizontal fit | Measured 560 × 680 CSS viewport, document width 560; scrolled board and action bar visible          |
| Console sample          | No errors returned      | Browser error-log sample returned empty; not complete network/console coverage                      |
| Save/load               | Not exercised           | No claim about persistence correctness                                                              |
| Local Playwright suite  | Blocked                 | Fresh listener probe failed immediately with `EPERM`; server/test suite not started                 |

Desktop override requested 1440 × 1000; compact override requested 700 × 850.
Browser zoom produced a measured compact CSS viewport of 560 × 680. The override
was reset after review. Compact review controls take substantial vertical space,
but the scrolled tactical board and action bar fit without horizontal overflow.

Several scene rebuilds outlasted the browser tool's 3-second command deadline.
Subsequent observations showed the requested change completed and the scene
recovered. This is evidence of render-time responsiveness trouble worth profiling,
not proof of the cause of ChatGPT conversation failures.

## Reference comparison

Compared against `docs/evidence/atmosphere/reference.jpg`.

- What works: warm shop / cool service-light contrast, recognizable painted props,
  legible target rings, clear crossing, facade service attachments and roof walk pads.
- Main gap: broad, uniform asphalt and pavement, isolated props and thin sidewalk
  groupings. The reference has much richer ground variation, curb detail, clustered
  services, vegetation, barriers and occupied storefront edges.
- Buildings still read as repeated simple masses. Roof equipment remains visually
  repetitive even though placement is more varied.
- Reflections are more convincing under a few strong emitters than as a continuous
  wet street. Do not address this simply by increasing bloom or global brightness.

## Recommended next visual milestone

Make one complete intersection's ground and street edges feel occupied:
coherent sidewalk service groups, stronger curb/gutter/drain detail, and restrained
surface variation tied to use and drainage. Keep crossing and tactical routes
readable. Any new blocking object must come from saved geometry; decorative
details must remain nonblocking. Validate one seed at play zoom before extending
the treatment to more seeds. Profile scene reconstruction separately before
adding expensive material work.

## Automation correction and remaining work

The combat toolbar exposes Reveal as a **button**, while scenery mode exposes it
as a **checkbox**. The existing repaired spec switches characters off before
checking Reveal, so its checkbox selector is valid. An initial suspicion of a
selector defect was disproved; no test or renderer change was made in this review.

The recovered E2E repair, source atlas and regression tests remain pending
reconciliation/publication. A successful CI or supported local browser run on
an identified commit is still required to close the automated review gate.
PR #317 was verified merged during this review.
