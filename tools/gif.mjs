// Records an animated tour of showcase.html as docs/showcase.gif.
// Frames come from Chromium's DevTools screencast, so they are lossless and
// carry real timestamps; ffmpeg then caps the frame rate and the palette.
// Runs inside the container built by tools/run.sh; the repo is mounted at /work.
import { chromium } from "playwright";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const width = 800;
const height = 600;
const fps = 8;
const colors = 40;
const out = "/work/docs/showcase.gif";
const frames = "/tmp/frames";

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
  #tour-pointer.down { scale: 0.7; }`,
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

async function tour() {
  await pause(1200);
  await click("body > header > button");
  await pause(800);
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
