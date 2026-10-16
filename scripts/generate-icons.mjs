// Regenerates the PNG app icons from public/notebook.svg.
// Run with: npm run icons
import sharp from "sharp";
import { mkdir, readFile } from "node:fs/promises";

const OUT = "public/icons";
await mkdir(OUT, { recursive: true });
const svg = await readFile("public/notebook.svg");

// The SVG has a 64x64 viewBox; density is DPI, and 72 DPI renders it at 64px.
const render = (size) =>
  sharp(svg, { density: (size / 64) * 72 }).resize(size, size).png();

await render(192).toFile(`${OUT}/icon-192.png`);
await render(512).toFile(`${OUT}/icon-512.png`);

// iOS home-screen icon: opaque background with the notebook centered and
// padded (iOS puts black behind transparent PNGs and applies its own mask).
const size = 180;
const inner = Math.round(size * 0.68);
const bg = await sharp({
  create: { width: size, height: size, channels: 4, background: "#ffffff" },
}).png().toBuffer();
const icon = await sharp(svg, { density: (inner / 64) * 72 })
  .resize(inner, inner)
  .png()
  .toBuffer();
await sharp(bg)
  .composite([{ input: icon, gravity: "center" }])
  .png()
  .toFile(`${OUT}/apple-touch-icon.png`);

console.log("Icons written to", OUT);
