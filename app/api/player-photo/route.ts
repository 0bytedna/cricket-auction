export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!/^[a-zA-Z0-9_-]{10,}$/.test(id))
    return new Response('Invalid player photo.', { status: 400 });

  try {
    const response = await fetch(
      'https://drive.google.com/uc?export=download&id=' +
        encodeURIComponent(id),
      {
        redirect: 'follow',
        signal: AbortSignal.timeout(30000),
      },
    );
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || !contentType.startsWith('image/'))
      return new Response('Player photo unavailable.', { status: 404 });
    return new Response(response.body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new Response('Player photo unavailable.', { status: 504 });
  }
}
