import { api } from './browser.js'

document.getElementById('activate')!.addEventListener('click', () => {
  api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    api.tabs.sendMessage(tabs[0].id!, { action: 'activate' })
    window.close()
  })
})
