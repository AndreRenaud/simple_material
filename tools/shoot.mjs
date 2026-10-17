// Screenshots and videos of showcase.html in each browser engine.
// Runs inside the container built by tools/run.sh; the repo is mounted at /work.
//   --browsers chromium,firefox,webkit   --schemes light,dark
//   --only tabs,dialog   (just these sections/states)   --video (record the animation tour)
//   --mobile   (sections, states and video at phone width)
//   --reduced-motion   (no animations, so runs are repeatable for pixel diffs)
import { chromium, firefox, webkit } from "playwright";
import { mkdir, rename } from "node:fs/promises";

const engines = { chromium, firefox, webkit };
const args = process.argv.slice(2);
const option = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i < 0 ? fallback : args[i + 1];
};
const browsers = option("--browsers", "chromium,firefox,webkit").split(",");
const schemes = option("--schemes", "light,dark").split(",");
const only = option("--only", "").split(",").filter(Boolean);
const video = args.includes("--video");
const wanted = (name) => !only.length || only.includes(name);
const out = "/work/screenshots";
const url = "file:///work/showcase.html";
const desktop = { width: 1280, height: 800 };
const mobile = { width: 390, height: 844 };
const viewport = args.includes("--mobile") ? mobile : desktop;
const reducedMotion = args.includes("--reduced-motion")
  ? "reduce"
  : "no-preference";
const pause = (page, ms = 600) => page.waitForTimeout(ms);

// Wait for every finite animation and transition to finish. Headless WebKit can
// hold a transition at its start for a while, so fixed pauses aren't reliable.
// Capped at 2s: transitions inside content-visibility: hidden never advance.
const settle = (page) =>
  page.evaluate(() =>
    Promise.race([
      Promise.all(
        document
          .getAnimations()
          .filter((a) => a.timeline === document.timeline)
          .filter((a) => a.effect?.getComputedTiming().endTime !== Infinity)
          .map((a) => a.finished.catch(() => {})),
      ),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]),
  );

// Interaction states. Each returns the section to capture, or nothing for the
// viewport, and starts from a fresh page load.
const states = {
  async tooltip(p) {
    await p.hover('#buttons [aria-label="Settings"]');
    await pause(p, 400);
    return "#buttons";
  },
  async ripple(p) {
    await p.hover("#buttons button");
    await p.mouse.down();
    await pause(p, 120);
    return "#buttons";
  },
  async "invalid-field"(p) {
    await p.fill('#text-fields input[type="email"]', "not-an-email");
    await p.focus('#text-fields input[name="password"]');
    return "#text-fields";
  },
  // Scrolled to the top of the viewport, as the panel hangs below the section.
  async "search-hints"(p) {
    const search = p.locator('#text-fields input[type="search"]');
    await search.evaluate((el) =>
      el.scrollIntoView({ block: "start", behavior: "instant" }),
    );
    await search.click();
  },
  async "chips-toggled"(p) {
    await p.click("#chips label:has(input[value=vegan])");
    await p.click("#chips label:has(input[value=express])");
    return "#chips";
  },
  async "selection-toggled"(p) {
    await p.click('#selection input[name="usage"]');
    await p.click('#selection input[value="push"]');
    return "#selection";
  },
  async "tabs-hotels"(p) {
    await p.click("#tabs summary >> text=Hotels");
    return "#tabs";
  },
  async "panels-second"(p) {
    await p.click("#panels summary >> nth=1");
    return "#panels";
  },
  async dialog(p) {
    await p.click("text=Open dialog");
  },
  async sheet(p) {
    await p.click("text=Open bottom sheet");
  },
  async menu(p) {
    await p.click('[popovertarget="sort"]');
  },
  async snackbar(p) {
    await p.click('[popovertarget="toast"]');
  },
  async "fab-menu"(p) {
    await p.click('[popovertarget="create"]');
  },
  // Pick the theme opposite to the browser's with the app bar's segmented
  // button, then scroll a little so the app bar shows its scrolled colour.
  async "theme-switch"(p) {
    const dark = await p.evaluate(
      () => matchMedia("(prefers-color-scheme: dark)").matches,
    );
    await p.click(
      `body > header label:has([value="${dark ? "light" : "dark"}"])`,
    );
    await p.evaluate(() => scrollTo({ top: 600, behavior: "instant" }));
  },
  // The ☰ drawer, on narrow screens; the side column on wide ones.
  async drawer(p) {
    const menu = p.locator("body > header > button");
    if (await menu.isVisible()) await menu.click();
  },
  // Far down the page: the app bar and side nav must still be on screen.
  async scrolled(p) {
    await p.evaluate(() => scrollTo({ top: 5000, behavior: "instant" }));
  },
};

// Each colour theme, picked with the nav's select, over the buttons. Forced,
// as on narrow screens the select is inside the closed drawer.
for (const theme of [
  "rose",
  "orange",
  "olive",
  "teal",
  "navy",
  "win98",
  "win98-rainy-day",
  "win98-eggplant",
  "win98-spruce",
  "win98-brick",
  "macos9",
  "macos9-silver",
]) {
  states[`theme-${theme}`] = async (p) => {
    await p.selectOption('body > nav select[name="theme"]', theme, {
      force: true,
    });
    await p.locator("#buttons").scrollIntoViewIfNeeded();
  };
}

