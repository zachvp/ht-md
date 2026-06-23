#!/usr/bin/env tsx
/*
Builds the extension for one or more browser targets into dist/<target>/
and packages each into a browser-appropriate archive under dist/.

Usage:
  npm run build              # all targets
  npm run build:firefox
  npm run build:chrome
*/

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SECTIONS } from '../src/options/definitions';
import { buildSectionMap, processTemplate } from './html-template';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg: { name: string } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

const TARGETS: Record<string, { manifestOverride: string; archiveExt: string | null; backgroundKey: string }> = {
  firefox: { manifestOverride: 'manifest.firefox.json', archiveExt: null,  backgroundKey: 'scripts' },
  chrome:  { manifestOverride: 'manifest.chrome.json',  archiveExt: 'zip', backgroundKey: 'service_worker' },
};

/*
Firefox MV3 uses event pages (scripts array), while
Chromium requires service_worker and silently ignores
scripts. This check catches a manifest that accidentally ships the wrong key for a given target.
*/
const BACKGROUND_KEYS = ['scripts', 'service_worker'];

function checkBackgroundKey(manifest: Record<string, any>, config: { backgroundKey: string }): string | null {
  const present = BACKGROUND_KEYS.filter((key) => manifest.background?.[key] !== undefined);
  if (present.length !== 1 || present[0] !== config.backgroundKey) {
    return `expected only background.${config.backgroundKey}, found: ${present.join(', ') || '(none)'}`;
  }
  return null;
}

function buildTarget(name: string, skipPackage = false): void {
  const config = TARGETS[name];
  const outDir = path.join(ROOT, 'dist', name);

  console.log(`\n[${name}] cleaning ${path.relative(ROOT, outDir)}`);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`[${name}] bundling TypeScript`);
  execSync(
    `npx esbuild 'src/*.ts' --bundle --platform=browser --outdir=${JSON.stringify(outDir)}`,
    { cwd: ROOT, stdio: 'inherit' }
  );

  console.log(`[${name}] copying static assets`);
  fs.copyFileSync(path.join(ROOT, 'content.css'),  path.join(outDir, 'content.css'));
  fs.copyFileSync(path.join(ROOT, 'options.css'),  path.join(outDir, 'options.css'));
  const optionsSrc = fs.readFileSync(path.join(ROOT, 'options.html'), 'utf8');
  fs.writeFileSync(path.join(outDir, 'options.html'), processTemplate(optionsSrc, buildSectionMap(SECTIONS)));
  fs.cpSync(path.join(ROOT, 'icons'), path.join(outDir, 'icons'), { recursive: true });

  console.log(`[${name}] writing manifest`);
  const base: Record<string, any> = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.base.json'), 'utf8'));
  const overrideRaw: Record<string, any> = JSON.parse(
    fs.readFileSync(path.join(ROOT, config.manifestOverride), 'utf8')
  );
  // Strip documentation-only keys (e.g. "_comment") before merging.
  const override = Object.fromEntries(
    Object.entries(overrideRaw).filter(([key]) => !key.startsWith('_'))
  );
  const merged = { ...base, ...override };

  const manifestError = checkBackgroundKey(merged, config);
  if (manifestError) {
    console.error(`[${name}] manifest check failed: ${manifestError}`);
    process.exit(1);
  }

  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(merged, null, 2) + '\n');

  let archivePath: string | null = null;
  if (config.archiveExt && !skipPackage) {
    archivePath = path.join(ROOT, 'dist', `${pkg.name}-${name}.${config.archiveExt}`);
    console.log(`[${name}] packaging ${path.relative(ROOT, archivePath)}`);
    fs.rmSync(archivePath, { force: true });
    execSync(`zip -rq ${JSON.stringify(archivePath)} .`, { cwd: outDir, stdio: 'inherit' });
  }

  console.log(
    `[${name}] done -> dist/${name}/${archivePath ? `, ${path.relative(ROOT, archivePath)}` : ''}`
  );

  if (name === 'firefox') {
    console.log(`[${name}] linting with web-ext`);
    execSync(`npx web-ext lint --source-dir=${JSON.stringify(outDir)} --self-hosted`, {
      cwd: ROOT,
      stdio: 'inherit',
    });
  }
}

function main(): void {
  // No target (`npm run build`) defaults to "all".
  const args = process.argv.slice(2);
  const skipPackage = args.includes('--no-pack');
  const arg = args.find(a => !a.startsWith('--')) || 'all';
  const names = arg === 'all' ? Object.keys(TARGETS) : [arg];

  if (arg !== 'all' && !TARGETS[arg]) {
    console.error(`Usage: node scripts/build.ts <${Object.keys(TARGETS).join('|')}|all>`);
    process.exit(1);
  }

  names.forEach(name => buildTarget(name, skipPackage));
}

main();
