console.log('[web-md] background loaded')

const DEFAULT_ACTION = 'activatePicker'

const handlers: Record<string, (tab: chrome.tabs.Tab) => void> = {
  activatePicker(tab) {
    console.log('[web-md] sending activate to tab', tab.id, tab.url)
    chrome.tabs.sendMessage(tab.id!, { action: 'activate' })
      .catch((err: Error) => console.warn('[web-md] activatePicker:', err.message))
  },
  openMenu(tab) {
    chrome.action.setPopup({ tabId: tab.id, popup: 'popup.html' })
    chrome.action.openPopup()
  },
}

chrome.action.onClicked.addListener((tab) => {
  console.log('[web-md] toolbar clicked, tab:', tab.id)
  chrome.storage.sync.get({ toolbarAction: DEFAULT_ACTION }).then(({ toolbarAction }) => {
    console.log('[web-md] dispatching action:', toolbarAction)
    const handler = handlers[toolbarAction as string] ?? handlers[DEFAULT_ACTION]
    handler(tab)
  })
})
