import { QueryClient } from '@tanstack/react-query';

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // The default. Stated explicitly because it is the whole reason a
        // background tab stops costing bandwidth.
        refetchIntervalInBackground: false,
        // Coming back to the tab should show current scores, not whatever was
        // on screen when it was last looked at.
        refetchOnWindowFocus: true,
        // ESPN is undocumented and occasionally rejects a request outright;
        // one retry absorbs that without delaying a genuine outage for long.
        retry: 1,
        retryDelay: 1000,
        staleTime: 10_000,
      },
    },
  });
