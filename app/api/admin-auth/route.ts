export async function GET() {
  return Response.json(
    { configured: Boolean(process.env.ADMIN_PASSWORD) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: Request) {
  const configured = process.env.ADMIN_PASSWORD;
  if (!configured)
    return Response.json(
      { authenticated: false, configured: false },
      { status: 503 },
    );
  const body = (await request.json().catch(() => ({}))) as { password?: string };
  if (body.password !== configured)
    return Response.json(
      { authenticated: false, configured: true },
      { status: 401 },
    );
  return Response.json(
    { authenticated: true, configured: true },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
