// Bundles src/main.ts with esbuild into dist/ (GitHub Pages serves dist/).
//   node scripts/build.mjs          production build (minified)
//   node scripts/build.mjs --dev    dev server with live rebuild on http://localhost:5173
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const dev = process.argv.includes('--dev');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'dist');

function copyStatic() {
  fs.mkdirSync(out, { recursive: true });
  fs.copyFileSync(path.join(root, 'index.html'), path.join(out, 'index.html'));
  fs.cpSync(path.join(root, 'public'), out, { recursive: true });
}

const options = {
  entryPoints: { main: path.join(root, 'src/main.ts') },
  bundle: true,
  format: 'esm',
  target: 'es2020',
  outdir: path.join(out, 'assets'),
  sourcemap: true,
  minify: !dev && !process.argv.includes('--no-minify'),
  legalComments: 'none',
  logLevel: 'info',
};

fs.rmSync(out, { recursive: true, force: true });
copyStatic();
if (dev) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: out, port: 5173 });
  console.log(`Racing Line dev server: http://localhost:${port}/  (add ?debug to expose game state on window)`);
} else {
  await esbuild.build(options);
}
