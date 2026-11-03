import sharp from "sharp";
const p = process.argv[2] || "shots-qa/t870-export-1.png";
const { data, info } = await sharp(p).raw().toBuffer({ resolveWithObject: true });
const w = info.width, ch = info.channels;
const px = (x, y) => { const i = (y * w + x) * ch; return [data[i], data[i+1], data[i+2]]; };
const eq = (a, c, tol = 10) => Math.abs(a[0]-c[0]) <= tol && Math.abs(a[1]-c[1]) <= tol && Math.abs(a[2]-c[2]) <= tol;
const BORDER = [0x33,0x45,0x55], BG = [0x0b,0x12,0x20];
// horizontal border edges: rows 584..628, x-extent of border-family runs
for (const y of [585, 586, 587, 625, 626, 627]) {
  let min = null, max = null, n = 0;
  for (let x = 0; x < w; x++) if (eq(px(x, y), BORDER, 20)) { if (min === null) min = x; max = x; n++; }
  console.log(`row y=${y}: border-family x ${min}..${max} (n=${n})`);
}
// all cyan-family pixels in the footer
const cyan = [];
for (let y = 574; y < 638; y++) for (let x = 0; x < w; x++) {
  const c = px(x, y);
  if (eq(c, [0x22,0xd3,0xee], 40) || (c[0] < 45 && c[1] > 70 && c[2] > 90 && c[2] > c[1])) cyan.push([x, y, c.map(v=>v.toString(16).padStart(2,"0")).join("")]);
}
console.log(`cyan-family px: ${cyan.length}; cols: ${JSON.stringify([...new Set(cyan.map(e=>e[0]))])}`);
console.log(`cyan rows at first col: ${JSON.stringify(cyan.filter(e=>e[0]===cyan[0]?.[0]).map(e=>e[1]))}`);
// bar-region extent at a bar-top row (y=592): non-bg extent between 300 and 900
for (const y of [590, 592, 600, 610, 614]) {
  let min = null, max = null;
  for (let x = 300; x < 900; x++) if (!eq(px(x, y), BG, 8)) { if (min === null) min = x; max = x; }
  console.log(`row y=${y}: non-bg x ${min}..${max}`);
}
