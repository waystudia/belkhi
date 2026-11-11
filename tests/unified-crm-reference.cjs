const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
  const p = await browser.newPage();
  p.setDefaultTimeout(12000);
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  try {
    const { initialData } = await import(
      pathToFileURL(path.resolve(__dirname, "../app/works-concepts/data.js"))
    );
    const seed = structuredClone(initialData),
      today = new Date().toLocaleDateString("en-CA");
    seed.tasks.forEach((t) => (t.due = today));
    seed.tasks[0].checklist = [{ text: "Проверить покрытие", done: false }];
    seed.projects.forEach((p) => {
      p.demo = true;
      p.stages = [
        { id: "prep", name: "Подготовка" },
        { id: "current", name: p.phase },
      ];
    });
    seed.journal.forEach(
      (j, i) =>
        (j.photo = {
          url: "../media/" + ["roof", "room", "site"][i % 3] + ".jpg",
        }),
    );
    const root = process.argv[2] || "http://127.0.0.1:4182/";
    // Fresh automated context only: keep fixture storage separate from every user's account.
    await p.addInitScript((s) => {
      if (!localStorage.getItem("belkhi-unified-crm-v1/reference-test"))
        localStorage.setItem(
          "belkhi-unified-crm-v1/reference-test",
          JSON.stringify(s),
        );
    }, seed);
    await p.goto(root + "workspace-crm/?scope=reference-test");
    for (const width of [319, 390, 768, 1024, 1440]) {
      await p.setViewportSize({ width, height: width === 319 ? 509 : 900 });
      for (const view of ["projects", "day", "tasks", "team", "documents"]) {
        await p.locator(".crm-nav [data-view=" + view + "]").click();
        assert.ok(
          await p
            .locator("body")
            .evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          "overflow " + view + " " + width,
        );
        await p.screenshot({
          path: "/tmp/belkhi-reference-" + view + "-" + width + ".png",
        });
      }
    }
    await p.locator("[data-view=team]").click();
    await p.locator("[data-assign=adam]").click();
    assert.equal(
      await p.locator("#assign-inline-form [name=assignee]").inputValue(),
      "adam",
    );
    assert.equal(await p.locator("dialog").isVisible(), false);
    await p.setViewportSize({ width: 390, height: 844 });
    await p.locator("[data-view=projects]").click();
    await p.locator(".attention-trigger").click();
    await p
      .locator("#detail")
      .getByRole("button")
      .filter({ hasText: "Принять покраску стен" })
      .waitFor();
    await p.locator("[data-close-panel]").click();
    await p.locator("[data-view=tasks]").click();
    await p.locator("[data-board=review]").click();
    await p
      .locator(".kanban-task")
      .filter({ hasText: "Принять покраску стен" })
      .click();
    assert.equal(
      await p.locator("#task-form").count(),
      0,
      "read view must not open the edit form",
    );
    await p.locator("[data-task-check]").check();
    await p.locator("[name=comment]").fill("Покрытие проверено");
    await p.getByRole("button", { name: "Отправить комментарий" }).click();
    await p.locator(".task-comments").getByText("Покрытие проверено").waitFor();
    await p.locator("[data-status-task]").last().click();
    assert.equal(
      await p.locator("#detail").getAttribute("data-presentation"),
      "sheet",
    );
    await p.locator("[name=status][value=done]").check();
    await p.getByRole("button", { name: "Применить", exact: true }).click();
    await p.locator(".task-detail .status.done").waitFor();
    await p.locator("[data-close-panel]").click();
    await p.locator("dialog").waitFor({ state: "hidden" });
    assert.equal(
      await p.locator("[data-board=review]").getAttribute("aria-pressed"),
      "true",
    );
    await p.locator("[data-view=team]").click();
    await p.locator("[data-assign=adam]").click();
    await p.locator("#assign-form [name=task]").selectOption("t3");
    await p.locator("#assign-form [name=due]").fill("2026-12-20");
    await p.locator("#assign-form .primary").click();
    await p.locator("dialog").waitFor({ state: "hidden" });
    await p.locator("[data-person=adam]").click();
    await p
      .locator("#detail")
      .getByRole("button")
      .filter({ hasText: "Покрасить потолок" })
      .waitFor();
    await p.locator("[data-close-panel]").click();
    await p.locator("[data-view=projects]").click();
    await p.locator(".object-heading[data-project=flat]").click();
    await p.locator("[data-project-tab-choice=photos]").click();
    assert.ok((await p.locator(".project-gallery img").count()) > 0);
    await p.locator(".project-gallery button").first().click();
    await p.locator("[data-close-panel]").click();
    assert.equal(
      await p
        .locator("[data-project-tab-choice=photos]")
        .getAttribute("aria-pressed"),
      "true",
    );
    await p.locator("[data-close-panel]").click();
    await p.locator("[data-view=day]").click();
    await p.locator("[data-date]").first().click();
    await p.locator("#plan-date").fill("2026-12-25");
    assert.equal(
      await p
        .locator("[data-date][aria-pressed=true]")
        .getAttribute("data-date"),
      "2026-12-25",
    );
    await p.reload();
    const saved = await p.evaluate(() =>
      JSON.parse(localStorage.getItem("belkhi-unified-crm-v1/reference-test")),
    );
    assert.equal(saved.tasks[0].status, "done");
    assert.equal(saved.tasks[0].checklist[0].done, true);
    assert.equal(saved.tasks.find((t) => t.id === "t3").assignee, "adam");
    assert.deepEqual(errors, []);
    console.log(
      "PASS populated layouts 319–1440, read/edit separation, checklist, comments, status sheet, assignment, photo tab Back, calendar, persistence",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
