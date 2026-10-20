import { QueryClient } from "@tanstack/react-query";

/** The one React Query cache. The app renders with it, and agent packages use it through the host namespace. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
