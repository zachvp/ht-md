const checkbox = document.getElementById('includeSvg') as HTMLInputElement
const slider = document.getElementById('cursorSize') as HTMLInputElement
const sliderVal = document.getElementById('cursorSizeVal') as HTMLSpanElement
const status = document.getElementById('status') as HTMLParagraphElement

function showSaved(): void {
  status.textContent = 'Saved'
  setTimeout(() => { status.textContent = '' }, 1500)
}

chrome.storage.sync.get({ includeSvg: false, cursorSize: 32 }).then(({ includeSvg, cursorSize }) => {
  checkbox.checked = includeSvg as boolean
  slider.value = String(cursorSize)
  sliderVal.textContent = `${cursorSize}px`
})

checkbox.addEventListener('change', () => {
  chrome.storage.sync.set({ includeSvg: checkbox.checked }).then(showSaved)
})

slider.addEventListener('input', () => {
  sliderVal.textContent = `${slider.value}px`
})

slider.addEventListener('change', () => {
  chrome.storage.sync.set({ cursorSize: Number(slider.value) }).then(showSaved)
})
