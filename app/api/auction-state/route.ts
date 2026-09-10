type LiveAuctionStore = {
  revision: number;
  state: unknown;
};

const shared = globalThis as typeof globalThis & {
  __splLiveAuction?: LiveAuctionStore;
};

const responseHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
};

export async function GET(request: Request) {
  const store = shared.__splLiveAuction;
  if (!store) return new Response(null, { status: 204, headers: responseHeaders });
  const since = Number(new URL(request.url).searchParams.get('since') || -1);
  if (since === store.revision)
    return new Response(null, { status: 204, headers: responseHeaders });
  return Response.json(store, { headers: responseHeaders });
}

export async function POST(request: Request) {
  try {
    const state = await request.json();
    if (!state || typeof state !== 'object' || !Array.isArray(state.players))
      return new Response('Invalid auction state.', { status: 400 });
    const revision = (shared.__splLiveAuction?.revision || 0) + 1;
    shared.__splLiveAuction = { revision, state };
    return Response.json({ revision }, { headers: responseHeaders });
  } catch {
    return new Response('Unable to save auction state.', { status: 400 });
  }
}
