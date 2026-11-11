const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
  const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
  p.setDefaultTimeout(15000);
  let errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  try {
    await p.goto((process.argv[2] || "http://127.0.0.1:4182/") + "#works");
    const f = p.frameLocator("#crm-workspace");
    await f.locator(".crm-heading").waitFor();
    await f.locator("[data-view=team]").click();
    await f.locator("[data-action=new-person]").first().click();
    await f.locator("[name=name]").fill("Тестовый мастер");
    await f.locator("[name=role]").fill("Бетонщик");
    await f.locator("[name=phone]").fill("+79990000000");
    await f.locator("#person-form .primary").click();
    await f.locator("dialog").waitFor({ state: "hidden" });
    await f.locator("[data-view=tasks]").click();
    await f.locator("[data-action=new-task]").first().click();
    await f.locator("[name=name]").fill("Тест арматура");
    await f
      .locator("[name=assignee]")
      .selectOption({ label: "Тестовый мастер" });
    await f.locator("[name=status]").selectOption("doing");
    await f.locator("[name=type]").selectOption("Количество");
    await f.locator("[name=target]").fill("30");
    await f.locator("[name=stage]").fill("Фундамент");
    await f.locator("[name=checklist]").fill("Подготовка\nПроверка");
    await f.locator("[name=comment]").fill("Привезли материал");
    await f.locator("#task-form .primary").click();
    await f.locator("dialog").waitFor({ state: "hidden" });
    await f.locator("[data-board=doing]").click();
    await f.getByRole("button").filter({ hasText: "Тест арматура" }).click();
    await f.locator("[data-edit-task]").last().click();
    await f.locator("[name=amount]").fill("18");
    await f.locator("[name=completedItem]").first().check();
    await f.locator("#task-form .primary").click();
    await f.locator(".task-detail").waitFor();
    await f.locator("[data-close-panel]").click();
    await f.locator("dialog").waitFor({ state: "hidden" });
    await f.getByRole("button").filter({ hasText: "Тест арматура" }).click();
    await f.locator("[data-edit-task]").last().click();
    assert.equal(await f.locator("[name=amount]").inputValue(), "18");
    assert.equal(
      await f.locator("[name=completedItem]").first().isChecked(),
      true,
    );
    await f.locator("[data-close-panel]").click();
    await f.locator(".task-detail").waitFor();
    await f.locator("[data-close-panel]").click();
    await f.locator("dialog").waitFor({ state: "hidden" });
    assert.equal(
      await f.locator("[data-board=doing]").getAttribute("aria-pressed"),
      "true",
    );
    await f.locator("[data-view=documents]").click();
    await f.locator("[data-action=new-document]").first().click();
    await f.locator("[name=name]").fill("Тест договор");
    await f.locator("[name=amount]").fill("100000");
    await f.locator("#document-form .primary").click();
    await f.locator("dialog").waitFor({ state: "hidden" });
    await f.getByRole("button").filter({ hasText: "Тест договор" }).click();
    await f.locator("[data-payment]").click();
    await f.locator("#payment-form [name=amount]").fill("25000");
    await f.locator("#payment-form .primary").click();
    await f.locator("#payment-form").waitFor({ state: "hidden" });
    await f.locator("[data-close-panel]").click();
    await f.locator("dialog").waitFor({ state: "hidden" });
    await p.reload();
    await f.locator(".crm-heading").waitFor();
    await f.locator("[data-view=documents]").click();
    await f.getByRole("button").filter({ hasText: "Тест договор" }).click();
    await f
      .locator(".payment-history")
      .getByText("25 000", { exact: false })
      .waitFor();
    await p.screenshot({ path: "/tmp/belkhi-crm-payment.png" });
    assert.deepEqual(errors, []);
    console.log(
      "PASS worker, assignment, quantity, checklist, comments, dialog Back, contract, payment, reload persistence",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
