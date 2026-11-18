import assert from "node:assert/strict";
import { join } from "node:path";

const strip = (page) => page.getByRole("region", { name: "Agent voice call" });
const scene = (page) => page.getByRole("heading", { name: "Evergreen Apartments", exact: true });
const dialogue = (page) => page.getByRole("textbox", { name: "What do you say?" });
const intent = (page) => page.getByRole("textbox", { name: "What do you do?" });

async function openFixture(browser, url, direction, width, height) {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: "reduce" });
  await page.route("**/*", (route) =>
    new URL(route.request().url()).origin === url ? route.continue() : route.abort(),
  );
  await page.goto(`${url}/?place=p4&call=${direction}`);
  await scene(page).waitFor();
  return page;
}

async function capture(page, out, file) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
  });
  await page.screenshot({ path: join(out, file) });
}

export async function captureCall(browser, url, out) {
  const desktop = await openFixture(browser, url, "outgoing", 1366, 768);
  await intent(desktop).fill("I call Yuri on my Agent.");
  await desktop.getByRole("button", { name: "Act", exact: true }).click();
  await strip(desktop).waitFor();
  assert.ok(await scene(desktop).isVisible());
  assert.equal(await strip(desktop).getByText("Yuri Pastrana").count(), 1);
  assert.ok(await strip(desktop).locator('img[src*="yuri-pastrana"]').count());
  const heading = desktop.getByRole("heading", { name: "A Line to Yuri", exact: true });
  assert.ok(await heading.isVisible());
  assert.ok((await strip(desktop).boundingBox()).y < (await heading.boundingBox()).y);
  await dialogue(desktop).fill("Who at the market pays a fair rate?");
  await dialogue(desktop).blur();
  await capture(desktop, out, "agent-outgoing-1366.png");
  await dialogue(desktop).press("Enter");
  await desktop.getByText("Ask at the hardware counter.", { exact: false }).waitFor();
  await desktop.evaluate(() => window.fixtureRefresh());
  assert.ok(await strip(desktop).isVisible());
  assert.equal(await dialogue(desktop).inputValue(), "");
  await dialogue(desktop).fill("One more question");
  await desktop.getByRole("button", { name: "Hang up", exact: true }).press("Enter");
  await intent(desktop).waitFor();
  assert.equal(await strip(desktop).count(), 0);
  assert.equal(await intent(desktop).inputValue(), "One more question");
  assert.equal(
    await intent(desktop).evaluate((element) => element === document.activeElement),
    true,
  );
  await desktop.evaluate(() => window.fixtureRefresh());
  assert.equal(await strip(desktop).count(), 0);
  await intent(desktop).fill("I text Yuri.");
  await intent(desktop).press("Enter");
  await desktop.getByText("You send Yuri a message on your Agent.").waitFor();
  assert.equal(await strip(desktop).count(), 0);
  await desktop.close();

  const phone = await openFixture(browser, url, "incoming", 390, 844);
  await strip(phone).getByText("Incoming · Connected").waitFor();
  assert.ok(
    await phone
      .getByRole("status")
      .filter({ hasText: "Incoming voice call connected with Yuri Pastrana." })
      .count(),
  );
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth), 390);
  await dialogue(phone).fill("Hold them for me. I’m on my way.");
  await dialogue(phone).blur();
  await capture(phone, out, "agent-incoming-390.png");
  await phone.getByRole("button", { name: "Hang up", exact: true }).click();
  await intent(phone).waitFor();
  assert.equal(await strip(phone).count(), 0);
  await phone.close();
  console.log("Agent call browser assertions passed.");
}