// A walk through every animated widget, for --video.
async function tour(p) {
  const show = async (selector) => {
    await p.locator(selector).scrollIntoViewIfNeeded();
    await pause(p, 400);
  };
  await show("#buttons");
  for (const name of ["Filled", "Tonal", "Outlined"]) {
    await p.click(`#buttons button >> text=${name}`);
    await pause(p, 400);
  }
  await p.hover('#buttons [aria-label="Settings"]');
  await pause(p, 1000);
  await show("#text-fields");
  await p.click('#text-fields input[name="name"]');
  await pause(p);
  await p.fill('#text-fields input[type="email"]', "nope");
  await p.click('#text-fields input[name="password"]');
  await pause(p, 800);
  await show('#text-fields input[type="search"]');
  await p.click('#text-fields input[type="search"]');
  await pause(p, 1000);
  await p.click("#text-fields > p");
  await pause(p, 400);
  await show("#selection");
  for (const target of [
    '[value="push"]',
    '[name="usage"]',
    '[value="satellite"]',
  ]) {
    await p.click(`#selection input${target}`);
    await pause(p, 500);
  }
  await show("#chips");
  for (const value of ["vegan", "express", "vegetarian"]) {
    await p.click(`#chips label:has(input[value=${value}])`);
    await pause(p, 500);
  }
  await show("#progress");
  await pause(p, 1500);
  await show("#tabs");
  for (const name of ["Hotels", "Cars", "Flights"]) {
    await p.click(`#tabs summary >> text=${name}`);
    await pause(p, 500);
  }
  await show("#panels");
  for (const n of [1, 2, 0]) {
    await p.click(`#panels summary >> nth=${n}`);
    await pause(p, 700);
  }
  await show("#dialogs");
  await p.click("text=Open dialog");
  await pause(p, 1000);
  await p.click("dialog[open] button >> text=Cancel");
  await pause(p, 700);
  await p.click("text=Open bottom sheet");
  await pause(p, 1000);
  await p.keyboard.press("Escape");
  await pause(p, 700);
  await show("#menus");
  await p.click('[popovertarget="sort"]');
  await pause(p, 1000);
  await p.keyboard.press("Escape");
  await pause(p, 500);
  await p.click('[popovertarget="create"]');
  await pause(p, 1200);
  await p.click('[popovertarget="create"]');
  await pause(p, 700);
  await show("#snackbar");
  await p.click('[popovertarget="toast"]');
  await pause(p, 1500);
  await p.click("#toast >> text=Undo");
  await pause(p, 700);
}

async function load(page) {
  await page.goto(url, { waitUntil: "networkidle" });
  // Lazy images never load in a full-page capture, so fetch them up front.
  await page.evaluate(() =>
    Promise.all(
      [...document.images].map((img) => {
        img.loading = "eager";
        return img.decode().catch(() => {});
      }),
    ),
  );
}

await mkdir(out, { recursive: true });

for (const name of browsers) {
  const browser = await engines[name].launch();
  for (const colorScheme of schemes) {
    const base = `${name}-${colorScheme}`;
    const tag = viewport === mobile ? `${base}-mobile` : base;
    const context = await browser.newContext({
      colorScheme,
      viewport,
      reducedMotion,
    });
    const page = await context.newPage();
    page.on(
      "console",
      (m) => m.type() === "error" && console.log(tag, m.text()),
    );
    page.on("pageerror", (e) => console.log(tag, "page error:", e.message));
    await load(page);

    if (wanted("full")) {
      for (const [suffix, size] of [
        ["", desktop],
        ["-mobile", mobile],
      ]) {
        await page.setViewportSize(size);
        await page.screenshot({
          path: `${out}/${base}-full${suffix}.png`,
          fullPage: true,
        });
      }
      await page.setViewportSize(viewport);
    }

    // The sticky app bar would cover the top of each section capture.
    await page.addStyleTag({
      content: "body > header { position: static !important }",
    });
    const sections = await page.$$eval("main > :is(header, section)", (els) =>
      els.map((el) => el.id || "intro"),
    );
    for (const id of sections.filter(wanted)) {
      const target = id === "intro" ? "main > header" : `#${id}`;
      await page
        .locator(target)
        .screenshot({ path: `${out}/${tag}-${id}.png` });
    }

    for (const [state, act] of Object.entries(states).filter(([s]) =>
      wanted(s),
    )) {
      await load(page);
      try {
        const section = await act(page);
        if (state !== "ripple") await settle(page);
        const target = section ? page.locator(section) : page;
        await target.screenshot({ path: `${out}/${tag}-${state}.png` });
      } catch (error) {
        console.log(tag, state, "failed:", error.message.split("\n")[0]);
      }
      await page.mouse.up();
    }
    await context.close();

    if (video) {
      const recording = await browser.newContext({
        colorScheme,
        viewport,
        recordVideo: { dir: out, size: viewport },
      });
      const tourPage = await recording.newPage();
      await load(tourPage);
      try {
        await tour(tourPage);
      } catch (error) {
        console.log(tag, "tour failed:", error.message.split("\n")[0]);
      }
      await recording.close();
      await rename(await tourPage.video().path(), `${out}/${tag}-tour.webm`);
    }
    console.log(tag, "done");
  }
  await browser.close();
}
