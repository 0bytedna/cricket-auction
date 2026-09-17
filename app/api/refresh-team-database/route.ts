import * as XLSX from 'xlsx';

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
  if (!configuredPassword || request.headers.get('x-admin-password') !== configuredPassword)
    return Response.json({ error: 'Incorrect server admin password.' }, { status: 401 });
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
    if (!response.ok) throw new Error('Spreadsheet returned ' + response.status);
    const workbook = XLSX.read(await response.arrayBuffer(), { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    const version = Date.now().toString();
    const teams = rows
      .map((row, index) => {
        const entries = Object.entries(row);
        const find = (...words: string[]) =>
          entries.find(([heading]) => {
            const normalized = heading.toLowerCase();
            return words.every((word) => normalized.includes(word));
          })?.[1];
        const name = String(find('team', 'name') || find('name') || '').trim();
        const logoSource = String(find('logo') || '').trim();
        const id = driveId(logoSource);
        return {
          code: 'TEAM-' + (index + 1),
          name,
          logo: id
            ? '/api/team-logo?id=' + encodeURIComponent(id) + '&v=' + version
            : /^https:\/\//i.test(logoSource)
              ? logoSource
              : '',
        };
      })
      .filter((team) => team.name);
    if (!teams.length) throw new Error('No teams were found. Add Team Name and Logo columns.');
    return Response.json({ teams }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Team database refresh failed.' },
      { status: 500 },
    );
  }
}
