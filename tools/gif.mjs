// Records an animated tour of showcase.html as docs/showcase.gif.
// Frames come from Chromium's DevTools screencast, so they are lossless and
// carry their own timestamps; ffmpeg then caps the frame rate and the palette.
// Runs inside the container built by tools/run.sh; the repo is mounted at /work.
import { chromium } from "playwright";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { execFileSync, spawnSync } from "node:child_process";

const width = 800;
const height = 600;
const fps = 8;
const colors = 40;
const out = "/work/docs/showcase.gif";
const frames = "/tmp/frames";
// Play the tour this many times faster than real time. libfaketime speeds up
// every clock and timer in Node and Chromium alike, so pauses, transitions,
// smooth scrolling and frame timestamps all stay in step, and recording takes
// a fraction of the gif's length.
const speed = 4;

if (!process.env.FAKETIME) {
  const { status } = spawnSync(
    "faketime",
    ["-m", "-f", `+0 x${speed}`, process.execPath, ...process.argv.slice(1)],
    {
      stdio: "inherit",
      // Speed up the monotonic clock too, which Node's timers and Chromium's
      // frames run on; faketime leaves it alone by default.
      env: { ...process.env, FAKETIME_DONT_FAKE_MONOTONIC: "0" },
    },
  );
  process.exit(status ?? 1);
}

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width, height },
  colorScheme: "light",
});
await page.goto("file:///work/showcase.html", { waitUntil: "networkidle" });

// Headless browsers draw no pointer, so add a dot that follows the mouse. It is
// a manual popover so it can sit above dialogs and menus in the top layer.
await page.addStyleTag({
  content: `#tour-pointer {
    position: fixed; inset: auto; width: 22px; height: 22px; margin: -11px 0 0 -11px;
    padding: 0; border: 2px solid #fff; border-radius: 50%; overflow: visible;
    background: rgb(0 0 0 / 0.35); box-shadow: 0 1px 4px rgb(0 0 0 / 0.4);
    opacity: 1; translate: none; transition: scale 0.15s; pointer-events: none;
  }
  #tour-pointer.down { scale: 0.7; }
  #tour-options { margin: 0.25rem 0; max-width: none; overflow-y: auto; position-area: none; }
  #tour-options li:not(:has(button)) {
    padding: 0.75rem 0.75rem 0.25rem; color: var(--on-surface-variant); font: var(--label);
  }
  #tour-options [aria-current] { --bg: var(--secondary-container); color: var(--on-secondary-container); }`,
});
await page.evaluate(() => {
  const dot = document.createElement("i");
  dot.id = "tour-pointer";
  dot.popover = "manual";
  document.body.append(dot);
  dot.showPopover();
  const move = (e) =>
    dot.style.setProperty("left", `${e.clientX}px`) ||
    dot.style.setProperty("top", `${e.clientY}px`);
  addEventListener("mousemove", move, true);
  addEventListener("mousedown", () => dot.classList.add("down"), true);
  addEventListener("mouseup", () => dot.classList.remove("down"), true);

  // A select's option list is drawn by the browser outside the page, so it
  // never shows in the frames. Open a look-alike menu in its place instead. It
  // goes inside the select's popover, if any, so clicking it doesn't
  // light-dismiss the drawer.
  const menu = document.createElement("menu");
  menu.id = "tour-options";
  menu.popover = "manual";
  const item = (select, option) => {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.value = option.value;
    button.textContent = option.label;
    if (option.selected) button.ariaCurrent = "true";
    button.onclick = () => {
      select.value = option.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      menu.hidePopover();
    };
    li.append(button);
    return li;
  };
  const heading = (group) => {
    const li = document.createElement("li");
    li.textContent = group.label;
    return li;
  };
  addEventListener(
    "mousedown",
    (e) => {
      const select = e.target.closest("select");
      if (!select) return;
      e.preventDefault();
      menu.replaceChildren(
        ...[...select.children].flatMap((child) =>
          child.tagName === "OPTGROUP"
            ? [
                heading(child),
                ...[...child.children].map((o) => item(select, o)),
              ]
            : [item(select, child)],
        ),
      );
      const box = select.getBoundingClientRect();
      menu.style.inset = `${box.bottom}px auto auto ${box.left}px`;
      menu.style.width = `${box.width}px`;
      menu.style.maxHeight = `${innerHeight - box.bottom - 16}px`;
      (select.closest("[popover]") ?? document.body).append(menu);
      menu.showPopover();
    },
    true,
  );
});

const pause = (ms) => page.waitForTimeout(ms);
let pointer = { x: width / 2, y: height / 2 };
await page.mouse.move(pointer.x, pointer.y);

// Glide the pointer with an ease-out curve.
async function moveTo(x, y) {
  const from = pointer;
  const steps = 16;
  for (let i = 1; i <= steps; i++) {
    const t = 1 - (1 - i / steps) ** 3;
    await page.mouse.move(from.x + (x - from.x) * t, from.y + (y - from.y) * t);
    await pause(16);
  }
  pointer = { x, y };
}

async function hover(selector) {
  const box = await page.locator(selector).first().boundingBox();
  await moveTo(box.x + box.width / 2, box.y + box.height / 2);
}

