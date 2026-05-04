import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,  // 5 minutes — data is considered fresh for 5 min
      gcTime: 1000 * 60 * 10,    // 10 minutes — inactive queries stay in cache for 10 min
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})
