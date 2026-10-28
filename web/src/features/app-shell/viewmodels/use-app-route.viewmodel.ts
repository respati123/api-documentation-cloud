import { useCallback, useEffect, useState } from 'react'
import type { AppRoute } from '../models/route.model'
import { readRoute, routeUrl } from '../utils/route'

export function useAppRouteViewModel() {
  const [route, setRoute] = useState<AppRoute>(() => readRoute(window.location.pathname))

  useEffect(() => {
    const onPopState = () => setRoute(readRoute(window.location.pathname))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = useCallback((next: AppRoute, replace = false) => {
    const url = routeUrl(next)
    if (replace) window.history.replaceState({}, '', url)
    else window.history.pushState({}, '', url)
    setRoute(next)
  }, [])

  return { route, navigate }
}
