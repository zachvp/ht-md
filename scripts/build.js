#!/usr/bin/env node
// Builds the extension for one or more browser targets into dist/<target>/,
// and packages each into a browser-appropriate archive at the repo root.
//
// Usage:
//   node scripts/build.js firefox
//   node scripts/build.js chrome
//   node scripts/build.js all

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const TARGETS = {
  firefox: {
    manifestOverride: 'manifest.firefox.json',
    archiveExt: 'xpi',
    // Firefox's MV3 doesn't support service workers yet — it needs the
    // scripts-array event-page form.
    assertManifest: (m) =>
      Array.isArray(m.background?.scripts) && !m.background?.service_worker,
    assertMessage: 'expected background.scripts (array), not background.service_worker',
  },
  // Brave and Edge are Chromium-based and load the chrome build directly.
  chrome: {
    manifestOverride: 'manifest.chrome.json',
    archiveExt: 'zip',
    // Chromium MV3 requires service_worker — "scripts" is silently ignored,
    // which is exactly the bug that motivated this check.
    assertManifest: (m) =>
      typeof m.background?.service_worker === 'string' && !m.background?.scripts,
    assertMessage: 'expected background.service_worker (string), not background.scripts',
  },
};

function buildTarget(name) {
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
  fs.copyFileSync(path.join(ROOT, 'content.css'), path.join(outDir, 'content.css'));
  fs.copyFileSync(path.join(ROOT, 'turndown.js'), path.join(outDir, 'turndown.js'));
  fs.cpSync(path.join(ROOT, 'icons'), path.join(outDir, 'icons'), { recursive: true });

  console.log(`[${name}] writing manifest`);
  const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.base.json'), 'utf8'));
  const overrideRaw = JSON.parse(
    fs.readFileSync(path.join(ROOT, config.manifestOverride), 'utf8')
  );
  // Strip documentation-only keys (e.g. "_comment") before merging.
  const override = Object.fromEntries(
    Object.entries(overrideRaw).filter(([key]) => !key.startsWith('_'))
  );
  const merged = { ...base, ...override };

  if (!config.assertManifest(merged)) {
    console.error(`[${name}] manifest check failed: ${config.assertMessage}`);
    process.exit(1);
  }

  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(merged, null, 2) + '\n');

  const archiveName = `web-md-${name}.${config.archiveExt}`;
  console.log(`[${name}] packaging ${archiveName}`);
  fs.rmSync(path.join(ROOT, archiveName), { force: true });
  execSync(`zip -rq ${JSON.stringify(path.join(ROOT, archiveName))} .`, {
    cwd: outDir,
    stdio: 'inherit',
  });

  console.log(`[${name}] done -> dist/${name}/, ${archiveName}`);

  if (name === 'firefox') {
    console.log(`[${name}] linting with web-ext`);
    execSync(`npx web-ext lint --source-dir=${JSON.stringify(outDir)} --self-hosted`, {
      cwd: ROOT,
      stdio: 'inherit',
    });
  }
}

function main() {
  const arg = process.argv[2];
  const names = arg === 'all' ? Object.keys(TARGETS) : [arg];

  if (!arg || (arg !== 'all' && !TARGETS[arg])) {
    console.error(
      `Usage: node scripts/build.js <${Object.keys(TARGETS).join('|')}|all>\n` +
        `No target specified — refusing to guess, since the wrong manifest silently breaks the extension.`
    );
    process.exit(1);
  }

  names.forEach(buildTarget);
}

main();
