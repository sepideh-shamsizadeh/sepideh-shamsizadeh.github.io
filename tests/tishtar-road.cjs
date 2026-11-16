/* Browser acceptance tests. See docs/tishtar-maintenance.md for temporary QA setup. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const assert = require("node:assert/strict");
const base = process.env.TISHTAR_BASE_URL || "http://127.0.0.1:4175";
const browserOptions = { headless: true };
if (process.env.CHROME_PATH)
  browserOptions.executablePath = process.env.CHROME_PATH;

(async () => {
  const browser = await chromium.launch(browserOptions);
  try {
    const errors = [];
    async function context(options = {}) {
      const ctx = await browser.newContext(options);
      // Keep verification offline except for the local built site.
      await ctx.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.origin === new URL(base).origin) return route.continue();
        if (url.hostname === "sepideh-shamsizadeh.github.io") {
          return route.fulfill({
            response: await route.fetch({
              url: base + url.pathname + url.search,
            }),
          });
        }
        return route.abort();
      });
      return ctx;
    }
    async function load(ctx) {
      const page = await ctx.newPage();
      page.on("pageerror", (error) => { errors.push(error.message); console.error(error.message); });
      const response = await page.goto(base + "/tishtar/");
      assert.equal(response.status(), 200);
      await page.locator(".tr-drive:not([hidden])").waitFor();
      return page;
    }
    async function point(page, progress) {
      return page.locator(".tr-road-svg").evaluate((svg, t) => {
        const path = svg.querySelector(".tr-road-edge");
        const p = path.getPointAtLength(path.getTotalLength() * t);
        const screen = new DOMPoint(p.x, p.y).matrixTransform(
          svg.getScreenCTM(),
        );
        return { x: screen.x, y: screen.y };
      }, progress);
    }
    async function progress(page) {
      return Number(
        await page.locator(".tr-drive").getAttribute("data-progress"),
      );
    }
    async function frame(page) {
      await page.evaluate(() => new Promise(requestAnimationFrame));
    }
    async function assertConstrained(page) {
      const geometry = await page.locator(".tr-drive").evaluate((root) => {
        const svg = root.querySelector(".tr-road-svg");
        const path = root.querySelector(".tr-road-edge");
        const length = Number(root.dataset.progress) * path.getTotalLength();
        const point = path.getPointAtLength(length);
        const expected = new DOMPoint(point.x, point.y).matrixTransform(
          svg.getScreenCTM(),
        );
        const robot = root.querySelector(".tr-robot");
        const box = robot.getBoundingClientRect();
        const a = path.getPointAtLength(Math.max(0, length - 2));
        const b = path.getPointAtLength(
          Math.min(path.getTotalLength(), length + 2),
        );
        const tangent = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
        const actual = parseFloat(robot.style.getPropertyValue("--tr-heading"));
        return {
          error: Math.hypot(
            box.x + box.width / 2 - expected.x,
            box.y + box.height / 2 - expected.y,
          ),
          rotationError: Math.abs(((actual - tangent + 540) % 360) - 180),
        };
      });
      assert.ok(
        geometry.error < 1.2,
        "Robot escaped the path: " + JSON.stringify(geometry),
      );
      assert.ok(
        geometry.rotationError < 0.1,
        "Incorrect tangent rotation: " + JSON.stringify(geometry),
      );
    }

    const desktop = await context({ viewport: { width: 1440, height: 1700 } });
    const page = await load(desktop);
    const baseline = await page.locator("#tr-drive-data").textContent();
    const data = JSON.parse(baseline);
    const initial = data.milestones.find(
      (m) => m.id === data.road_current_milestone_id,
    ).road_position;
    assert.ok(Math.abs((await progress(page)) - initial) < 0.00001);
    assert.equal(await page.locator(".tr-road-marker").count(), 7);
    assert.equal(
      await page.locator(".tr-road-completed path").count(),
      data.milestones.filter((m) => m.status === "completed").length,
    );
    await page.locator(".tr-start").click();
    assert.equal(await page.locator(".tr-robot").evaluate(el => el === document.activeElement), true);
    await page.keyboard.press("w");
    assert.ok((await progress(page)) > initial);
    await page.keyboard.press("s");
    assert.ok(Math.abs((await progress(page)) - initial) < 0.00001);
    await page.locator('[data-drive="1"]').first().click();
    assert.ok((await progress(page)) > initial);
    await page.locator(".tr-return").click();
    await page.locator(".tr-robot").focus();
    await page.keyboard.press("Home");
    await page.locator(".tr-road-map").scrollIntoViewIfNeeded();
    let screen = await point(page, 0);
    await page.mouse.move(screen.x, screen.y);
    await page.mouse.down();
    assert.equal(
      await page
        .locator(".tr-robot")
        .evaluate((el) => el.classList.contains("is-dragging")),
      true,
    );
    let before = 0;
    // Traverse every bend with actual mouse input, checking path and tangent at each step.
    for (let i = 1; i <= 98; i++) {
      screen = await point(page, i / 100);
      await page.mouse.move(screen.x, screen.y);
      await frame(page);
      const at = await progress(page);
      assert.ok(Math.abs(at - before) < 0.03, "Unexpected branch jump");
      assert.ok(
        Math.abs(at - i / 100) < 0.012,
        "Robot did not follow pointer along the road",
      );
      await assertConstrained(page);
      before = at;
    }
    // Reverse direction through the bends without rotating the chassis by 180°.
    for (let i = 97; i >= 4; i--) {
      screen = await point(page, i / 100);
      await page.mouse.move(screen.x, screen.y);
      await frame(page);
      await assertConstrained(page);
      assert.ok(Math.abs((await progress(page)) - i / 100) < 0.012);
    }
    await page.mouse.up();
    assert.equal(
      await page.locator("dialog").evaluate((el) => el.open),
      false,
      "Drag opened a panel",
    );
    assert.ok(
      await page.locator(".tr-drive").getAttribute("data-last-crossed"),
    );
    assert.notEqual(
      await page.locator(".tr-wheel-spin").first().getAttribute("transform"),
      "rotate(0 -15 -21)",
    );
    assert.equal(await page.locator("#tr-drive-data").textContent(), baseline);
    assert.equal(await page.locator(".journey-stage").count(), 7);

    // Shift-click is an intentional full-path reposition, distinct from a drag.
    screen = await point(page, 0.813);
    await page.keyboard.down("Shift");
    await page.mouse.click(screen.x, screen.y);
    await page.keyboard.up("Shift");
    assert.ok(Math.abs((await progress(page)) - 0.813) < 0.001);
    assert.equal(await page.locator("dialog").evaluate((el) => el.open), false);
    await page.locator(".tr-return").click();
    assert.ok(Math.abs((await progress(page)) - initial) < 0.00001);
    // Deliberately pull toward a different lane in one event: only a local arc can be searched.
    screen = await point(page, initial);
    await page.mouse.move(screen.x, screen.y);
    await page.mouse.down();
    screen = await point(page, initial + 0.36);
    await page.mouse.move(screen.x, screen.y);
    await frame(page);
    assert.ok(
      Math.abs((await progress(page)) - initial) <= 0.026,
      "Jumped across a loop",
    );
    await page.mouse.up();
    assert.equal(await page.locator("dialog").evaluate((el) => el.open), false);

    await page.locator('.tr-road-marker[data-milestone="foundation"]').click();
    assert.equal(await page.locator("dialog").evaluate((el) => el.open), true);
    assert.equal(
      await page.locator("#tr-panel-title").textContent(),
      "A first spark of movement",
    );
    assert.ok(await page.locator('dialog a[href$="/issues/1"]').count());
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("dialog").evaluate((el) => el.open), false);
    assert.equal(
      await page
        .locator('.tr-road-marker[data-milestone="foundation"]')
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page.locator(".tr-return").click();
    await page.locator(".tr-robot").click();
    assert.equal(
      await page.locator("dialog").evaluate((el) => el.open),
      true,
      "Robot click should explore",
    );
    assert.ok(await page.locator('dialog a[href$="/issues/3"]').count());
    await page.keyboard.press("Escape");

    await page.locator(".tr-return").click();
    await page.keyboard.press("ArrowRight");
    assert.ok((await progress(page)) > initial);
    await page.keyboard.press("End");
    assert.equal(await progress(page), 1);
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("dialog").evaluate((el) => el.open), true);
    await page.locator(".tr-panel-close").click();
    assert.equal(
      await page
        .locator(".tr-robot")
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
    const wheel = await page
      .locator(".tr-wheel-spin")
      .first()
      .getAttribute("transform");
    await page.keyboard.press("ArrowLeft");
    assert.equal(
      await page.locator(".tr-wheel-spin").first().getAttribute("transform"),
      wheel,
    );
    assert.equal(
      await page
        .locator(".is-current")
        .evaluate((el) => getComputedStyle(el, "::after").animationName),
      "none",
    );

    const mobile = await context({
      viewport: { width: 390, height: 1000 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    const touch = await load(mobile);
    await touch.locator(".tr-robot").focus();
    await touch.keyboard.press("Home");
    await touch.locator(".tr-road-map").evaluate((el) => {
      const consoleHeight = document
        .querySelector(".tr-drive-console")
        .getBoundingClientRect().height;
      window.scrollTo(
        0,
        window.scrollY + el.getBoundingClientRect().top - consoleHeight - 20,
      );
    });
    const cdp = await mobile.newCDPSession(touch);
    screen = await point(touch, 0);
    const scrollBefore = await touch.evaluate(() => window.scrollY);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: screen.x, y: screen.y }],
    });
    for (let i = 1; i <= 94; i++) {
      screen = await point(touch, i / 100);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: screen.x, y: screen.y }],
      });
      await frame(touch);
      await assertConstrained(touch);
      assert.ok(
        Math.abs((await progress(touch)) - i / 100) < 0.012,
        "Touch drag failed to follow the road",
      );
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    assert.equal(
      await touch.evaluate(() => window.scrollY),
      scrollBefore,
      "Touch drag scrolled the page",
    );
    assert.equal(
      await touch.locator("dialog").evaluate((el) => el.open),
      false,
      "Touch drag opened a panel",
    );
    // Real touch scrolling beside the robot must still work.
    const map = await touch.locator(".tr-road-map").boundingBox();
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: map.x + 8, y: map.y + map.height / 2 }],
    });
    for (let dy = 10; dy <= 120; dy += 10) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: map.x + 8, y: map.y + map.height / 2 - dy }],
      });
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await touch.waitForFunction(
      (before) => window.scrollY > before + 20,
      scrollBefore,
    );
    await touch.locator('.tr-road-marker[data-milestone="navigation"]').tap();
    assert.equal(await touch.locator("dialog").evaluate((el) => el.open), true);
    await touch.locator(".tr-panel-close").tap();
    const afterClose = await progress(touch);
    assert.ok(afterClose > 0.7);
    await touch.locator(".tr-return").tap();
    assert.ok(Math.abs((await progress(touch)) - initial) < 0.00001);
    // Cancellation releases capture and must not be interpreted as a click.
    screen = await point(touch, initial);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: screen.x, y: screen.y }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: screen.x + 20, y: screen.y + 20 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchCancel",
      touchPoints: [],
    });
    assert.equal(
      await touch
        .locator(".tr-robot")
        .evaluate((el) => el.classList.contains("is-dragging")),
      false,
    );
    assert.equal(
      await touch.locator("dialog").evaluate((el) => el.open),
      false,
    );
    assert.equal(await touch.locator("#tr-drive-data").textContent(), baseline);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1100 });
      await page.waitForFunction(
        () => document.documentElement.scrollWidth <= innerWidth,
      );
      await assertConstrained(page);
    }
    const nojs = await context({ javaScriptEnabled: false });
    const fallback = await nojs.newPage();
    await fallback.goto(base + "/tishtar/");
    assert.equal(await fallback.locator(".tr-drive").isVisible(), false);
    assert.equal(await fallback.locator(".journey-stage").count(), 7);
    assert.equal(await fallback.locator("#milestone-navigation").isVisible(), true);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: mouse + emulated touch through all bends; local branch constraint; tangent rotation; wheels; crossing detection; no drag modals; marker/robot clicks; evidence links; modal close/focus; keyboard; return; immutable statuses; touch scroll prevention and normal background scrolling; reduced motion; resize; no-JS fallback.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
