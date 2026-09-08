import * as XLSX from 'xlsx';

let refreshing = false;
type PlayerSet = 'A+' | 'A' | 'B' | 'C';
const playerSets: PlayerSet[] = ['A+', 'A', 'B', 'C'];
const parsePlayerSet = (value: unknown): PlayerSet => {
  const normalized = String(value || '').trim().toUpperCase().split(' ').join('');
  return playerSets.includes(normalized as PlayerSet)
    ? (normalized as PlayerSet)
    : 'C';
};
const driveId = (value: string) => {
  try {
    const url = new URL(value);
    const segments = url.pathname.split('/');
    const marker = segments.indexOf('d');
    return url.searchParams.get('id') || (marker >= 0 ? segments[marker + 1] : '') || '';
  } catch {
    return '';
  }
};

export async function POST(request: Request) {
  const configuredPassword = process.env.ADMIN_PASSWORD;
  const suppliedPassword = request.headers.get('x-admin-password');
  if (!configuredPassword)
    return Response.json(
      { error: 'Set ADMIN_PASSWORD on the server before refreshing players.' },
      { status: 503 },
    );
  if (suppliedPassword !== configuredPassword)
    return Response.json(
      { error: 'Incorrect server admin password.' },
      { status: 401 },
    );
  if (refreshing)
    return Response.json(
      { error: 'A database download is already running.' },
      { status: 409 },
    );

  refreshing = true;
  try {
    const body = (await request.json()) as { url?: string };
    const source = new URL(body.url || '');
    if (
      source.protocol !== 'https:' ||
      source.hostname !== 'docs.google.com' ||
      !source.pathname.startsWith('/spreadsheets/d/e/')
    )
      return Response.json(
        { error: 'Use a published Google Sheets XLS/XLSX link.' },
        { status: 400 },
      );

    source.searchParams.set('cache', Date.now().toString());
    const response = await fetch(source, {
      cache: 'no-store',
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok)
      throw new Error('Spreadsheet returned ' + response.status);

    const workbook = XLSX.read(await response.arrayBuffer(), { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    const version = Date.now().toString();
    let available = 0;
    let placeholders = 0;
    const players = rows
      .map((row) => {
        const find = (word: string) =>
          Object.entries(row).find(([heading]) =>
            heading.toLowerCase().includes(word),
          )?.[1];
        const name = String(find('name') || '').trim();
        const age = Number(find('age') || 0);
        const set = parsePlayerSet(find('set'));
        const id = driveId(String(find('photo') || '').trim());
        if (id) available += 1;
        else placeholders += 1;
        return {
          name,
          age,
          set,
          image: id
            ? '/api/player-photo?id=' +
              encodeURIComponent(id) +
              '&v=' +
              version
            : '/player-placeholder.svg',
        };
      })
      .filter((player) => player.name);

    if (!players.length) throw new Error('No players were found.');
    return Response.json(
      { players, downloaded: available, placeholders },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : 'Database refresh failed.',
      },
      { status: 500 },
    );
  } finally {
    refreshing = false;
  }
}
