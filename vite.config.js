import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {readFileSync} from 'node:fs';
import {productionProxy,productionSignIn} from './scripts/vite-production-proxy.mjs';
import {groundMesh} from './scripts/vite-ground-mesh.mjs';
import {prerenderArt} from './scripts/vite-prerender-art.mjs';
import {pruneUnusedArt} from './scripts/vite-prune-art.mjs';

export default defineConfig({
  appType: 'mpa',
  build: {target:'esnext'},
  plugins: [react(), productionSignIn(), groundMesh(), prerenderArt(), pruneUnusedArt(), {
    // the landing intro's globe code (three.js) is asked for from the page head, alongside the main bundle, instead
    // of waiting for the main bundle to run and ask for it
    name: 'preload-landing-globe',
    apply: 'build',
    transformIndexHtml: {order: 'post', handler(html, {bundle}) {
      if (!bundle) return html;
      const entry = Object.values(bundle).find(c => c.type === 'chunk' && c.facadeModuleId?.endsWith('/src/landing/globe-intro.js'));
      if (!entry) return html;
      const files = new Set([entry.fileName]);
      const walk = c => c.imports.forEach(f => {if (!files.has(f)) {files.add(f); walk(bundle[f]);}});
      walk(entry);
      const tags = [...files].map(f => ({tag: 'link', attrs: {rel: 'modulepreload', crossorigin: true, href: '/' + f}, injectTo: 'head'}));
      // the game's files, by name, so the landing can fetch them quietly once the intro has settled (rel=prefetch:
      // download only, nothing runs, so the end screen never freezes while the 18 MB game code is evaluated)
      const game = Object.values(bundle).find(c => c.type === 'chunk' && c.facadeModuleId?.endsWith('/src/app/PixiPage.jsx'));
      if (game) {
        const gf = new Set([game.fileName, ...(game.viteMetadata?.importedCss || [])]);
        const walkG = c => c.imports.forEach(f => {if (!gf.has(f) && !files.has(f) && !bundle[f].isEntry) {gf.add(f); bundle[f].viteMetadata?.importedCss?.forEach(x => gf.add(x)); walkG(bundle[f]);}});
        walkG(game);
        tags.push({tag: 'script', children: `window.__EW_GAME=${JSON.stringify([...gf].map(f => '/' + f))}`, injectTo: 'head'});
      }
      return tags;
    }},
  }, {
    name: 'share-theme-walk-data',
    apply: 'build',
    enforce: 'post',
    transform(code, id) {
      if (!/\/assets\/world\/themes\/[^/]+\/walk-world\.json$/.test(id)) return;
      const world = JSON.parse(readFileSync(id.replace('walk-world.json', 'world.json'), 'utf8'));
      const walk = JSON.parse(readFileSync(id, 'utf8'));
      const overrides = Object.fromEntries(Object.entries(walk).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(world[key])));
      const removed = Object.keys(world).filter(key => !(key in walk));
      return {code: `import world from './world.json'; const walk = {...world, ...${JSON.stringify(overrides)}}; ${removed.map(key => `delete walk[${JSON.stringify(key)}];`).join('')} export default walk;`, map: null};
    },
  }],
  server: {host:'127.0.0.1',proxy:productionProxy()},
});
