'use client';

import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 3, // 3 minutos de cache
            refetchOnWindowFocus: false,
            retry: 1
          },
        },
      })
  );

  useEffect(() => {
    const handleSignOut = () => {
      queryClient.clear();
    };

    window.addEventListener('gf_auth_signout', handleSignOut);
    return () => {
      window.removeEventListener('gf_auth_signout', handleSignOut);
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
