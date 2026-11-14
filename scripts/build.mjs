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
  // three.js is loaded on demand (render3d/view3d.ts) into its own chunk
  splitting: true,
  chunkNames: 'chunks/[name]-[hash]',
  target: 'es2020',
  outdir: path.join(out, 'assets'),
  sourcemap: true,
  minify: !dev && !process.argv.includes('--no-minify'),
  legalComments: 'none',
  // font files (public/fonts) are copied to dist/ as they are, not bundled
  external: ['*.woff', '*.woff2'],
  logLevel: 'info',
};

fs.rmSync(out, { recursive: true, force: true });
copyStatic();
if (dev) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: out, port: 5173 });
  console.log(
    `Racing Line dev server: http://localhost:${port}/  (add ?debug to expose game state on window)`,
  );
} else {
  await esbuild.build(options);
  // cache-busting: GitHub Pages caches files for ~10 min and the bundle names don't change, so a fresh
  // index.html could load a stale main.js (or the reverse) and break the page. Version the URLs by content.
  const hash = (await import('node:crypto'))
    .createHash('sha1')
    .update(fs.readFileSync(path.join(out, 'assets/main.js')))
    .update(fs.readFileSync(path.join(out, 'assets/main.css')))
    .digest('hex')
    .slice(0, 10);
  const ix = path.join(out, 'index.html');
  fs.writeFileSync(
    ix,
    fs
      .readFileSync(ix, 'utf8')
      .replace('./assets/main.css"', `./assets/main.css?v=${hash}"`)
      .replace('./assets/main.js"', `./assets/main.js?v=${hash}"`),
  );
}
