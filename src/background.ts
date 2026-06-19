console.log('[web-md] background loaded')

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

chrome.action.onClicked.addListener(async (tab) => {
  const tabId = tab.id!
  console.log('[web-md] toolbar clicked, tab:', tabId)
  try {
    await chrome.tabs.sendMessage(tabId, { action: 'toggle' })
  } catch {
    // Content script not present (e.g. service worker restarted while tab was open).
    // Inject it programmatically and retry once.
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['turndown.js', 'content.js'] })
      await chrome.scripting.insertCSS({ target: { tabId }, files: ['content.css'] })
      await chrome.tabs.sendMessage(tabId, { action: 'toggle' })
    } catch (err2) {
      console.warn('[web-md] sendMessage after inject:', (err2 as Error).message)
    }
  }
})
