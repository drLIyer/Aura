// Turns the demo build into one self-contained page (styles and script inlined), for static hosting.
import { readFileSync, writeFileSync } from "fs";
import path from "path";

const dir = "dist/demo";
const html = readFileSync(path.join(dir, "index.html"), "utf8");
const asset = (re) => {
  const m = html.match(re);
  if (!m) throw new Error(`asset not found: ${re}`);
  return readFileSync(path.join(dir, m[1]), "utf8");
};
const css = asset(/<link rel="stylesheet"[^>]*href="\.?\/?([^"]+\.css)"/);
// A literal "</script" inside the bundle would end the inline script early.
const js = asset(/<script type="module"[^>]*src="\.?\/?([^"]+\.js)"/).replace(/<\/script/gi, "<\\/script");
const fonts = "https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800&display=swap";

const page = `<title>Migraine Monitor Demo</title>
<meta name="description" content="Demo of the Personalized Migraine Monitor and Predictor with a fictional patient.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fonts}">
<style>${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`;
writeFileSync(path.join(dir, "migraine-demo.html"), page);
console.log(`dist/demo/migraine-demo.html: ${(page.length / 1024).toFixed(0)} KB`);
