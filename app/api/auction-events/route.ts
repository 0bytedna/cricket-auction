type LiveAuctionStore = {
  revision: number;
  state: unknown;
};

const shared = globalThis as typeof globalThis & {
  __splLiveAuction?: LiveAuctionStore;
  __splLiveAuctionSubscribers?: Set<ReadableStreamDefaultController<Uint8Array>>;
};

export async function GET() {
  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let activeController: ReadableStreamDefaultController<Uint8Array> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      activeController = controller;
      const subscribers =
        shared.__splLiveAuctionSubscribers ||
        (shared.__splLiveAuctionSubscribers = new Set());
      subscribers.add(controller);
      controller.enqueue(encoder.encode('retry: 1000\n\n'));
      if (shared.__splLiveAuction)
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(shared.__splLiveAuction)}\n\n`),
        );
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keep-alive\n\n'));
        } catch {
          subscribers.delete(controller);
          if (heartbeat) clearInterval(heartbeat);
        }
      }, 15000);
    },
    cancel() {
      if (activeController)
        shared.__splLiveAuctionSubscribers?.delete(activeController);
      if (heartbeat) clearInterval(heartbeat);
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
