import { test, expect } from '@playwright/test'
import path from 'path'

const CONTENT_JS = path.join(__dirname, '../../dist/chrome/content.js')
const FIXTURES   = path.join(__dirname, '../fixtures')

// Injected before every page load: mocks chrome APIs and clipboard.
const initScript = () => {
  let _onMessage: ((msg: { action: string }) => void) | null = null
  const clips: string[] = []

  ;(window as any).chrome = {
    runtime: {
      id: 'test-ext-id',
      sendMessage: () => Promise.resolve(),
      onMessage: { addListener: (fn: typeof _onMessage) => { _onMessage = fn } },
    },
    storage: {
      sync: {
        get: (defaults: object) => Promise.resolve(defaults),
      },
      onChanged: { addListener: () => {} },
    },
  }

  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText: (text: string) => { clips.push(text); return Promise.resolve() },
    },
    configurable: true,
  })

  // Helpers for tests
  ;(window as any).__activate = () => _onMessage?.({ action: 'activate' })
  ;(window as any).__clips    = () => clips
}

async function loadFixture(page: import('@playwright/test').Page, name: string) {
  await page.addInitScript(initScript)
  await page.goto(`file://${FIXTURES}/${name}`)
  await page.addScriptTag({ path: CONTENT_JS })
  await page.evaluate(() => (window as any).__activate())
}

// ── Static site: accumulate multiple elements ─────────────────────────────────

test('static: multi-select two elements and copy both', async ({ page }) => {
  await loadFixture(page, 'static.html')

  await page.click('#card-a', { modifiers: ['Meta'] })
  await page.click('#card-b', { modifiers: ['Meta'] })
  await page.keyboard.press('Enter')

  const clips = await page.evaluate(() => (window as any).__clips() as string[])
  expect(clips).toHaveLength(1)
  // Both cards should appear in the copied markdown
  expect(clips[0]).toContain('Card A')
  expect(clips[0]).toContain('Card B')
})

// ── React-sim: same DOM node mutated between clicks ───────────────────────────

test('react-sim: snapshots captured at click time survive in-place DOM mutation', async ({ page }) => {
  await loadFixture(page, 'react-sim.html')

  // Click 1: panel shows "Item 1"
  await page.click('#panel', { modifiers: ['Meta'] })

  // Simulate React navigation — panel innerHTML replaced in-place
  await page.evaluate(() => (window as any).simulateNavigation())

  // Click 2: same #panel node, now showing "Item 2"
  await page.click('#panel', { modifiers: ['Meta'] })
  await page.keyboard.press('Enter')

  const clips = await page.evaluate(() => (window as any).__clips() as string[])
  expect(clips).toHaveLength(1)
  // Both states must be present — proves snapshots were taken at click time
  expect(clips[0]).toContain('Item 1')
  expect(clips[0]).toContain('Item 2')
})

test('react-sim: three navigations accumulate three independent snapshots', async ({ page }) => {
  await loadFixture(page, 'react-sim.html')

  await page.click('#panel', { modifiers: ['Meta'] })
  await page.evaluate(() => (window as any).simulateNavigation())

  await page.click('#panel', { modifiers: ['Meta'] })
  await page.evaluate(() => (window as any).simulateNavigation())

  await page.click('#panel', { modifiers: ['Meta'] })
  await page.keyboard.press('Enter')

  const clips = await page.evaluate(() => (window as any).__clips() as string[])
  expect(clips[0]).toContain('Item 1')
  expect(clips[0]).toContain('Item 2')
  expect(clips[0]).toContain('Item 3')
})
