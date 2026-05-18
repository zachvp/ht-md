const BROWSER = typeof browser !== 'undefined' ? 'firefox' : 'chrome'
const api = BROWSER === 'firefox' ? browser : chrome
