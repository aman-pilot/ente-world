import {randomUUID} from 'node:crypto';
import {mkdir, readFile, readdir, rename, rm, writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';

export function prerenderCache(root, fingerprint, logger) {
  const override = process.env.DUCKY_ART_CACHE_DIR;
  if (!override && process.env.CF_PAGES !== '1') return;
  // Pages saves npm's global cache directory when Build cache is enabled.
  const dir = override ? path.resolve(root, override) :
    path.join(process.env.npm_config_cache || path.join(homedir(), '.npm'), 'ducky-land-art');
  const used = new Set();
  let writable = true;
  const ready = mkdir(dir, {recursive: true}).catch(disable);
  const nameFor = name => fingerprint + '-' + path.basename(name);
  function disable(error) {
    if (writable) logger.warn(`Artwork cache unavailable: ${error.message}`);
    writable = false;
  }
  return {
    async read(name) {
      await ready;
      const key = nameFor(name);
      try {
        const bytes = await readFile(path.join(dir, key));
        used.add(key);
        return bytes;
      } catch (error) {
        if (error.code !== 'ENOENT') disable(error);
      }
    },
    async write(name, bytes) {
      await ready;
      if (!writable) return;
      const key = nameFor(name);
      const temp = path.join(dir, '.ducky-art-' + randomUUID());
      try {
        await writeFile(temp, bytes);
        await rename(temp, path.join(dir, key));
        used.add(key);
      } catch (error) {
        disable(error);
        await rm(temp, {force: true}).catch(() => {});
      }
    },
    async prune() {
      await ready;
      if (!writable) return;
      try {
        // Keep only this build's assets so the project cache doesn't grow
        // with each new art revision. Ignore unrelated files in the directory.
        for (const name of await readdir(dir)) {
          if (/^[a-f0-9]{24}-(?:manifest\.json|(?:[a-f0-9]{24}|(?:sheet|detail)-[a-f0-9]{24})\.webp)$/.test(name) && !used.has(name)) {
            await rm(path.join(dir, name), {force: true});
          }
        }
      } catch (error) {
        disable(error);
      }
    },
  };
}
