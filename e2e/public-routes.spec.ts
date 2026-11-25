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
  // Use a still scene for repeatable checks. The motion lifecycle is tested separately.
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
  test("rooftop motion follows the viewport and the visitor’s motion preference", async ({
    page,
  }) => {
    await open(page, "/");
    const rain = page.locator("#top canvas").first();
    await expect(rain).toHaveCount(0);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(rain).toBeVisible();
    await page.locator("#life").scrollIntoViewIfNeeded();
    await expect(rain).toHaveCount(0);
    await page.getByRole("heading", { name: /Live your life in/ }).scrollIntoViewIfNeeded();
    await expect(rain).toBeVisible();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(rain).toHaveCount(0);
  });

  test.describe("before JavaScript runs", () => {
    test.use({ javaScriptEnabled: false });
    test("the Life labels and closing action are fully painted", async ({ page }) => {
      await page.goto("/#life");
      const rent = page.locator("#life").getByText("Rent due", { exact: true });
      const closing = page
        .locator("section")
        .last()
        .getByRole("link", { name: "Start your story" });
      for (const content of [rent, closing]) {
        await content.scrollIntoViewIfNeeded();
        expect(await content.evaluate((el) => el.checkVisibility({ opacityProperty: true }))).toBe(
          true,
        );
      }
    });
  });

  test("shows an Evergreen turn before asking a new player for an account", async ({ page }) => {
    await open(page, "/");
    await page.getByRole("link", { name: "See a turn" }).click();
    const turn = page.getByRole("region", { name: "A turn at Evergreen Apartments." });
    await expect(turn.getByText("Len Vale’s number")).toBeInViewport();
    await expect(turn.getByRole("img")).toHaveJSProperty("complete", true);
    expect(
      await turn.getByRole("img").evaluate((image) => (image as HTMLImageElement).naturalWidth),
    ).toBeGreaterThan(0);

    await page.getByRole("banner").getByRole("link", { name: "Start your story" }).click();
    await expect(page.getByRole("heading", { name: "Create an account" })).toBeVisible();
    await expect(page.getByLabel("Password")).toHaveAttribute("autocomplete", "new-password");
    await page.getByRole("link", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByLabel("Password")).toHaveAttribute("autocomplete", "current-password");
  });

  test("the sample night puts Dino’s offer between the purchase and its consequences", async ({
    page,
  }) => {
    await open(page, "/#jobs");
    const night = page.getByRole("region", { name: "Rent is due tomorrow." });
    const moments = night.getByRole("listitem");
    await expect(moments).toHaveCount(4);
    await expect(moments.first()).toContainText("€400");
    await expect(moments.last()).toContainText("We need to talk");
    const offer = moments.nth(1);
    const question = offer.getByText("Ask Dino who’s paying");
    const answer = offer.getByText(/Client wants their name/);
    await expect(answer).toBeHidden();
    await question.focus();
    await page.keyboard.press("Enter");
    await expect(answer).toBeVisible();
    await question.click();
    await expect(answer).toBeHidden();
  });
});

test.describe("what the sign-in page asks for", () => {
  test("every field can be found by its label", async ({ page }) => {
    await open(page, "/login");
    await expect(page.getByLabel(/email/i).first()).toBeVisible();
    await expect(page.getByLabel(/password/i).first()).toBeVisible();
  });
});
