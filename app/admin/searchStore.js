// Lightweight in-memory admin global search store (client-side only)
// Exposes a tiny pub-sub API so admin pages can react to global mode + query changes

let current = { mode: 'Orders', query: '' }
const listeners = new Set()

export const adminSearchStore = {
  get current() { return current },
  setMode(mode) {
    current = { ...current, mode }
    emit()
  },
  setQuery(query) {
    current = { ...current, query }
    emit()
  },
  subscribe(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }
}

function emit() {
  for (const fn of listeners) fn(adminSearchStore.current)
}
