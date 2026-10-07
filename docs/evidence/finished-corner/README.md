# Finished-corner browser evidence

Actual Chrome screenshots. Before = untouched post-304 main (`1de7a198`), served from an isolated
worktree on port 8082. After = this branch on port 8081. Same browser viewport, same scene/camera.
The full browser content is retained; captures are not painted over or retouched.

| Pair / check                     | `/scene-review` query                                                                    | Result                                                              |
| -------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `seed7-play-before/after.jpg`    | `place=intersection&seed=7&actors=1&reveal=0`                                            | Normal gameplay framing, target rings and scene fade visible        |
| `seed7-close-before/after.jpg`   | `place=intersection&seed=7&actors=0&reveal=0&cam=-60,100,3`                              | Material identity, recess, tiled riser and lettering                |
| `seed8-close-before/after.jpg`   | `place=intersection&seed=8&actors=0&reveal=0&cam=-261,-2,3`                              | Opposite-facing frontage                                            |
| `seed8-lights-off.jpg`           | Previous after query plus `lights=0`                                                     | No baked light in the new wall finish                               |
| `seed0-return.jpg`               | `place=intersection&seed=0&actors=0&reveal=0&cam=-194,-40,3`                             | Shop identity continues around the return face                      |
| `seed7-reveal-damage-target.jpg` | `place=intersection&seed=7&actors=1&reveal=1&damage=mixed`, then select lookout on board | Retained lower finish, mixed wrecks, engine block still blocks shot |
| `seed7-restored.jpg`             | Save mixed fixture, switch to Garage, Load review                                        | Frozen saved scene, nine destroyed cover sections retained          |

`reflect=skip` throughout. The gameplay frame with a faded building is intentional, not replaced
by the flattering close-up. See `../../checkpoint-finished-corner.md` for critique and limits.
