const checkbox = document.getElementById('includeSvg') as HTMLInputElement
const status = document.getElementById('status') as HTMLParagraphElement

chrome.storage.sync.get({ includeSvg: false }).then(({ includeSvg }) => {
  checkbox.checked = includeSvg as boolean
})

checkbox.addEventListener('change', () => {
  chrome.storage.sync.set({ includeSvg: checkbox.checked }).then(() => {
    status.textContent = 'Saved'
    setTimeout(() => { status.textContent = '' }, 1500)
  })
})
