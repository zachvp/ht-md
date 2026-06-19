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

chrome.action.onClicked.addListener((tab) => {
  console.log('[web-md] toolbar clicked, tab:', tab.id)
  chrome.tabs.sendMessage(tab.id!, { action: 'toggle' })
    .catch((err: Error) => console.warn('[web-md] sendMessage:', err.message))
})
