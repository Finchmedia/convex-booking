import { redirect } from 'next/navigation';
import { getSignInUrl } from '@workos-inc/authkit-nextjs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const returnTo = searchParams.get('returnTo') || '/';

  // Encode returnPathname in state (same format as getAuthorizationUrl uses internally)
  // handleAuth will decode this and redirect to returnPathname after auth
  const state = btoa(JSON.stringify({ returnPathname: returnTo }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const authorizationUrl = await getSignInUrl({ state });
  return redirect(authorizationUrl);
}
