import * as XLSX from 'xlsx';

const normalizedKey = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const booleanValue = (value: unknown) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return undefined;
  return ['true', 'yes', '1', 'on', 'enabled'].includes(normalized);
};

const numberValue = (value: unknown) => {
  const parsed = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : undefined;
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

const logoUrl = (value: unknown, version: string) => {
  const source = String(value || '').trim();
  const id = driveId(source);
  if (id)
    return '/api/team-logo?id=' + encodeURIComponent(id) + '&v=' + version;
  return /^https:\/\//i.test(source) ? source : '';
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
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
    });
    if (!rows.length) throw new Error('No settings were found.');

    const values = new Map<string, unknown>();
    for (const row of rows) {
      const entries = Object.entries(row);
      const settingEntry = entries.find(([heading]) =>
        ['setting', 'key', 'option'].includes(normalizedKey(heading)),
      );
      const valueEntry = entries.find(([heading]) =>
        ['value', 'settingvalue'].includes(normalizedKey(heading)),
      );
      if (settingEntry && valueEntry)
        values.set(normalizedKey(settingEntry[1]), valueEntry[1]);
      else
        for (const [heading, value] of entries)
          if (String(value).trim()) values.set(normalizedKey(heading), value);
    }

    const get = (...keys: string[]) => {
      for (const key of keys) {
        const value = values.get(normalizedKey(key));
        if (value !== undefined && String(value).trim() !== '') return value;
      }
      return undefined;
    };
    const version = Date.now().toString();
    const settings = {
      rules: {
        maxPlayers: numberValue(get('Players Per Team', 'Max Players')),
        maxPoints: numberValue(get('Max Points Per Player', 'Max Points')),
        minPoints: numberValue(get('Minimum Points Per Player', 'Min Points')),
        teamWallet: numberValue(get('Team Wallet Total Points', 'Team Wallet')),
      },
      randomPlayerSelection: booleanValue(get('Random Player Selection')),
      tickerSpeed: numberValue(get('Ticker Ribbon Speed', 'Ticker Speed')),
      wheelSpinDuration: numberValue(get('Wheel Spin Duration')),
      celebrationMuted: booleanValue(get('Celebration Muted')),
      celebration: {
        density: numberValue(get('Confetti Density')),
        size: numberValue(get('Confetti Size')),
      },
      branding: {
        tournament: String(get('Tournament Name') || '').trim(),
        sponsor: String(get('Title Sponsor Name') || '').trim(),
        groundSponsor: String(get('Ground Sponsor Name') || '').trim(),
        tournamentLogo: logoUrl(get('Tournament Logo'), version),
        sponsorLogo: logoUrl(get('Title Sponsor Logo'), version),
        groundSponsorLogo: logoUrl(get('Ground Sponsor Logo'), version),
      },
      playerDatabaseUrl: String(get('Player Database URL') || '').trim(),
      teamDatabaseUrl: String(get('Team Database URL') || '').trim(),
    };

    return Response.json(
      { settings },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Settings database refresh failed.' },
      { status: 500 },
    );
  }
}
