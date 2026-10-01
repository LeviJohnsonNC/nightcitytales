/**
 * The Skills step, as a newcomer meets it: three ways to work, what that lets
 * you do and how likely it is to go right, and the old editor in a drawer.
 */
import { afterEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import skillsData from "@/data/rules/skills.json";
import {
  BASIC_SKILLS,
  HOME_AREA,
  getDV,
  getSkill,
  presetEntries,
  presetsFor,
  type StatBlock,
} from "@/engine";
import { SkillsPanel } from "../SkillsPanel";
import { SKILL_TASKS, taskOdds } from "../skillTasks";
import { useChargenStore, type ChargenState } from "../store";

const SKILL_IDS = (skillsData as unknown as { skills: { id: string }[] }).skills.map((s) => s.id);
const STATS: StatBlock = {
  int: 6,
  ref: 7,
  dex: 6,
  tech: 5,
  cool: 6,
  will: 5,
  luck: 5,
  move: 6,
  body: 6,
  emp: 5,
};

afterEach(() => useChargenStore.getState().reset());

function draft(over: Partial<ChargenState>): ChargenState {
  return { ...useChargenStore.getState(), ...over };
}

describe("what a Skill lets you do", () => {
  it("has a task on the printed ladder for every Skill, in the house voice", () => {
    expect(Object.keys(SKILL_TASKS).sort()).toEqual([...SKILL_IDS].sort());
    for (const [id, line] of Object.entries(SKILL_TASKS)) {
      expect(() => getDV(line.dv), id).not.toThrow();
      expect(line.task, id).not.toMatch(/\d|—/);
    }
  });

  it("needs the STAT before it will quote a chance", () => {
    const entry = { skillId: "handgun", specialization: null, level: 6 };
    expect(taskOdds(entry, {})).toBeNull();
    // REF 7 + Handgun 6 against Professional.
    expect(taskOdds(entry, STATS)?.percent).toBe(70);
  });
});

describe("the Skills step", () => {
  it("asks how you work before it asks for points", () => {
    const html = renderToStaticMarkup(
      <SkillsPanel state={draft({ method: "edgerunner", roleId: "solo", stats: STATS })} />,
    );
    for (const preset of presetsFor("solo")) expect(html).toContain(preset.name);
    expect(html).toContain("Pick how you work");
    expect(html).toContain("Fine-tune every Skill");
    // The editor stays in its drawer until asked for.
    expect(html).not.toContain("Skill Points left to spend");
  });

  it("lists only what your Skills make likely, as the Skill and the task, with no bars", () => {
    const preset = presetsFor("solo")[0]!;
    const skills = presetEntries({ method: "edgerunner", roleId: "solo", preset });
    const html = renderToStaticMarkup(
      <SkillsPanel state={draft({ method: "edgerunner", roleId: "solo", stats: STATS, skills })} />,
    );
    expect(html).toContain('aria-pressed="true"');
    // Athletics 4 + DEX 6 clears Difficult at 80%; Handgun 6 at Professional is 70%.
    expect(html).toContain("Athletics");
    expect(html).toContain(SKILL_TASKS["athletics"]!.task);
    expect(html).not.toContain(SKILL_TASKS["handgun"]!.task);
    expect(html).not.toMatch(/\d+%/);
  });

  it("says so, rather than padding the list, when nothing is likely", () => {
    const skills = [{ skillId: "handgun", specialization: null, level: 2 }];
    const html = renderToStaticMarkup(
      <SkillsPanel state={draft({ method: "edgerunner", roleId: "solo", stats: STATS, skills })} />,
    );
    expect(html).toContain("Nothing is a sure thing yet");
  });

  it("gives a Streetrat the fixed list as things they can already do", () => {
    const html = renderToStaticMarkup(
      <SkillsPanel state={draft({ method: "streetrat", roleId: "fixer", stats: STATS })} />,
    );
    expect(html).toContain("What you can do");
    expect(html).not.toContain("Pick how you work");
  });
});

describe("the Complete Package sheet", () => {
  const basics = BASIC_SKILLS.filter(
    (id) => !getSkill(id).requiresSpecialization || id === "local_expert",
  ).map((id) => ({
    skillId: id,
    specialization: id === "local_expert" ? HOME_AREA : null,
    level: 2,
  }));
  const skills = [...basics, { skillId: "handgun", specialization: null, level: 3 }];
  const html = renderToStaticMarkup(
    <SkillsPanel
      state={draft({ method: "complete_package", roleId: "solo", stats: STATS, skills })}
    />,
  );

  it("offers Remove only on a Skill that can come off, and says why on the rest", () => {
    // One Skill that is not Basic, so one Remove — never a button that does nothing.
    expect(html.match(/>Remove</g)).toHaveLength(1);
    expect(html.match(/Basic · min 2/g)).toHaveLength(basics.length);
  });

  it("says the points left once, and drops the explainers", () => {
    expect(html.match(/Skill Points remaining/g)).toHaveLength(1);
    expect(html).not.toContain("spent ·");
    expect(html).not.toContain("The whole Master Skill List is open to you");
    expect(html).not.toContain("left to spend");
  });

  it("groups the Master Skill List by STAT and hides what is already chosen", () => {
    expect(html).toContain("Show chosen (");
    expect(html).toMatch(/aria-expanded="false"[^>]*>\s*<span[^>]*>INT/);
    expect(html).not.toContain("On sheet");
  });
});
