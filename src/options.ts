const checkbox = document.getElementById('includeSvg') as HTMLInputElement
const cursorSlider = document.getElementById('cursorSize') as HTMLInputElement
const cursorSliderVal = document.getElementById('cursorSizeVal') as HTMLSpanElement
const cursorEmojiInput = document.getElementById('cursorEmoji') as HTMLInputElement
const multiCursorEmojiInput = document.getElementById('multiCursorEmoji') as HTMLInputElement
const colorPicker = document.getElementById('outlineColor') as HTMLInputElement
const outlineSlider = document.getElementById('outlineWidth') as HTMLInputElement
const outlineSliderVal = document.getElementById('outlineWidthVal') as HTMLSpanElement
const insetSlider = document.getElementById('insetWidth') as HTMLInputElement
const insetSliderVal = document.getElementById('insetWidthVal') as HTMLSpanElement
const flashSizeSlider = document.getElementById('flashFontSize') as HTMLInputElement
const flashSizeVal = document.getElementById('flashFontSizeVal') as HTMLSpanElement
const status = document.getElementById('status') as HTMLParagraphElement

function showSaved(): void {
  status.textContent = 'Saved'
  setTimeout(() => { status.textContent = '' }, 1500)
}

chrome.storage.sync.get({
  includeSvg: false,
  cursorSize: 32,
  cursorEmoji: '📌',
  multiCursorEmoji: '📝',
  outlineColor: '#ff9900',
  outlineWidth: 2,
  insetWidth: 2,
  flashFontSize: 13,
}).then(({ includeSvg, cursorSize, cursorEmoji, multiCursorEmoji, outlineColor, outlineWidth, insetWidth, flashFontSize }) => {
  checkbox.checked = includeSvg as boolean
  cursorSlider.value = String(cursorSize)
  cursorSliderVal.textContent = `${cursorSize}px`
  cursorEmojiInput.value = cursorEmoji as string
  multiCursorEmojiInput.value = multiCursorEmoji as string
  colorPicker.value = outlineColor as string
  outlineSlider.value = String(outlineWidth)
  outlineSliderVal.textContent = `${outlineWidth}px`
  insetSlider.value = String(insetWidth)
  insetSliderVal.textContent = `${insetWidth}px`
  flashSizeSlider.value = String(flashFontSize)
  flashSizeVal.textContent = `${flashFontSize}px`
})

checkbox.addEventListener('change', () => {
  chrome.storage.sync.set({ includeSvg: checkbox.checked }).then(showSaved)
})

cursorSlider.addEventListener('input', () => {
  cursorSliderVal.textContent = `${cursorSlider.value}px`
})
cursorSlider.addEventListener('change', () => {
  chrome.storage.sync.set({ cursorSize: Number(cursorSlider.value) }).then(showSaved)
})

cursorEmojiInput.addEventListener('change', () => {
  chrome.storage.sync.set({ cursorEmoji: cursorEmojiInput.value }).then(showSaved)
})

multiCursorEmojiInput.addEventListener('change', () => {
  chrome.storage.sync.set({ multiCursorEmoji: multiCursorEmojiInput.value }).then(showSaved)
})

colorPicker.addEventListener('change', () => {
  chrome.storage.sync.set({ outlineColor: colorPicker.value }).then(showSaved)
})

outlineSlider.addEventListener('input', () => {
  outlineSliderVal.textContent = `${outlineSlider.value}px`
})
outlineSlider.addEventListener('change', () => {
  chrome.storage.sync.set({ outlineWidth: Number(outlineSlider.value) }).then(showSaved)
})

insetSlider.addEventListener('input', () => {
  insetSliderVal.textContent = `${insetSlider.value}px`
})
insetSlider.addEventListener('change', () => {
  chrome.storage.sync.set({ insetWidth: Number(insetSlider.value) }).then(showSaved)
})

flashSizeSlider.addEventListener('input', () => {
  flashSizeVal.textContent = `${flashSizeSlider.value}px`
})
flashSizeSlider.addEventListener('change', () => {
  chrome.storage.sync.set({ flashFontSize: Number(flashSizeSlider.value) }).then(showSaved)
})
