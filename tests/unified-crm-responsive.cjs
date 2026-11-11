const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
  const p = await browser.newPage();
  p.setDefaultTimeout(12000);
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  try {
    for (const width of [319, 390, 768, 1440]) {
      await p.setViewportSize({ width, height: 900 });
      await p.goto((process.argv[2] || "http://127.0.0.1:4182/") + "#works");
      const f = p.frameLocator("#crm-workspace");
      await f.locator(".crm-heading").waitFor();
      for (const v of ["projects", "day", "tasks", "team", "documents"]) {
        await f.locator(".crm-nav [data-view=" + v + "]").click();
        await f.locator("#work-content").waitFor();
        assert.ok(
          await f
            .locator("body")
            .evaluate(
              (b) => document.documentElement.scrollWidth <= innerWidth,
            ),
          "overflow " + width + " " + v,
        );
        await p.screenshot({
          path: "/tmp/belkhi-crm-" + v + "-" + width + ".png",
        });
      }
      await f.locator(".crm-nav [data-view=day]").click();
      await f.locator("[data-day-tab=journal]").click();
      await f.locator("[data-action=new-journal]").click();
      await f
        .locator("#journal-form [name=name]")
        .fill("Проверка журнала " + width);
      await f.locator("#journal-form button.primary").click();
      await f.locator("dialog").waitFor({ state: "hidden" });
      await f
        .getByText("Проверка журнала " + width, { exact: false })
        .waitFor();
    }
    assert.deepEqual(errors, []);
    console.log(
      "PASS responsive, navigation, journal create across 319/390/768/1440",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
