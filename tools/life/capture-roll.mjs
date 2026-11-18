import assert from "node:assert/strict";
import { join } from "node:path";

const outcomeText = "The winding comes free in one piece.";
const pending = (page) => page.getByRole("region", { name: "Required check" });
const result = (page) => page.getByRole("region", { name: /check result/ });
const roll = (page) => page.getByRole("button", { name: "Roll d10", exact: true });
const compose = (page) => page.getByRole("textbox", { name: /What do you do/i });
const requestCount = (page) => page.locator("html").getAttribute("data-roll-requests");

async function openFixture(browser, url, query, { width = 1366, reducedMotion = "reduce" } = {}) {
  const page = await browser.newPage({
    viewport: { width, height: width === 390 ? 844 : 768 },
    reducedMotion,
  });
  await page.route("**/*", (route) =>
    new URL(route.request().url()).origin === url ? route.continue() : route.abort(),
  );
  await page.goto(`${url}/?place=p4&roll=${query}`);
  await pending(page).waitFor();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) => image.decode().catch(() => {})));
  });
  return page;
}

async function capture(page, out, filename, phone = false) {
  const target = phone ? result(page) : page.locator(".life-turn-area");
  await target.evaluate(
    (node, block) => node.scrollIntoView({ block, behavior: "instant" }),
    phone ? "start" : "nearest",
  );
  await page.screenshot({ path: join(out, filename + ".png"), animations: "disabled" });
}

export async function captureRoll(browser, url, out) {
  const desktop = await openFixture(browser, url, "slow&faces=2", {
    reducedMotion: "no-preference",
  });
  const previous = !(await roll(desktop).count());
  await capture(desktop, out, "ready");
  if (previous) {
    await desktop.getByRole("button", { name: /Roll 1d10 for Basic Tech/ }).click();
    await desktop.getByText("Success by 1", { exact: false }).first().waitFor();
    await desktop.waitForTimeout(1500);
  } else {
    assert.match(await pending(desktop).innerText(), /\+12 · DV 13/);
    assert.match(await pending(desktop).innerText(), /90% chance/);
    await roll(desktop).focus();
    assert.equal(await roll(desktop).evaluate((button) => button.matches(":focus-visible")), true);
    await roll(desktop).press("Enter");
    const rolling = desktop.getByRole("button", { name: "Rolling…" });
    await rolling.waitFor();
    assert.equal(
      await desktop.getByRole("button", { name: "Dedicate one more Luck Point" }).isDisabled(),
      true,
    );
    await rolling.press("Enter");
    await result(desktop).waitFor();
    assert.equal(await requestCount(desktop), "1");
    const announcement = desktop
      .getByRole("status")
      .filter({ hasText: "14 against DV 13. Success by 1." });
    assert.equal(await announcement.count(), 1);
    await desktop.evaluate(() => window.fixtureRefresh());
    assert.equal(await result(desktop).getByText("Success by 1").count(), 1);
    assert.equal(await compose(desktop).count(), 0);
    assert.equal(
      await result(desktop)
        .locator(".life-check-impact")
        .evaluate((node) => node === document.activeElement),
      true,
    );
    assert.equal(await desktop.getByText("Resolving the outcome…", { exact: true }).count(), 1);
    assert.equal(await desktop.getByText("Resolving your turn.", { exact: true }).count(), 0);
  }
  await capture(desktop, out, "landed");
  await desktop.evaluate(() => window.dispatchEvent(new Event("fixture-finish-roll")));
  await desktop.getByText(outcomeText, { exact: false }).waitFor();
  if (!previous) {
    assert.equal(await result(desktop).getByText(outcomeText, { exact: false }).count(), 1);
    assert.equal(await pending(desktop).count(), 0);
  }
  await compose(desktop).waitFor();
  await capture(desktop, out, "completed");
  await desktop.close();
  if (previous) return;

  const phone = await openFixture(browser, url, "fast&faces=2", { width: 390 });
  await roll(phone).press("Space");
  await compose(phone).waitFor();
  assert.equal(
    await result(phone)
      .locator("details")
      .evaluate((details) => details.open),
    false,
  );
  await capture(phone, out, "phone-closed", true);
  await result(phone).locator("summary").press("Enter");
  const details = result(phone).locator("details");
  assert.equal(await details.evaluate((node) => node.open), true);
  assert.match(await details.innerText(), /d10\s+2\s+TECH\s+\+6\s+Basic Tech\s+\+6/);
  assert.equal(
    await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
  );
  await capture(phone, out, "phone-open", true);
  await phone.close();

  for (const scenario of [
    { query: "failure&faces=2", verdict: "Failed by 1" },
    { query: "fast&faces=10,4", verdict: "Success by 13", critical: "Critical +4" },
    { query: "fast&faces=1,3", verdict: "Failed by 3", critical: "Fumble −3" },
    { query: "exact&faces=3", verdict: "Success · Met DV" },
    { query: "empty&faces=2", verdict: "Success by 1", empty: true },
    { query: "opposed&faces=3,2", verdict: "Success by 1", opposed: true },
    { query: "opposed&faces=2,2", verdict: "Tie · Defender holds", opposed: true },
    { query: "fast&faces=2", verdict: "Success by 2", luck: true },
  ]) {
    const page = await openFixture(browser, url, scenario.query);
    if (scenario.empty) assert.ok(await pending(page).getByText("Luck pool empty").isVisible());
    if (scenario.luck)
      await page.getByRole("button", { name: "Dedicate one more Luck Point" }).click();
    await roll(page).click();
    if (scenario.opposed) {
      assert.equal(await requestCount(page), null);
      await page.getByRole("button", { name: "Roll Nao’s d10" }).click();
    }
    await result(page).getByText(scenario.verdict, { exact: true }).waitFor();
    if (scenario.critical) assert.ok(await result(page).getByText(scenario.critical).isVisible());
    if (scenario.luck) {
      await result(page).locator("summary").click();
      assert.match(await result(page).locator("details").innerText(), /Luck\s+\+1/);
      assert.match(
        await page.getByRole("complementary", { name: "Character status" }).innerText(),
        /Luck\s+4\/5/,
      );
    }
    await compose(page).waitFor();
    await page.close();
  }

  for (const mode of ["unsaved", "saved", "uncertain"]) {
    const page = await openFixture(browser, url, `${mode}&faces=2`);
    await page.getByRole("button", { name: "Dedicate one more Luck Point" }).click();
    await roll(page).click();
    await result(page).getByText("Success by 2").waitFor();
    if (mode === "unsaved") {
      await page.getByRole("button", { name: "Save this roll again" }).click();
      await compose(page).waitFor();
      assert.equal(await requestCount(page), "2");
    } else {
      if (mode === "uncertain")
        await page.getByRole("button", { name: "Check saved roll" }).click();
      await result(page).getByText("Roll saved. The scene outcome is unavailable.").waitFor();
      await compose(page).waitFor();
      assert.equal(await requestCount(page), "1");
    }
    assert.equal(await result(page).count(), 1);
    assert.equal(await roll(page).count(), 0);
    assert.match(
      await page.getByRole("complementary", { name: "Character status" }).innerText(),
      /Luck\s+4\/5/,
    );
    await page.close();
  }
  console.log("Life roll browser assertions passed.");
}
