import { EXT_NAME } from './lib/constants'

const LOG = `[${EXT_NAME}]`

console.log(`${LOG} background loaded`)

chrome.runtime.onMessage.addListener((msg: { action: string; active?: boolean }, sender) => {
  if (msg.action === 'pickerState' && sender.tab?.id != null) {
    const tabId = sender.tab.id
    if (msg.active) {
      chrome.action.setBadgeBackgroundColor({ color: '#ff9900', tabId })
      chrome.action.setBadgeText({ text: ' ', tabId })
    } else {
      chrome.action.setBadgeText({ text: '', tabId })
    }
  }
})

async function togglePicker(tabId: number): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, { action: 'toggle' })
  } catch {
    // Content script not present (e.g. service worker restarted while tab was open).
    // Inject it programmatically and retry once.
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] })
      await chrome.scripting.insertCSS({ target: { tabId }, files: ['content.css'] })
      await chrome.tabs.sendMessage(tabId, { action: 'toggle' })
    } catch (err2) {
      console.warn(`${LOG} sendMessage after inject:`, (err2 as Error).message)
    }
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  console.log(`${LOG} toolbar clicked, tab:`, tab.id)
  await togglePicker(tab.id!)
})
