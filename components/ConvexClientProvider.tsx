'use client';

import { ReactNode, useCallback, useRef, useState, useEffect } from 'react';
import { ConvexReactClient } from 'convex/react';
import { ConvexProviderWithAuth } from 'convex/react';
import { ConvexQueryCacheProvider } from 'convex-helpers/react/cache/provider';
import { AuthKitProvider, useAuth, useAccessToken } from '@workos-inc/authkit-nextjs/components';

// Prevent AuthKit's default window.location.reload() on session expiration
const noop = () => {};

export default function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [convex] = useState(() => {
    return new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  });

  return (
    <AuthKitProvider onSessionExpired={noop}>
      <ConvexProviderWithAuth client={convex} useAuth={useAuthFromAuthKit}>
        <ConvexQueryCacheProvider>
          {children}
        </ConvexQueryCacheProvider>
      </ConvexProviderWithAuth>
    </AuthKitProvider>
  );
}

function useAuthFromAuthKit() {
  const { user, loading: isLoading } = useAuth();
  const { getAccessToken, accessToken, refresh } = useAccessToken();

  // Cache token for fallback during network issues
  const accessTokenRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  const isAuthenticated = !!user;

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken?: boolean } = {}): Promise<string | null> => {
      if (!user) {
        return null;
      }

      try {
        // If Convex requests a forced refresh (e.g., token was rejected by server),
        // always get a fresh token. Otherwise, return cached token if still valid.
        return forceRefreshToken ? ((await refresh()) ?? null) : ((await getAccessToken()) ?? null);
      } catch {
        // On network errors during laptop wake, fall back to cached token.
        // Even if expired, Convex will treat it like null and clear auth.
        // AuthKit's tokenStore schedules automatic retries in the background.
        console.log('[Convex Auth] Using cached token during network issues');
        return accessTokenRef.current ?? null;
      }
    },
    [user, getAccessToken, refresh],
  );

  return {
    isLoading,
    isAuthenticated,
    fetchAccessToken,
  };
}
