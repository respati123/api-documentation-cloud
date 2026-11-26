import { afterEach, expect, it, vi } from 'vitest'
import { portalService } from './portal.service'
import { request } from '@/lib/api'
afterEach(() => vi.unstubAllGlobals())
it('uses cookie authentication and exposes server errors', async () => {
 const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Session expired' }), { status: 401 }))
 vi.stubGlobal('fetch', fetcher)
 await expect(request('/api/me')).rejects.toMatchObject({ message: 'Session expired', status: 401 })
 expect(fetcher.mock.calls[0][1].credentials).toBe('include')
})
it('preserves the workspace cursor from the response envelope', async () => {
 vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { workspaces: [{ id: 'w1' }] }, meta: { nextCursor: 'next' } }))))
 expect(await portalService.workspaces()).toEqual({ items: [{ id: 'w1' }], nextCursor: 'next' })
})
it('reads branch heads instead of the legacy tree', async () => {
 vi.stubGlobal('fetch', vi.fn(async (path: string) => new Response(JSON.stringify({ data: path.endsWith('sync/pull') ? { workspace: { id: 'w1', tree: [], usesBranches: true } } : path.endsWith('branches') ? { branches: [{ id: 'b1' }] } : { tree: [{ id: 'r1', kind: 'request', name: 'Get users' }] } }))))
 expect((await portalService.snapshot('w1'))?.tree[0].id).toBe('r1')
})
it('sends the established create workspace payload', async () => {
 const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { workspace: { id: 'w1', name: 'Docs' } } })))
 vi.stubGlobal('fetch', fetcher)
 await portalService.create('Docs')
 expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ name: 'Docs', tree: [], variables: { globals: [], environments: [] } })
})
