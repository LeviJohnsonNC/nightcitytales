import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  SHARE_IMAGE_URL,
  SITE_URL,
  absoluteUrl,
  pageMeta,
  type MetaTag,
} from "../siteMeta";

const valueOf = (tags: MetaTag[], key: "name" | "property", id: string) =>
  tags.find((t) => key in t && (t as Record<string, string>)[key] === id) as
    { content: string } | undefined;

describe("pageMeta", () => {
  const tags = pageMeta({ title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION, path: "/" });

  it("names the game, not the scaffold it was built on", () => {
    const text = JSON.stringify(tags);
    expect(text).not.toMatch(/Lovable App|Generated Project|@Lovable/);
    expect(tags).toContainEqual({ title: DEFAULT_TITLE });
    expect(valueOf(tags, "property", "og:site_name")?.content).toBe("Night City Tales");
  });

  it("hands a crawler an image it can actually fetch", () => {
    // A crawler does not run the app: a root-relative path resolves to nothing.
    expect(SHARE_IMAGE_URL).toMatch(/^https:\/\//);
    expect(valueOf(tags, "property", "og:image")?.content).toBe(SHARE_IMAGE_URL);
    expect(valueOf(tags, "name", "twitter:image")?.content).toBe(SHARE_IMAGE_URL);
    expect(valueOf(tags, "name", "twitter:card")?.content).toBe("summary_large_image");
  });

  it("keeps Open Graph and Twitter saying the same thing", () => {
    expect(valueOf(tags, "name", "twitter:title")?.content).toBe(
      valueOf(tags, "property", "og:title")?.content,
    );
    expect(valueOf(tags, "name", "twitter:description")?.content).toBe(
      valueOf(tags, "property", "og:description")?.content,
    );
  });

  it("only writes og:url when a page says where it lives", () => {
    expect(valueOf(tags, "property", "og:url")?.content).toBe(`${SITE_URL}/`);
    const bare = pageMeta({ title: "t", description: "d" });
    expect(valueOf(bare, "property", "og:url")).toBeUndefined();
  });

  it("lets a page bring its own picture", () => {
    const own = pageMeta({ title: "t", description: "d", image: "/img/x.png", imageAlt: "x" });
    expect(valueOf(own, "property", "og:image")?.content).toBe(`${SITE_URL}/img/x.png`);
    expect(valueOf(own, "property", "og:image:alt")?.content).toBe("x");
  });

  it("never writes the same tag twice", () => {
    const keys = tags.map((t) =>
      JSON.stringify(Object.entries(t).filter(([k]) => k !== "content")),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("absoluteUrl", () => {
  it("leaves an absolute URL alone and roots a relative one", () => {
    expect(absoluteUrl("https://example.com/a.png")).toBe("https://example.com/a.png");
    expect(absoluteUrl("/a.png")).toBe(`${SITE_URL}/a.png`);
    expect(absoluteUrl("a.png")).toBe(`${SITE_URL}/a.png`);
  });
});

describe("routes", () => {
  it("leave no scaffold placeholder in the root head", () => {
    const root = readFileSync(join(process.cwd(), "src/routes/__root.tsx"), "utf8");
    expect(root).not.toMatch(/Lovable App|Lovable Generated Project|@Lovable/);
  });
});
