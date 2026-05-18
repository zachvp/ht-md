if (typeof BROWSER === 'undefined') importScripts('browser.js')

console.log('[web-md] background loaded, browser:', BROWSER)

const DEFAULT_ACTION = 'activatePicker'

const handlers = {
  activatePicker(tab) {
    console.log('[web-md] sending activate to tab', tab.id, tab.url)
    api.tabs.sendMessage(tab.id, { action: 'activate' })
      .catch(err => console.warn('[web-md] activatePicker:', err.message))
  },
  openMenu(tab) {
    api.action.setPopup({ tabId: tab.id, popup: 'popup.html' })
    api.action.openPopup()
  },
}

api.action.onClicked.addListener((tab) => {
  console.log('[web-md] toolbar clicked, tab:', tab.id)
  api.storage.sync.get({ toolbarAction: DEFAULT_ACTION }, ({ toolbarAction }) => {
    console.log('[web-md] dispatching action:', toolbarAction)
    const handler = handlers[toolbarAction] ?? handlers[DEFAULT_ACTION]
    handler(tab)
  })
})
