/**
 * The pages anybody can open, looked at the way a browser sees them.
 *
 * What these hold is what the Node suite cannot: that a page loads without a
 * script throwing, that none of it asks the server for something that is not
 * there, that nothing makes a phone scroll sideways, and that what a screen
 * reader is told about it is true (an axe scan against WCAG 2 A and AA).
 *
 * Each of the five needs no account. The signed-in game does, and is not here.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const ROUTES = [
  { path: "/", name: "landing" },
  { path: "/login", name: "sign in" },
  { path: "/style", name: "visual system" },
  { path: "/scene-review", name: "scene review" },
  { path: "/shop-review", name: "shop review" },
] as const;

/**
 * Accessibility rules the page is KNOWN to break, by route. The list is a debt
 * register: an entry is a thing to fix, never a way to silence a new finding —
 * anything not listed here fails the run. Empty is the goal.
 */
const KNOWN_A11Y: Record<string, string[]> = {};

/**
 * Same-origin requests that are allowed to fail. Lovable's asset proxy
 * (`/__l5e/…`) serves the site's art on its own host and nowhere else, so off
 * that host a development server has no answer for it; it is not a page defect.
 */
const ALLOWED_FAILURES = [/\/__l5e\//];

async function open(page: Page, path: string) {
  const pageErrors: string[] = [];
  const failed: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("response", (r) => {
    const url = new URL(r.url());
    const sameOrigin = url.origin === new URL(page.url() || r.url()).origin;
    if (sameOrigin && r.status() >= 400 && !ALLOWED_FAILURES.some((re) => re.test(url.pathname))) {
      failed.push(`${r.status()} ${url.pathname}`);
    }
  });
  // Reduced motion: a scroll-reveal caught halfway through is a contrast failure
  // that is not there a moment later.
  await page.emulateMedia({ reducedMotion: "reduce" });
  const response = await page.goto(path, { waitUntil: "load" });
  await page.waitForLoadState("networkidle").catch(() => {});
  return { response, pageErrors, failed };
}

for (const route of ROUTES) {
  test.describe(`${route.name} (${route.path})`, () => {
    test("loads, throws nothing, and asks for nothing that is missing", async ({ page }) => {
      const { response, pageErrors, failed } = await open(page, route.path);
      expect(response?.status()).toBe(200);
      expect(await page.title()).toMatch(/Night City Tales|Scene review/);
      expect(pageErrors).toEqual([]);
      expect(failed).toEqual([]);
    });

    test("does not scroll sideways", async ({ page }) => {
      await open(page, route.path);
      const { scroll, inner } = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        inner: window.innerWidth,
      }));
      expect(scroll, "the page is wider than the screen").toBeLessThanOrEqual(inner);
    });

    test("tells a screen reader the truth (WCAG 2 A and AA)", async ({ page }) => {
      await open(page, route.path);
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      const known = KNOWN_A11Y[route.path] ?? [];
      const unexpected = violations
        .filter((v) => !known.includes(v.id))
        .map(
          (v) =>
            `${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} place(s), e.g. ${v.nodes[0]?.target.join(" ")}`,
        );
      expect(unexpected).toEqual([]);
    });
  });
}

test.describe("what the landing page promises", () => {
  test("its one-night timeline is a real list of nine moments", async ({ page }) => {
    await open(page, "/");
    // The reveal animation once wrapped each item in a div, which left the list
    // with children it is not allowed to have and the items with no list.
    const items = page.locator("ol > li");
    await expect(items).toHaveCount(9);
    await expect(items.first()).toContainText("6:10 PM");
  });
});

test.describe("what the sign-in page asks for", () => {
  test("every field can be found by its label", async ({ page }) => {
    await open(page, "/login");
    await expect(page.getByLabel(/email/i).first()).toBeVisible();
    await expect(page.getByLabel(/password/i).first()).toBeVisible();
  });
});
