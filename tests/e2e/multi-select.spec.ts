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

test('static: undo removes last selection, redo restores it', async ({ page }) => {
  await loadFixture(page, 'static.html')

  await page.click('#card-a', { modifiers: ['Meta'] })
  await page.click('#card-b', { modifiers: ['Meta'] })
  await page.keyboard.press('ArrowLeft')   // undo card-b
  await page.keyboard.press('ArrowRight')  // redo card-b
  await page.keyboard.press('Enter')

  const clips = await page.evaluate(() => (window as any).__clips() as string[])
  expect(clips[0]).toContain('Card A')
  expect(clips[0]).toContain('Card B')
})

test('static: undo all selections then copy single hover', async ({ page }) => {
  await loadFixture(page, 'static.html')

  await page.click('#card-a', { modifiers: ['Meta'] })
  await page.keyboard.press('ArrowLeft')   // undo — selection empty, falls back to hover
  await page.hover('#card-b')
  await page.keyboard.press('Enter')

  const clips = await page.evaluate(() => (window as any).__clips() as string[])
  expect(clips[0]).toContain('Card B')
  expect(clips[0]).not.toContain('Card A')
})

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

test('static: confirmation toast shows badge with count after copy', async ({ page }) => {
  await loadFixture(page, 'static.html')

  await page.click('#card-a', { modifiers: ['Meta'] })
  await page.click('#card-b', { modifiers: ['Meta'] })
  await page.keyboard.press('Enter')

  const badge = page.locator('.ht-md-flash .ht-md-badge')
  await expect(badge).toHaveText('2')
  await expect(badge.locator('..') ).toContainText('Copied')
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

// ── Overlay rendering: stays visible and repositioned on reactive sites ─────────

test('overlay stays visible and repositioned on scroll', async ({ page }) => {
  await loadFixture(page, 'react-sim.html')

  // Hover to create overlay
  await page.hover('#panel')
  const beforeScroll = await page.evaluate(() => {
    const ov = document.querySelector('.ht-md-overlay') as HTMLElement
    return ov?.style.display !== 'none' && ov?.style.top !== ''
  })
  expect(beforeScroll).toBe(true)

  // Scroll (simulates layout shifts on reactive sites)
  await page.evaluate(() => window.scrollBy(0, 50))

  // Overlay should still be visible and repositioned
  const afterScroll = await page.evaluate(() => {
    const ov = document.querySelector('.ht-md-overlay') as HTMLElement
    return ov?.style.display !== 'none' && ov?.style.top !== ''
  })
  expect(afterScroll).toBe(true)
})
