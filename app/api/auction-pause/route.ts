type LiveAuctionStore = {
  revision: number;
  state: Record<string, unknown>;
};

const shared = globalThis as typeof globalThis & {
  __splLiveAuction?: LiveAuctionStore;
  __splLiveAuctionSubscribers?: Set<ReadableStreamDefaultController<Uint8Array>>;
};

export async function POST() {
  const current = shared.__splLiveAuction;
  if (!current) return new Response(null, { status: 204 });
  const next: LiveAuctionStore = {
    revision: current.revision + 1,
    state: {
      ...current.state,
      obsMode: 'resting',
      projectorMode: 'resting',
      luckyWheelSpin: null,
      celebrationAt: 0,
    },
  };
  shared.__splLiveAuction = next;
  const message = new TextEncoder().encode(
    `data: ${JSON.stringify(next)}\n\n`,
  );
  for (const subscriber of shared.__splLiveAuctionSubscribers || []) {
    try {
      subscriber.enqueue(message);
    } catch {
      shared.__splLiveAuctionSubscribers?.delete(subscriber);
    }
  }
  return Response.json(
    { paused: true, revision: next.revision },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
