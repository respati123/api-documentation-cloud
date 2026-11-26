import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PortalPage } from '@/features/portal'
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
export default function App() { return <QueryClientProvider client={client}><PortalPage /></QueryClientProvider> }
