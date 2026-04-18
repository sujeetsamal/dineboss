import { useEffect, useState } from 'react'
import { adminSearchStore } from '../searchStore'

export function useAdminGlobalSearch() {
  const [state, setState] = useState(adminSearchStore.current)
  useEffect(() => {
    const unsub = adminSearchStore.subscribe((s) => setState(s))
    return unsub
  }, [])
  return state
}
