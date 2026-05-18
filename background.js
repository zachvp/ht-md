const DEFAULT_ACTION = 'activatePicker'

const handlers = {
  activatePicker(tab) {
    chrome.tabs.sendMessage(tab.id, { action: 'activate' })
  },
  openMenu(tab) {
    chrome.action.setPopup({ tabId: tab.id, popup: 'popup.html' })
    chrome.action.openPopup()
  },
}

chrome.action.onClicked.addListener((tab) => {
  chrome.storage.sync.get({ toolbarAction: DEFAULT_ACTION }, ({ toolbarAction }) => {
    const handler = handlers[toolbarAction] ?? handlers[DEFAULT_ACTION]
    handler(tab)
  })
})
