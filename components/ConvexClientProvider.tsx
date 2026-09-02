'use client';

import { ReactNode, useState } from 'react';
import { ConvexReactClient } from 'convex/react';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { ConvexQueryCacheProvider } from 'convex-helpers/react/cache/provider';
import { api } from '@/convex/_generated/api';

/**
 * Convex client + Convex Auth v2.
 *
 * `ConvexAuthProvider` replaces `ConvexProvider`: it wraps
 * `ConvexProviderWithAuth` internally, keeps the session's tokens in
 * localStorage and refreshes the short-lived access token on its own. The only
 * sign-in flow on this site is the anonymous "guest admin" one (see
 * app/admin/layout.tsx), so no ambient sign-ins (OAuth redirect handling) are
 * registered.
 *
 * `ConvexQueryCacheProvider` must stay inside it: the Booker and the admin
 * pages use convex-helpers' cached `useQuery` hooks.
 */
export default function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [convex] = useState(() => {
    return new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  });

  return (
    <ConvexAuthProvider
      client={convex}
      api={{ refreshSession: api.auth.refreshSession, signOut: api.auth.signOut }}
      ambientSignIns={[]}
    >
      <ConvexQueryCacheProvider>
        {children}
      </ConvexQueryCacheProvider>
    </ConvexAuthProvider>
  );
}