// Click, then lift the pointer back above anything that just opened.
async function click(selector) {
  if (selector) await hover(selector);
  await pause(120);
  await page.mouse.down();
  await pause(120);
  await page.mouse.up();
  await page.evaluate(() => {
    const dot = document.getElementById("tour-pointer");
    dot.hidePopover();
    dot.showPopover();
  });
}

// Smooth-scroll an element (or the top of the page) into view and wait until
// the scroll has finished, so the next click lands where it should.
async function scrollTo(selector) {
  await page.evaluate(
    (selector) =>
      new Promise((resolve) => {
        addEventListener("scrollend", resolve, { once: true });
        setTimeout(resolve, 2500);
        if (selector)
          document
            .querySelector(selector)
            .scrollIntoView({ behavior: "smooth" });
        else scrollTo({ top: 0, behavior: "smooth" });
      }),
    selector,
  );
  await pause(300);
}

// Pick from the drawer's theme select, through the look-alike option list.
async function pickTheme(theme) {
  await click('body > nav select[name="theme"]');
  await pause(400);
  await click(`#tour-options button[value="${theme}"]`);
  await pause(600);
}

async function tour() {
  await pause(1200);
  await click("body > header > button");
  await pause(800);
  await pickTheme("rose");
  await pickTheme("olive");
  await pickTheme("teal");
  await click('body > nav a[href="#buttons"]');
  await pause(700);
  await moveTo(width - 50, height / 2);
  await click();
  await pause(600);
  await hover('#buttons [aria-label="Settings"]');
  await pause(1100);
  await click("#buttons button >> text=Filled");
  await pause(300);
  await click("#buttons button >> text=Tonal");
  await pause(500);
  await click('body > header label:has([value="dark"])');
  await pause(1000);
  // Open the search hints, hover one (they're links, so don't click), then
  // close them by clicking the heading just below the panel.
  await scrollTo('#text-fields input[type="search"]');
  await click('#text-fields input[type="search"]');
  await pause(900);
  await hover('#text-fields [type="search"] + ul li:nth-child(2) a');
  await pause(800);
  await click("#selection h2");
  await pause(600);
  await scrollTo("#selection");
  await click('#selection input[name="usage"]');
  await pause(400);
  await click('#selection input[value="push"]');
  await pause(500);
  await scrollTo("#chips");
  await click("#chips label:has(input[value=vegan])");
  await pause(300);
  await click("#chips label:has(input[value=express])");
  await pause(600);
  await scrollTo("#tabs");
  await click("#tabs summary >> text=Hotels");
  await pause(600);
  await click("#tabs summary >> text=Cars");
  await pause(600);
  await scrollTo("#panels");
  await click("#panels summary >> nth=1");
  await pause(900);
  await scrollTo("#dialogs");
  await click("text=Open dialog");
  await pause(1200);
  await click("dialog[open] button >> text=Cancel");
  await pause(500);
  await click('[popovertarget="create"]');
  await pause(1300);
  await click('[popovertarget="create"]');
  await pause(500);
  await scrollTo("#snackbar");
  await click('[popovertarget="toast"]');
  await pause(1500);
  await click("#toast >> text=Undo");
  await pause(500);
  await click('body > header label:has([value="auto"])');
  await pause(600);
  await click("body > header > button");
  await pause(800);
  await pickTheme("violet");
  await click('body > nav [popovertargetaction="hide"]');
  await pause(500);
  await scrollTo();
  await pause(1200);
}

// Record: keep every screencast frame with its timestamp.
const cdp = await page.context().newCDPSession(page);
const shots = [];
cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
  shots.push({ data, time: metadata.timestamp });
  cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
});
await cdp.send("Page.startScreencast", {
  format: "png",
  maxWidth: width,
  maxHeight: height,
  // Plenty for the frame rate, and half the PNGs to encode and decode, work
  // that runs on the sped-up clock and would otherwise drag the tour out.
  everyNthFrame: 2,
});
await tour();
await cdp.send("Page.stopScreencast");
await browser.close();

// Write the frames with their real durations, then let ffmpeg resample them to
// a fixed rate, build one shared palette and store only the changed rectangles.
await rm(frames, { recursive: true, force: true });
await mkdir(frames, { recursive: true });
let list = "";
for (const [i, shot] of shots.entries()) {
  const file = `${frames}/${String(i).padStart(5, "0")}.png`;
  await writeFile(file, Buffer.from(shot.data, "base64"));
  const next = shots[i + 1]?.time ?? shot.time + 1;
  list += `file '${file}'\nduration ${(next - shot.time).toFixed(3)}\n`;
}
list += `file '${frames}/${String(shots.length - 1).padStart(5, "0")}.png'\n`;
await writeFile(`${frames}/list.txt`, list);

await mkdir("/work/docs", { recursive: true });
execFileSync("ffmpeg", [
  "-y",
  "-loglevel",
  "error",
  "-f",
  "concat",
  "-safe",
  "0",
  "-i",
  `${frames}/list.txt`,
  "-vf",
  `fps=${fps},split[a][b];[a]palettegen=max_colors=${colors}[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
  "-loop",
  "0",
  out,
]);
console.log(
  `${shots.length} frames captured, written to ${out.replace("/work/", "")}`,
);
