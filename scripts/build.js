#!/usr/bin/env node
// Builds the extension for one or more browser targets into dist/<target>/,
// and packages each into a browser-appropriate archive under dist/.
//
// Usage:
//   node scripts/build.js firefox
//   node scripts/build.js chrome
//   node scripts/build.js all

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const pkg  = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

// Firefox's MV3 doesn't support service workers yet, so its background page
// uses the scripts-array form; Chromium (Chrome/Brave/Edge) requires
// service_worker and silently ignores "scripts" — which is exactly the bug
// that motivated checkBackgroundKey below.
const TARGETS = {
  // No root-level archive for firefox: an unsigned .xpi can't be installed
  // permanently anyway (see scripts/sign-firefox.js for the real
  // distributable), and keeping one around just invites grabbing the wrong
  // file. dist/firefox/ (unpacked) is enough for temporary-add-on testing.
  firefox: { manifestOverride: 'manifest.firefox.json', archiveExt: null, backgroundKey: 'scripts' },
  chrome: { manifestOverride: 'manifest.chrome.json', archiveExt: 'zip', backgroundKey: 'service_worker' },
};

// All MV3 background keys this manifest could plausibly carry. Used to make
// sure only the target's own key is present.
const BACKGROUND_KEYS = ['scripts', 'service_worker'];

function checkBackgroundKey(manifest, config) {
  const present = BACKGROUND_KEYS.filter((key) => manifest.background?.[key] !== undefined);
  if (present.length !== 1 || present[0] !== config.backgroundKey) {
    return `expected only background.${config.backgroundKey}, found: ${present.join(', ') || '(none)'}`;
  }
  return null;
}

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
  const cssSource = fs.readFileSync(path.join(ROOT, 'content.css'), 'utf8')
    .replace(/\{\{EXT_NAME\}\}/g, pkg.name);
  fs.writeFileSync(path.join(outDir, 'content.css'), cssSource);
  fs.copyFileSync(path.join(ROOT, 'turndown.js'), path.join(outDir, 'turndown.js'));
  fs.copyFileSync(path.join(ROOT, 'options.html'), path.join(outDir, 'options.html'));
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
  const merged = { ...base, name: pkg.name, ...override };

  const manifestError = checkBackgroundKey(merged, config);
  if (manifestError) {
    console.error(`[${name}] manifest check failed: ${manifestError}`);
    process.exit(1);
  }

  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(merged, null, 2) + '\n');

  let archivePath = null;
  if (config.archiveExt) {
    archivePath = path.join(ROOT, 'dist', `${pkg.name}-${name}.${config.archiveExt}`);
    console.log(`[${name}] packaging ${path.relative(ROOT, archivePath)}`);
    fs.rmSync(archivePath, { force: true });
    execSync(`zip -rq ${JSON.stringify(archivePath)} .`, { cwd: outDir, stdio: 'inherit' });
  }

  console.log(
    `[${name}] done -> dist/${name}/${archivePath ? `, ${path.relative(ROOT, archivePath)}` : ''}`
  );

  if (name === 'firefox') {
    // addons-linter (used by web-ext) flags any innerHTML assignment via the
    // no-unsanitized ESLint rule. The two hits are in bundled third-party code
    // (uhtml template parser and a replaceChildren polyfill) where the values
    // are safe, so suppress the rule inline before linting.
    for (const jsFile of fs.readdirSync(outDir).filter(f => f.endsWith('.js'))) {
      const filePath = path.join(outDir, jsFile);
      const src = fs.readFileSync(filePath, 'utf8');
      const patched = src.includes('.innerHTML')
        ? '/* eslint-disable no-unsanitized/property */\n' + src
        : src;
      fs.writeFileSync(filePath, patched);
    }

    console.log(`[${name}] linting with web-ext`);
    execSync(`npx web-ext lint --source-dir=${JSON.stringify(outDir)} --self-hosted`, {
      cwd: ROOT,
      stdio: 'inherit',
    });
  }
}

function main() {
  // No target (e.g. plain `npm run build`) defaults to "all" rather than
  // guessing a single browser — building every target is always correct,
  // unlike the old default-to-firefox behavior that broke Brave/Chrome.
  const arg = process.argv[2] || 'all';
  const names = arg === 'all' ? Object.keys(TARGETS) : [arg];

  if (arg !== 'all' && !TARGETS[arg]) {
    console.error(`Usage: node scripts/build.js <${Object.keys(TARGETS).join('|')}|all>`);
    process.exit(1);
  }

  names.forEach(buildTarget);
}

main();
