const noStore = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

const configuration = () => ({
  url: process.env.GOOGLE_APPS_SCRIPT_URL || '',
  secret: process.env.AUCTION_SYNC_SECRET || '',
});

export async function GET() {
  const { url, secret } = configuration();
  if (!url || !secret)
    return Response.json(
      { configured: false, state: null },
      { status: 503, headers: noStore },
    );
  try {
    const endpoint = new URL(url);
    endpoint.searchParams.set('secret', secret);
    endpoint.searchParams.set('action', 'load');
    const response = await fetch(endpoint, {
      cache: 'no-store',
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error('Google storage returned ' + response.status);
    const result = await response.json();
    if (!result?.ok) throw new Error(result?.error || 'Google storage rejected the request.');
    return Response.json(
      { configured: true, state: result.state || null, savedAt: result.savedAt || null },
      { headers: noStore },
    );
  } catch (error) {
    return Response.json(
      {
        configured: true,
        state: null,
        error: error instanceof Error ? error.message : 'Shared storage is unavailable.',
      },
      { status: 502, headers: noStore },
    );
  }
}

export async function POST(request: Request) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword || request.headers.get('x-admin-password') !== adminPassword)
    return Response.json({ error: 'Incorrect server admin password.' }, { status: 401 });
  const { url, secret } = configuration();
  if (!url || !secret)
    return Response.json({ error: 'Shared Google storage is not configured.' }, { status: 503 });
  try {
    const state = await request.json();
    if (!state || typeof state !== 'object' || !Array.isArray(state.players))
      return Response.json({ error: 'Invalid auction state.' }, { status: 400 });
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ secret, action: 'save', state }),
      cache: 'no-store',
      redirect: 'follow',
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error('Google storage returned ' + response.status);
    const result = await response.json();
    if (!result?.ok) throw new Error(result?.error || 'Google storage rejected the save.');
    return Response.json({ saved: true, savedAt: result.savedAt }, { headers: noStore });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Shared save failed.' },
      { status: 502, headers: noStore },
    );
  }
}
