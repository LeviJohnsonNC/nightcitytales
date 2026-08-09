import {
  enemySentences,
  friendSentence,
  languageSentence,
  loveSentence,
  roleLifepathSentences,
  sentenceFor,
} from "./lifepathNarrative";
import { SINGLE_LIFEPATH_TABLES, type GeneralLifepath } from "./lifepathState";
import type { RoleLifepath } from "./roleLifepathState";

/** The running second-person biography. This is the payoff panel. */
export function BiographyPanel({
  lifepath,
  roleLifepath,
  roleName,
}: {
  lifepath: GeneralLifepath;
  roleLifepath?: RoleLifepath;
  roleName?: string;
}) {
  const opening = SINGLE_LIFEPATH_TABLES.filter((id) => id !== "life_goals")
    .map((id) => lifepath.entries[id])
    .filter(Boolean)
    .map((entry) => sentenceFor(entry!));

  if (lifepath.language) opening.push(languageSentence(lifepath.language));

  const people = [
    ...lifepath.friends.map(friendSentence),
    ...lifepath.enemies.flatMap(enemySentences),
    ...lifepath.tragicLove.map(loveSentence),
  ];

  const goal = lifepath.entries["life_goals"];
  const roleLines =
    roleLifepath?.roleId ? roleLifepathSentences(roleLifepath.roleId, roleLifepath.entries) : [];
  const empty = opening.length === 0 && people.length === 0 && !goal && roleLines.length === 0;

  return (
    <div className="border border-hairline bg-surface p-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-text-dim">
        Who you are so far
      </p>
      {empty ? (
        <p className="mt-4 text-sm italic leading-relaxed text-text-dim">
          Roll or choose your first table and your story starts writing itself here.
        </p>
      ) : (
        <div className="mt-4 space-y-4 text-[1.0625rem] leading-[1.7] text-text">
          {opening.length > 0 && <p>{opening.join(" ")}</p>}
          {people.length > 0 && <p className="text-text-muted">{people.join(" ")}</p>}
          {goal && (
            <p className="border-l-2 border-ember pl-4 font-display text-lg leading-snug text-text">
              {sentenceFor(goal)}
            </p>
          )}
          {roleLines.length > 0 && (
            <div className="border-t border-hairline pt-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-text-dim">
                {roleName ?? "Role"} — the life you chose
              </p>
              <ul className="mt-3 space-y-1.5 text-text-muted">
                {roleLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
