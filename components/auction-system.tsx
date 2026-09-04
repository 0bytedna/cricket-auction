'use client';
import { memo, useEffect, useRef, useState } from 'react';
import {
  Gavel,
  MonitorUp,
  Radio,
  Trophy,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  Plus,
  Trash2,
  Users,
  Eye,
  EyeOff,
  Undo2,
  Volume2,
  VolumeX,
  Settings,
  Play,
  Pause,
} from 'lucide-react';
import playerManifest from '../player-import.json';
type Team = {
  code: string;
  name: string;
  budget: number;
  logo: string;
};
const MIN_BID = 5_000;
const MAX_BID = 50_000;
const TEAM_BUDGET = 150_000;
const MAX_PLAYERS = 6;
const BID_STEP = 1_000;
type AuctionRules = {
  maxPlayers: number;
  minPoints: number;
  maxPoints: number;
  teamWallet: number;
};
const defaultRules: AuctionRules = {
  maxPlayers: MAX_PLAYERS,
  minPoints: MIN_BID,
  maxPoints: MAX_BID,
  teamWallet: TEAM_BUDGET,
};
type PlayerSet = 'A' | 'B' | 'C';
type ObsMode = 'auction' | 'rosters' | 'resting';
type ProjectorMode = 'auction' | 'rosters' | 'stats' | 'resting';
const clampBid = (value: number, rules = defaultRules) =>
  Math.min(
    rules.maxPoints,
    Math.max(rules.minPoints, value || rules.minPoints),
  );
type Player = {
  name: string;
  role: string;
  base: number;
  country: string;
  image: string;
  age?: number;
  result: 'pending' | 'sold' | 'unsold';
  soldTo: number;
  soldPrice: number;
  set: PlayerSet;
};
const registeredPlayer = (
  name: string,
  age: number,
  image: string,
): Player => ({
  name: name.toUpperCase(),
  role: 'PLAYER',
  base: MIN_BID,
  country: 'INDIA',
  image,
  age,
  result: 'pending',
  soldTo: -1,
  soldPrice: 0,
  set: 'A',
});
type AState = {
  playerDatabaseVersion: number;
  player: number;
  bid: number;
  leader: number;
  status: 'live' | 'sold' | 'unsold';
  activeSet: PlayerSet;
  randomPlayerSelection: boolean;
  tickerSpeed: number;
  playerDatabaseUrl: string;
  teams: Team[];
  players: Player[];
  bidHistory: { bid: number; leader: number }[];
  obsMode: ObsMode;
  projectorMode: ProjectorMode;
  rules: AuctionRules;
  celebrationMuted: boolean;
  celebration: {
    density: number;
    size: number;
  };
  celebrationAt: number;
  branding: {
    tournament: string;
    sponsor: string;
    groundSponsor: string;
    tournamentLogo: string;
    sponsorLogo: string;
    groundSponsorLogo: string;
  };
};
const seedPlayers: Player[] = playerManifest.map(({ name, age, file }) =>
  registeredPlayer(name, age, '/players/' + file),
);
const playerIdentity = (name: string, age: number) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') +
  '|' +
  age;
const bundledPlayerImages = new Map(
  playerManifest.map(({ name, age, file }) => [
    playerIdentity(name, age),
    '/players/' + file,
  ]),
);
const teams: Team[] = [
  {
    code: 'CSK',
    name: 'Chennai Super Kings',
    budget: TEAM_BUDGET,
    logo: '',
  },
  {
    code: 'SRH',
    name: 'Sunrisers Hyderabad',
    budget: TEAM_BUDGET,
    logo: '',
  },
  {
    code: 'MI',
    name: 'Mumbai Indians',
    budget: TEAM_BUDGET,
    logo: '',
  },
  {
    code: 'RCB',
    name: 'Royal Challengers',
    budget: TEAM_BUDGET,
    logo: '',
  },
];
const initial: AState = {
  playerDatabaseVersion: 2,
  player: 0,
  bid: MIN_BID,
  leader: -1,
  status: 'live',
  activeSet: 'A',
  randomPlayerSelection: true,
  tickerSpeed: 5,
  playerDatabaseUrl:
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vTJSkmTO0aDVXFo1oY7TlqOo7GkfAlrrlxl7mBgMhDKAe5rSPnQVHDDD5gxQ6ptpv7S1L5JMT_-kZyR/pub?output=xlsx',
  teams,
  players: seedPlayers,
  bidHistory: [],
  obsMode: 'resting',
  projectorMode: 'resting',
  rules: defaultRules,
  celebrationMuted: false,
  celebration: { density: 65, size: 82 },
  celebrationAt: 0,
  branding: {
    tournament: 'SIWANCHI PREMIER LEAGUE',
    sponsor: 'TITLE SPONSOR',
    groundSponsor: 'GROUND SPONSOR',
    tournamentLogo: '/spl-tournament-logo.jpeg',
    sponsorLogo: '',
    groundSponsorLogo: '',
  },
};
const key = 'boundaryx-auction-state-v3';
const settingsKey = 'spl-auction-settings-v1';
const settingsSnapshot = (state: AState) => ({
  rules: state.rules,
  teams: state.teams,
  branding: state.branding,
  playerDatabaseUrl: state.playerDatabaseUrl,
  randomPlayerSelection: state.randomPlayerSelection,
  activeSet: state.activeSet,
  tickerSpeed: state.tickerSpeed,
  obsMode: state.obsMode,
  projectorMode: state.projectorMode,
  celebrationMuted: state.celebrationMuted,
  celebration: state.celebration,
});
const readLocalSettings = (): Partial<ReturnType<typeof settingsSnapshot>> => {
  try {
    const saved = JSON.parse(localStorage.getItem(settingsKey) || 'null');
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
    const result: Record<string, unknown> = {};
    for (const field of Object.keys(settingsSnapshot(initial))) {
      if (saved[field] !== undefined) result[field] = saved[field];
    }
    return result;
  } catch {
    return {};
  }
};
let settingsStorageWarningShown = false;
const saveLocalSettings = (state: AState) => {
  try {
    localStorage.setItem(settingsKey, JSON.stringify(settingsSnapshot(state)));
    settingsStorageWarningShown = false;
  } catch {
    if (!settingsStorageWarningShown) {
      settingsStorageWarningShown = true;
      window.alert(
        'Settings could not be saved to localStorage because browser storage is full or unavailable. The app will still try its IndexedDB backup.',
      );
    }
  }
};
const auctionDb = 'siwanchi-premier-league';
const auctionStore = 'auction-state';
const openAuctionDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(auctionDb, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(auctionStore))
        request.result.createObjectStore(auctionStore);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
const loadPersistentAuction = async () => {
  try {
    const db = await openAuctionDb();
    const result = await new Promise<AState | undefined>((resolve, reject) => {
      const request = db
        .transaction(auctionStore, 'readonly')
        .objectStore(auctionStore)
        .get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return result;
  } catch {
    return undefined;
  }
};
const savePersistentAuction = async (state: AState) => {
  try {
    const db = await openAuctionDb();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(auctionStore, 'readwrite');
      transaction.objectStore(auctionStore).put(state, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    db.close();
  } catch {
    // The localStorage fallback below still preserves smaller auction states.
  }
};
const left = (s: AState, ti: number) =>
  s.rules.teamWallet -
  s.players
    .filter((p) => p.result === 'sold' && p.soldTo === ti)
    .reduce((n, p) => n + p.soldPrice, 0);
const rosterCount = (s: AState, ti: number) =>
  s.players.filter((p) => p.result === 'sold' && p.soldTo === ti).length;
const maxAllowedBid = (s: AState, ti: number) => {
  const count = rosterCount(s, ti);
  if (count >= s.rules.maxPlayers) return 0;
  const reservedForRemainingSlots =
    (s.rules.maxPlayers - count - 1) * s.rules.minPoints;
  return Math.max(
    0,
    Math.min(s.rules.maxPoints, left(s, ti) - reservedForRemainingSlots),
  );
};
const normalize = (raw: any): AState => {
  if (!raw?.players) return initial;
  const rawRules = { ...defaultRules, ...(raw.rules || {}) };
  const rules: AuctionRules = {
    maxPlayers: Math.max(1, Number(rawRules.maxPlayers) || MAX_PLAYERS),
    minPoints: Math.max(1, Number(rawRules.minPoints) || MIN_BID),
    maxPoints: Math.max(
      Number(rawRules.minPoints) || MIN_BID,
      Number(rawRules.maxPoints) || MAX_BID,
    ),
    teamWallet: Math.max(
      (Number(rawRules.maxPlayers) || MAX_PLAYERS) *
        (Number(rawRules.minPoints) || MIN_BID),
      Number(rawRules.teamWallet) || TEAM_BUDGET,
    ),
  };
  // Saved player records are authoritative; never replace them with build-time seeds.
  const sourcePlayers = raw.players;
  const migratedPlayers = sourcePlayers.map((p: Player, i: number) => ({
    ...p,
    image: p.image?.startsWith('/players/') || p.image === '/player-placeholder.svg'
      ? p.image
      : '/player-placeholder.svg',
    base: rules.minPoints,
    set: p.set || (['A', 'B', 'C'][i % 3] as PlayerSet),
    soldPrice: p.result === 'sold' ? clampBid(p.soldPrice || p.base, rules) : 0,
  }));
  const current = migratedPlayers[raw.player || 0] || migratedPlayers[0];
  return {
    ...initial,
    ...raw,
    playerDatabaseVersion: initial.playerDatabaseVersion,
    players: migratedPlayers,
    bid: clampBid(
      current?.result === 'sold' ? current.soldPrice : raw.bid || current?.base,
      rules,
    ),
    rules,
    activeSet: raw.activeSet || current?.set || 'A',
    randomPlayerSelection: raw.randomPlayerSelection ?? true,
    tickerSpeed: Math.min(10, Math.max(1, raw.tickerSpeed || 5)),
    obsMode:
      raw.obsMode ||
      (raw.resting ? 'resting' : raw.showObsRosters ? 'rosters' : 'auction'),
    projectorMode:
      raw.projectorMode ||
      (raw.resting
        ? 'resting'
        : raw.showStats
          ? 'stats'
          : raw.showRosters
            ? 'rosters'
            : 'auction'),
    bidHistory: Array.isArray(raw.bidHistory)
      ? raw.bidHistory
          .filter(
            (entry: any) =>
              Number.isFinite(entry?.bid) && Number.isFinite(entry?.leader),
          )
          .map((entry: any) => ({
            bid: clampBid(entry.bid, rules),
            leader: entry.leader,
          }))
      : [],
    celebration: { ...initial.celebration, ...(raw.celebration || {}) },
    branding: {
      ...initial.branding,
      ...(raw.branding || {}),
      tournament:
        raw.branding?.tournament === 'BOUNDARYX PREMIER LEAGUE'
          ? 'SIWANCHI PREMIER LEAGUE'
          : raw.branding?.tournament || initial.branding.tournament,
      tournamentLogo:
        raw.branding?.tournamentLogo || initial.branding.tournamentLogo,
    },
    teams:
      raw.teams?.map((t: Team) => ({
        ...t,
        budget: rules.teamWallet,
        logo: t.logo || '',
      })) || teams,
  };
};
function useAuction() {
  const [s, setS] = useState<AState>(initial);
  useEffect(() => {
    let active = true;
    void (async () => {
      const persistent = await loadPersistentAuction();
      if (!active) return;
      let restored: AState = persistent || initial;
      try {
        if (!persistent) {
          const saved = localStorage.getItem(key);
          if (saved) restored = JSON.parse(saved);
        }
      } catch {
        // Keep the safe initial state if legacy storage is unreadable.
      }
      const hydrated = normalize({ ...restored, ...readLocalSettings() });
      setS(hydrated);
      saveLocalSettings(hydrated);
    })();
    const c = new BroadcastChannel(key);
    c.onmessage = (e) => setS(normalize(e.data));
    return () => {
      active = false;
      c.close();
    };
  }, []);
  useEffect(() => {
    const images = s.players
      .map((player) => player.image)
      .filter((source): source is string => Boolean(source));
    const preloaders = images.map((source) => {
      const image = new Image();
      image.decoding = 'async';
      image.src = source;
      if (typeof image.decode === 'function')
        void image.decode().catch(() => {});
      return image;
    });
    return () => {
      preloaders.forEach((image) => {
        image.onload = null;
        image.onerror = null;
      });
    };
  }, [s.players]);
  const update = (n: AState) => {
    setS(n);
    saveLocalSettings(n);
    void savePersistentAuction(n);
    try {
      localStorage.setItem(key, JSON.stringify(n));
    } catch {
      // Large uploaded images can exceed localStorage; IndexedDB is primary.
    }
    const c = new BroadcastChannel(key);
    c.postMessage(n);
    c.close();
  };
  return [s, update] as const;
}
function Logo() {
  return (
    <div className="ipl-logo">
      <img src="/spl-tournament-logo.jpeg" alt="Siwanchi Premier League" />
      <span>
        <b>Siwanchi Premier League</b>
      </span>
    </div>
  );
}
const pts = (n: number) => n.toLocaleString('en-IN');
function BrandMark({ src, label }: { src: string; label: string }) {
  return (
    <div className="brand-mark">
      {src ? (
        <img src={src} alt={label} />
      ) : (
        <b>
          {label
            .split(' ')
            .map((x) => x[0])
            .join('')
            .slice(0, 3)}
        </b>
      )}
      <span>{label}</span>
    </div>
  );
}
function PlayerImage({ src, alt = '' }: { src?: string; alt?: string }) {
  return (
    <img
      key={src || 'placeholder'}
      src={src || '/player-placeholder.svg'}
      alt={alt}
      onError={(event) => {
        if (!event.currentTarget.src.endsWith('/player-placeholder.svg'))
          event.currentTarget.src = '/player-placeholder.svg';
        event.currentTarget.style.display = 'block';
      }}
    />
  );
}
function TeamMark({
  team,
  className = '',
}: {
  team?: Team | null;
  className?: string;
}) {
  return (
    <i className={'team-mark ' + className} aria-label={team?.name}>
      <b>{team?.name || '-'}</b>
      {team?.logo && (
        <img
          src={team.logo}
          alt=""
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
      )}
    </i>
  );
}
function SoldCelebration({
  s,
  compact = false,
}: {
  s: AState;
  compact?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const colors = [
      '#FF3B30',
      '#FF9500',
      '#FFD60A',
      '#34C759',
      '#00C7BE',
      '#0A84FF',
      '#5E5CE6',
      '#BF5AF2',
      '#FF2D55',
      '#FFFFFF',
    ];
    const pieces: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      angle: number;
      spin: number;
      color: string;
      life: number;
    }> = [];
    let width = 0,
      height = 0,
      raf = 0,
      spawnCredit = 0,
      lastFrame = performance.now();
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const launch = (right: boolean) => {
      const speed = 6 + Math.random() * 7;
      pieces.push({
        x: right ? width + 8 : -8,
        y: height * (0.48 + Math.random() * 0.2),
        vx: (right ? -1 : 1) * speed,
        vy: -7 - Math.random() * 8,
        size: (7 + Math.random() * 9) * (s.celebration.size / 100),
        angle: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.35,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1,
      });
    };
    const draw = (now: number) => {
      ctx.clearRect(0, 0, width, height);
      const elapsed = Math.min(40, now - lastFrame);
      lastFrame = now;
      spawnCredit += elapsed * 0.02 * (s.celebration.density / 100);
      while (spawnCredit >= 1) {
        launch(false);
        launch(true);
        spawnCredit -= 1;
      }
      for (let i = pieces.length - 1; i >= 0; i -= 1) {
        const p = pieces[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2;
        p.vx *= 0.995;
        p.angle += p.spin;
        p.life -= 0.006;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size, -p.size * 0.35, p.size * 2, p.size * 0.7);
        ctx.restore();
        if (p.life <= 0 || p.y > height + 40) pieces.splice(i, 1);
      }
      raf = requestAnimationFrame(draw);
    };
    resize();
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [s.celebration.density, s.celebration.size]);

  return (
    <div className={'sold-celebration ' + (compact ? 'compact' : '')}>
      <canvas
        ref={canvasRef}
        className="celebration-canvas"
        aria-hidden="true"
      />
    </div>
  );
}
function SoldResultScreen({
  s,
  overlay = false,
}: {
  s: AState;
  overlay?: boolean;
}) {
  const player = s.players[s.player];
  const team = player.soldTo >= 0 ? s.teams[player.soldTo] : null;
  return (
    <main className={'sold-result-screen ' + (overlay ? 'overlay-sold' : '')}>
      <section className="sold-result-card">
        <PlayerImage src={player.image} alt={player.name} />
        <h1>{player.name}</h1>
        <strong>SOLD</strong>
        <b>{pts(player.soldPrice || s.bid)}</b>
        <div>
          <TeamMark team={team} />
          <span>{team?.name || 'Team'}</span>
        </div>
      </section>
      {s.celebrationAt > 0 && <SoldCelebration s={s} compact={overlay} />}
    </main>
  );
}
function RestScreen({ s, overlay = false }: { s: AState; overlay?: boolean }) {
  return (
    <main className={'rest-screen ' + (overlay ? 'obs-rest' : '')}>
      <div className="rest-orbit" />
      <div className="rest-content">
        <div className="home-logo-row">
          <article>
            <BrandMark
              src={s.branding.sponsorLogo}
              label={s.branding.sponsor}
            />
            <b>{s.branding.sponsor}</b>
            <small>TITLE SPONSOR</small>
          </article>
          <article className="tournament-home-logo">
            <BrandMark
              src={s.branding.tournamentLogo}
              label={s.branding.tournament}
            />
          </article>
          <article>
            <BrandMark
              src={s.branding.groundSponsorLogo}
              label={s.branding.groundSponsor}
            />
            <b>{s.branding.groundSponsor}</b>
            <small>GROUND SPONSOR</small>
          </article>
        </div>
        <p>PLAYER AUCTION</p>
        <div className="rest-teams">
          <small>PARTICIPATING TEAMS</small>
          <div>
            {s.teams.map((team) => (
              <article>
                <TeamMark team={team} />
              </article>
            ))}
          </div>
        </div>
        <em>AUCTION WILL BEGIN SHORTLY</em>
      </div>
    </main>
  );
}
function LowerThird({ s, animate = false }: { s: AState; animate?: boolean }) {
  const p = s.players[s.player],
    team = s.leader >= 0 ? s.teams[s.leader] : null;
  if (s.status === 'sold')
    return (
      <div className={'sold-third ' + (animate ? 'animate' : '')}>
        <div className="sold-repeat left">SOLD&nbsp; SOLD&nbsp; SOLD</div>
        <div className="sold-repeat right">SOLD&nbsp; SOLD&nbsp; SOLD</div>
        <div className="sold-portrait">
          <b className="sold-image-fallback">
            {p.name
              .split(' ')
              .map((part) => part[0])
              .join('')
              .slice(0, 2)}
          </b>
          <PlayerImage src={p.image} alt={p.name} />
        </div>
        <div className="sold-plate">
          <TeamMark team={team} />
          <span>
            <b>{p.name}</b>
            <small>SOLD TO {team?.name}</small>
          </span>
          <strong>{pts(s.bid)}</strong>
        </div>
      </div>
    );
  return (
    <div className={'lower-third ' + (team ? 'has-leading-team' : '')}>
      <div className="lt-price">
        <small>BASE PRICE</small>
        <b>{pts(p.base)}</b>
      </div>
      <div className="lt-player">
        <div className="headshot">
          <PlayerImage src={p.image} alt={p.name} />
        </div>
        <span>
          <b>{p.name}</b>
          <small>{p.age ? `AGE ${p.age}` : p.role}</small>
        </span>
      </div>
      {s.leader >= 0 && (
        <div className="lt-price current">
          <small>CURRENT BID</small>
          <b>{pts(s.bid)}</b>
        </div>
      )}
      {team && (
        <div className="obs-leading-team">
          <b>{team.name}</b>
        </div>
      )}
      {s.status === 'unsold' && (
        <div className="result unsold">
          <strong>UNSOLD</strong>
        </div>
      )}
    </div>
  );
}
export function Overlay() {
  const [s] = useAuction();
  if (s.obsMode === 'resting') return <RestScreen s={s} overlay />;
  if (s.obsMode === 'rosters')
    return (
      <main className="projector-view">
        <header>
          <Logo />
          <span className="live-pill">SQUAD UPDATE</span>
        </header>
        <RosterBoard s={s} />
      </main>
    );
  if (s.status === 'sold') return <SoldResultScreen s={s} overlay />;
  return (
    <main className="overlay-view">
      <header className="projector-brand-strip obs-brand-strip">
        <BrandMark src={s.branding.sponsorLogo} label={s.branding.sponsor} />
        <BrandMark
          src={s.branding.tournamentLogo}
          label={s.branding.tournament}
        />
        <BrandMark
          src={s.branding.groundSponsorLogo}
          label={s.branding.groundSponsor}
        />
      </header>
      <LowerThird s={s} />
      <AuctionTicker s={s} />
    </main>
  );
}
function RosterBoard({ s }: { s: AState }) {
  return (
    <section className="roster-board">
      <div className="roster-title">
        <span>
          <small>LIVE SQUAD STATUS</small>
          <h1>TEAMS SCREEN</h1>
        </span>
        <b>
          {s.players.filter((p) => p.result === 'sold').length} PLAYERS SOLD
        </b>
      </div>
      <div className="roster-grid">
        {s.teams.map((t, ti) => {
          const roster = s.players.filter(
            (p) => p.result === 'sold' && p.soldTo === ti,
          );
          return (
            <article>
              <header>
                <TeamMark team={t} />
                <span>
                  <b>{t.name}</b>
                  <small>{roster.length} PLAYERS</small>
                </span>
                <strong>
                  {pts(left(s, ti))}
                  <small>POINTS LEFT</small>
                </strong>
              </header>
              <div>
                {roster.length ? (
                  roster.map((p) => (
                    <p>
                      <span>
                        {p.name}
                        <small>{p.age ? `AGE ${p.age}` : p.role}</small>
                      </span>
                      <b>{pts(p.soldPrice)}</b>
                    </p>
                  ))
                ) : (
                  <em>No players purchased yet</em>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
function StatsBoard({ s }: { s: AState }) {
  const sold = [...s.players]
      .filter((p) => p.result === 'sold')
      .sort((a, b) => b.soldPrice - a.soldPrice),
    top = sold[0],
    team = top ? s.teams[top.soldTo] : null;
  return (
    <section className="stats-board">
      <div className="stats-heading">
        <span>
          <small>AUCTION LEADERBOARD</small>
          <h1>TOP BUYS</h1>
        </span>
        <b>{sold.length} PLAYERS SOLD</b>
      </div>
      {top ? (
        <>
          <div className="highest-player">
            <div className="rank">#1</div>
            <PlayerImage src={top.image} alt={top.name} />
            <div>
              <small>HIGHEST SOLD PLAYER</small>
              <h2>{top.name}</h2>
              <p>
                {top.role} - SOLD TO {team?.name}
              </p>
            </div>
            <strong>{pts(top.soldPrice)}</strong>
          </div>
          <div className="top-sales">
            {sold.slice(1, 6).map((p, i) => (
              <article>
                <em>#{i + 2}</em>
                <PlayerImage src={p.image} alt={p.name} />
                <span>
                  <b>{p.name}</b>
                  <small>
                    {s.teams[p.soldTo]?.name} -{' '}
                    {p.age ? `AGE ${p.age}` : p.role}
                  </small>
                </span>
                <strong>{pts(p.soldPrice)}</strong>
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="no-stats">
          <Trophy />
          <h2>No completed sales yet</h2>
          <p>Highest sold player will appear here after the first sale.</p>
        </div>
      )}
    </section>
  );
}
const tickerStateKey = (s: AState) =>
  [
    s.tickerSpeed,
    s.teams.map((team) => team.name).join('|'),
    s.players
      .map(
        (player) =>
          `${player.name}:${player.result}:${player.soldTo}:${player.soldPrice}`,
      )
      .join('|'),
  ].join('::');
const AuctionTicker = memo(
  function AuctionTicker({ s }: { s: AState }) {
    const rows = [
      {
        label: 'SOLD',
        entries: s.players
          .filter((player) => player.result === 'sold')
          .map(
            (player) =>
              `${player.name} (${s.teams[player.soldTo]?.name || 'Team'} - ${pts(player.soldPrice)})`,
          ),
      },
      {
        label: 'UNSOLD',
        entries: s.players
          .filter((player) => player.result === 'unsold')
          .map((player) => player.name),
      },
      {
        label: 'UPCOMING',
        entries: s.players
          .filter((player) => player.result === 'pending')
          .map((player) => player.name),
      },
    ].filter((row) => row.entries.length);
    const [rowIndex, setRowIndex] = useState(0);
    const [switching, setSwitching] = useState(false);
    const active = rows[rowIndex % Math.max(1, rows.length)] || {
      label: 'AUCTION',
      entries: ['No players available'],
    };
    const contentUnits = active.entries.reduce(
      (total, entry) => total + entry.length + 7,
      0,
    );
    const repeatCount = Math.max(1, Math.ceil(190 / contentUnits));
    const expandedEntries = Array.from(
      { length: repeatCount },
      () => active.entries,
    ).flat();
    const scrollDistance = expandedEntries.reduce(
      (total, entry) => total + entry.length * 9 + 60,
      0,
    );
    const pixelsPerSecond = 35 + s.tickerSpeed * 10;
    const duration = Math.max(8, scrollDistance / pixelsPerSecond);
    const rowSignature = rows.map((row) => row.label).join('|');
    useEffect(() => {
      setRowIndex(0);
      setSwitching(false);
    }, [rowSignature]);
    useEffect(() => {
      if (rows.length < 2) return;
      let swapTimer = 0;
      const timer = window.setTimeout(
        () => {
          setSwitching(true);
          swapTimer = window.setTimeout(() => {
            setRowIndex((index) => (index + 1) % rows.length);
            setSwitching(false);
          }, 280);
        },
        Math.max(12000, duration * 1000),
      );
      return () => {
        window.clearTimeout(timer);
        window.clearTimeout(swapTimer);
      };
    }, [duration, rowIndex, rowSignature, rows.length]);
    const renderCopy = (hidden = false) => (
      <div className="auction-ticker-copy" aria-hidden={hidden || undefined}>
        {expandedEntries.map((item, index) => (
          <span key={index}>{item}</span>
        ))}
      </div>
    );
    return (
      <div className="auction-ticker">
        <div className={'auction-ticker-row ' + (switching ? 'switching' : '')}>
          <b>{active.label}</b>
          <div>
            <div
              key={`${active.label}-${s.tickerSpeed}`}
              style={{ animationDuration: `${duration}s` }}
            >
              {renderCopy()}
              {renderCopy(true)}
            </div>
          </div>
        </div>
      </div>
    );
  },
  (previous, next) => tickerStateKey(previous.s) === tickerStateKey(next.s),
);
export function Projector() {
  const [s] = useAuction(),
    p = s.players[s.player],
    team = s.leader >= 0 ? s.teams[s.leader] : null;
  if (s.projectorMode === 'resting') return <RestScreen s={s} />;
  if (s.projectorMode === 'stats')
    return (
      <main className="projector-view">
        <header>
          <Logo />
          <span className="live-pill">AUCTION STATS</span>
        </header>
        <StatsBoard s={s} />
      </main>
    );
  if (s.projectorMode === 'rosters')
    return (
      <main className="projector-view">
        <header>
          <Logo />
          <span className="live-pill">SQUAD UPDATE</span>
        </header>
        <RosterBoard s={s} />
      </main>
    );
  if (s.status === 'sold') return <SoldResultScreen s={s} />;
  return (
    <main
      className={'projector-view ' + (s.status === 'unsold' ? 'is-unsold' : '')}
    >
      <header className="projector-brand-strip">
        <BrandMark src={s.branding.sponsorLogo} label={s.branding.sponsor} />
        <BrandMark
          src={s.branding.tournamentLogo}
          label={s.branding.tournament}
        />
        <BrandMark
          src={s.branding.groundSponsorLogo}
          label={s.branding.groundSponsor}
        />
      </header>
      <section className="projector-auction-stage">
        <div className="projector-auction-card">
          <PlayerImage src={p.image} alt={p.name} />
          <div className="projector-player-details">
            <small>NOW BIDDING</small>
            <h1>{p.name}</h1>
            <p>{p.age ? `AGE ${p.age}` : p.role}</p>
            <span>BASE PRICE</span>
            <b>{pts(p.base)}</b>
          </div>
          <div className="projector-current-bid">
            <small>{team ? 'CURRENT BID' : 'BIDDING OPENS AT'}</small>
            <strong>{pts(s.bid)}</strong>
            <b className={team ? 'leading-team' : 'awaiting-bid'}>
              {team?.name || 'Awaiting first bid'}
            </b>
          </div>
        </div>
        <div className="projector-team-desks">
          <header>
            <b>TEAMS</b>
            <small>HIGHEST BIDDER IS OUTLINED</small>
          </header>
          <div>
            {s.teams.map((item, index) => (
              <article className={s.leader === index ? 'leading' : ''}>
                <TeamMark team={item} />
                <span>
                  <b>{item.name}</b>
                  <small>
                    {pts(left(s, index))} left - {rosterCount(s, index)}/
                    {s.rules.maxPlayers} players
                  </small>
                </span>
              </article>
            ))}
          </div>
        </div>
        {s.status !== 'live' && (
          <div className={'projector-result ' + s.status}>
            {s.status === 'sold' ? 'SOLD' : 'UNSOLD'}
          </div>
        )}
      </section>
      <AuctionTicker s={s} />
    </main>
  );
}
function AdminConsole() {
  const [s, setS] = useAuction(),
    [tab, setTab] = useState<'auction' | 'players' | 'rosters' | 'settings'>(
      'auction',
    ),
    [edit, setEdit] = useState(0);
  const [playerSetFilter, setPlayerSetFilter] = useState<'all' | PlayerSet>(
      'all',
    ),
    [playerStatusFilter, setPlayerStatusFilter] = useState<
      'all' | Player['result']
    >('all'),
    [databaseImport, setDatabaseImport] = useState({
      running: false,
      completed: 0,
      total: 0,
      message: '',
      error: false,
    }),
    [downloadedPlayers, setDownloadedPlayers] = useState<Player[] | null>(null);
  const p = s.players[s.player],
    team = s.leader >= 0 ? s.teams[s.leader] : null;
  const auctionRunning =
    s.obsMode === 'auction' && s.projectorMode === 'auction';
  const filteredPlayers = s.players
    .map((player, index) => ({ player, index }))
    .filter(
      ({ player }) =>
        (playerSetFilter === 'all' || player.set === playerSetFilter) &&
        (playerStatusFilter === 'all' || player.result === playerStatusFilter),
    );
  const patchPlayer = (i: number, patch: Partial<Player>) =>
    setS({
      ...s,
      players: s.players.map((p, x) => (x === i ? { ...p, ...patch } : p)),
    });
  const uploadTeamLogo = (teamIndex: number, file?: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    const source = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 512;
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d');
      if (!context) {
        URL.revokeObjectURL(source);
        return;
      }
      const scale = Math.min(size / image.width, size / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      context.clearRect(0, 0, size, size);
      context.drawImage(
        image,
        (size - width) / 2,
        (size - height) / 2,
        width,
        height,
      );
      const logo = canvas.toDataURL('image/webp', 0.86);
      setS({
        ...s,
        teams: s.teams.map((team, index) =>
          index === teamIndex ? { ...team, logo } : team,
        ),
      });
      URL.revokeObjectURL(source);
    };
    image.onerror = () => URL.revokeObjectURL(source);
    image.src = source;
  };
  const uploadBrandingLogo = (
    field: 'tournamentLogo' | 'sponsorLogo' | 'groundSponsorLogo',
    file?: File,
  ) => {
    if (!file || !file.type.startsWith('image/')) return;
    const source = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 700;
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d');
      if (!context) return URL.revokeObjectURL(source);
      const scale = Math.min(size / image.width, size / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      context.drawImage(
        image,
        (size - width) / 2,
        (size - height) / 2,
        width,
        height,
      );
      setS({
        ...s,
        branding: {
          ...s.branding,
          [field]: canvas.toDataURL('image/webp', 0.88),
        },
      });
      URL.revokeObjectURL(source);
    };
    image.onerror = () => URL.revokeObjectURL(source);
    image.src = source;
  };
  const localizePlayerPhoto = async (source: string) => {
    const driveId = new URL(source).searchParams.get('id');
    if (!driveId) throw new Error('Google Drive photo ID is missing');
    const photoUrl =
      'https://drive.google.com/uc?export=download&id=' +
      encodeURIComponent(driveId);
    const sources = [
      photoUrl,
      '/api/player-photo?id=' + encodeURIComponent(driveId),
    ];
    let blob: Blob | null = null;
    let lastError = 'Photo download failed';
    for (let attempt = 0; attempt < 4 && !blob; attempt += 1) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 15_000);
      try {
        const response = await fetch(sources[attempt % sources.length], {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) {
          lastError = 'Photo server returned ' + response.status;
        } else {
          const candidate = await response.blob();
          if (candidate.type.startsWith('image/')) blob = candidate;
          else lastError = 'The photo link did not return an image';
        }
      } catch (error) {
        lastError =
          error instanceof Error && error.name === 'AbortError'
            ? 'Photo download timed out'
            : error instanceof Error
              ? error.message
              : 'Photo download failed';
      } finally {
        window.clearTimeout(timeout);
      }
      if (!blob)
        await new Promise((resolve) =>
          window.setTimeout(resolve, 600 * (attempt + 1)),
        );
    }
    if (!blob) throw new Error(lastError);
    const objectUrl = URL.createObjectURL(blob);
    try {
      const image = new Image();
      image.src = objectUrl;
      try {
        await image.decode();
      } catch {
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error('Photo could not be decoded'));
        });
      }
      const scale = Math.min(1, 1100 / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Photo could not be processed');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/webp', 0.84);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };
  const downloadPlayerDatabase = async () => {
    if (!s.playerDatabaseUrl || databaseImport.running) return;
    setDatabaseImport({
      running: true,
      completed: 0,
      total: 1,
      message: 'Server is downloading fresh player data and photos...',
      error: false,
    });
    try {
      const response = await fetch('/api/refresh-player-database', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password':
            localStorage.getItem('boundaryx-admin-password') || '',
        },
        body: JSON.stringify({ url: s.playerDatabaseUrl }),
      });
      const result = (await response.json()) as {
        players?: Array<{ name: string; age: number; image: string }>;
        downloaded?: number;
        placeholders?: number;
        error?: string;
      };
      if (!response.ok || !result.players)
        throw new Error(result.error || 'Server database refresh failed');
      const players = result.players.map((player, index) => ({
        ...registeredPlayer(player.name, player.age, player.image),
        base: s.rules.minPoints,
        set: (['A', 'B', 'C'][index % 3] || 'A') as PlayerSet,
      }));
      setS({
        ...s,
        player: 0,
        activeSet: players[0]?.set || 'A',
        bid: s.rules.minPoints,
        leader: -1,
        status: 'live',
        bidHistory: [],
        celebrationAt: 0,
        players,
      });
      const message =
        players.length +
        ' players applied. ' +
        (result.downloaded || 0) +
        ' fresh photos; ' +
        (result.placeholders || 0) +
        ' placeholder(s).';
      setDatabaseImport({
        running: false,
        completed: 1,
        total: 1,
        message,
        error: false,
      });
      window.alert(message);
    } catch (error) {
      setDatabaseImport({
        running: false,
        completed: 0,
        total: 1,
        message:
          error instanceof Error ? error.message : 'Database refresh failed',
        error: true,
      });
    }
  };
  const downloadPlayerDatabaseLegacy = async () => {
    if (!s.playerDatabaseUrl || databaseImport.running) return;
    setDownloadedPlayers(null);
    setDatabaseImport({
      running: true,
      completed: 0,
      total: 0,
      message: 'Downloading spreadsheet...',
      error: false,
    });
    try {
      const response = await fetch(s.playerDatabaseUrl);
      if (!response.ok) throw new Error('Could not download the spreadsheet');
      const XLSXModule = await import('xlsx');
      const XLSX = (
        'read' in XLSXModule ? XLSXModule : XLSXModule.default
      ) as typeof import('xlsx');
      const workbook = XLSX.read(await response.arrayBuffer(), {
        type: 'array',
      });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet || !sheet['!ref']) throw new Error('The spreadsheet is empty');
      const range = XLSX.utils.decode_range(sheet['!ref']);
      const getCell = (row: number, column: number) =>
        sheet[XLSX.utils.encode_cell({ r: row, c: column })] as
          | { v?: unknown; l?: { Target?: string } }
          | undefined;
      const headers = [];
      for (let column = range.s.c; column <= range.e.c; column += 1)
        headers.push(String(getCell(range.s.r, column)?.v || '').toLowerCase());
      const nameOffset = headers.findIndex((value) => value.includes('name'));
      const ageOffset = headers.findIndex((value) => value.includes('age'));
      const photoOffset = headers.findIndex((value) => value.includes('photo'));
      if (nameOffset < 0 || photoOffset < 0)
        throw new Error('Name or photo column was not found');
      const rows: Array<{ name: string; age: number; photo: string }> = [];
      for (let row = range.s.r + 1; row <= range.e.r; row += 1) {
        const name = String(
          getCell(row, range.s.c + nameOffset)?.v || '',
        ).trim();
        const photoCell = getCell(row, range.s.c + photoOffset);
        const photo = String(photoCell?.l?.Target || photoCell?.v || '').trim();
        const age = Number(getCell(row, range.s.c + ageOffset)?.v || 0);
        if (name) rows.push({ name, age, photo });
      }
      if (!rows.length) throw new Error('No player registrations were found');
      const players: Player[] = new Array(rows.length);
      let skippedPhotos = 0;
      let completedPhotos = 0;
      let nextPhotoIndex = 0;
      const downloadNextPhoto = async () => {
        while (nextPhotoIndex < rows.length) {
          const index = nextPhotoIndex;
          nextPhotoIndex += 1;
          const row = rows[index];
          const bundledImage = bundledPlayerImages.get(
            playerIdentity(row.name, row.age),
          );
          let image = bundledImage || '/player-placeholder.svg';
          if (!bundledImage) {
            try {
              if (row.photo) image = await localizePlayerPhoto(row.photo);
            } catch {
              skippedPhotos += 1;
            }
          }
          players[index] = {
            ...registeredPlayer(row.name, row.age, image),
            base: s.rules.minPoints,
            set: (['A', 'B', 'C'][index % 3] || 'A') as PlayerSet,
          };
          completedPhotos += 1;
          setDatabaseImport({
            running: true,
            completed: completedPhotos,
            total: rows.length,
            message:
              'Downloading ' +
              completedPhotos +
              ' of ' +
              rows.length +
              ' photos...',
            error: false,
          });
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(10, rows.length) }, () =>
          downloadNextPhoto(),
        ),
      );
      setS({
        ...s,
        player: 0,
        activeSet: players[0]?.set || 'A',
        bid: s.rules.minPoints,
        leader: -1,
        status: 'live',
        bidHistory: [],
        celebrationAt: 0,
        players,
      });
      setDownloadedPlayers(null);
      const successMessage =
        rows.length +
        ' players applied successfully. ' +
        skippedPhotos +
        ' photo(s) use the placeholder.';
      setDatabaseImport({
        running: false,
        completed: rows.length,
        total: rows.length,
        message: successMessage,
        error: false,
      });
      window.alert(successMessage);
    } catch (error) {
      setDatabaseImport((current) => ({
        ...current,
        running: false,
        message:
          error instanceof Error ? error.message : 'Database download failed',
        error: true,
      }));
    }
  };
  const applyDownloadedDatabase = () => {
    if (
      !downloadedPlayers ||
      !window.confirm(
        'Use the downloaded player database? This replaces the current player list and clears existing player results and bids.',
      )
    )
      return;
    setS({
      ...s,
      player: 0,
      activeSet: downloadedPlayers[0]?.set || 'A',
      bid: s.rules.minPoints,
      leader: -1,
      status: 'live',
      bidHistory: [],
      celebrationAt: 0,
      players: downloadedPlayers,
    });
    setDownloadedPlayers(null);
    setDatabaseImport((current) => ({
      ...current,
      message: current.total + ' players are ready for auction.',
    }));
  };
  const addTeam = () => {
    const index = s.teams.length;
    setS({
      ...s,
      teams: [
        ...s.teams,
        {
          code: `TEAM_${Date.now()}`,
          name: `Team ${index + 1}`,
          budget: s.rules.teamWallet,
          logo: '',
        },
      ],
    });
  };
  const removeTeam = (teamIndex: number) => {
    if (s.teams.length <= 1) return;
    const team = s.teams[teamIndex];
    if (
      !window.confirm(
        `Remove ${team.name}? Players sold to this team will return to pending.`,
      )
    )
      return;
    const players = s.players.map((player) =>
      player.soldTo === teamIndex
        ? { ...player, result: 'pending' as const, soldTo: -1, soldPrice: 0 }
        : player.soldTo > teamIndex
          ? { ...player, soldTo: player.soldTo - 1 }
          : player,
    );
    const currentWasRemoved = s.players[s.player]?.soldTo === teamIndex;
    setS({
      ...s,
      teams: s.teams.filter((_, index) => index !== teamIndex),
      players,
      leader:
        s.leader === teamIndex
          ? -1
          : s.leader > teamIndex
            ? s.leader - 1
            : s.leader,
      bid: s.leader === teamIndex ? s.rules.minPoints : s.bid,
      status: currentWasRemoved ? 'live' : s.status,
      bidHistory: [],
      celebrationAt: 0,
    });
  };
  const updateRules = (patch: Partial<AuctionRules>) => {
    const candidate = { ...s.rules, ...patch };
    const rules: AuctionRules = {
      maxPlayers: Math.max(1, candidate.maxPlayers),
      minPoints: Math.max(1, candidate.minPoints),
      maxPoints: Math.max(candidate.minPoints, candidate.maxPoints),
      teamWallet: Math.max(
        candidate.maxPlayers * candidate.minPoints,
        candidate.teamWallet,
      ),
    };
    setS({
      ...s,
      rules,
      teams: s.teams.map((team) => ({ ...team, budget: rules.teamWallet })),
      players: s.players.map((player) => ({
        ...player,
        base: rules.minPoints,
      })),
      bid:
        s.leader < 0
          ? rules.minPoints
          : Math.min(rules.maxPoints, Math.max(rules.minPoints, s.bid)),
    });
  };
  const send = (i: number) =>
    setS({
      ...s,
      player: i,
      activeSet: s.players[i].set,
      bid: s.rules.minPoints,
      leader: -1,
      status: 'live',
      bidHistory: [],
      celebrationAt: 0,
    });
  const bid = (i: number) => {
    const nextBid = s.leader < 0 ? s.rules.minPoints : s.bid + BID_STEP;
    if (
      s.status !== 'live' ||
      nextBid < s.rules.minPoints ||
      nextBid > maxAllowedBid(s, i)
    )
      return;
    setS({
      ...s,
      leader: i,
      bid: nextBid,
      bidHistory: [...s.bidHistory, { bid: s.bid, leader: s.leader }],
    });
  };
  const undoBid = () => {
    const last = s.bidHistory[s.bidHistory.length - 1];
    if (!last || s.status !== 'live') return;
    setS({
      ...s,
      bid: last.bid,
      leader: last.leader,
      bidHistory: s.bidHistory.slice(0, -1),
    });
  };
  const sold = () => {
    if (s.leader < 0) return;
    setS({
      ...s,
      status: 'sold',
      celebrationAt: Date.now(),
      players: s.players.map((p, i) =>
        i === s.player
          ? { ...p, result: 'sold', soldTo: s.leader, soldPrice: s.bid }
          : p,
      ),
    });
  };
  const unsold = () =>
    setS({
      ...s,
      status: 'unsold',
      celebrationAt: 0,
      players: s.players.map((p, i) =>
        i === s.player
          ? { ...p, result: 'unsold', soldTo: -1, soldPrice: 0 }
          : p,
      ),
    });
  const navigateTo = (n: number) => {
    const selectedPlayer = s.players[n];
    setS({
      ...s,
      player: n,
      activeSet: selectedPlayer.set,
      bid:
        selectedPlayer.result === 'sold'
          ? selectedPlayer.soldPrice
          : s.rules.minPoints,
      leader: selectedPlayer.result === 'sold' ? selectedPlayer.soldTo : -1,
      status:
        selectedPlayer.result === 'pending' ? 'live' : selectedPlayer.result,
      bidHistory: [],
      celebrationAt: 0,
    });
  };
  const playersInSet = s.players
    .map((player, i) => ({ player, i }))
    .filter(({ player }) => player.set === s.activeSet)
    .map(({ i }) => i);
  const setPosition = playersInSet.indexOf(s.player);
  const pendingInSet = playersInSet.filter(
    (index) => s.players[index].result === 'pending',
  );
  const pendingInDirection = (direction: 1 | -1) => {
    if (!pendingInSet.length) return -1;
    if (setPosition < 0)
      return direction === 1
        ? pendingInSet[0]
        : pendingInSet[pendingInSet.length - 1];
    for (let offset = 1; offset <= playersInSet.length; offset += 1) {
      const position =
        (setPosition + direction * offset + playersInSet.length) %
        playersInSet.length;
      const candidate = playersInSet[position];
      if (candidate !== s.player && s.players[candidate].result === 'pending')
        return candidate;
    }
    return -1;
  };
  const next = () => {
    if (!pendingInSet.length) return;
    if (s.randomPlayerSelection) {
      const pool = pendingInSet.filter((index) => index !== s.player);
      if (!pool.length) return;
      navigateTo(pool[Math.floor(Math.random() * pool.length)]);
      return;
    }
    const candidate = pendingInDirection(1);
    if (candidate >= 0) navigateTo(candidate);
  };
  const previous = () => {
    const candidate = pendingInDirection(-1);
    if (candidate >= 0) navigateTo(candidate);
  };
  const switchSet = (set: PlayerSet) => {
    const first = s.players.findIndex(
      (player) => player.set === set && player.result === 'pending',
    );
    if (first >= 0) navigateTo(first);
    else setS({ ...s, activeSet: set });
  };
  const reset = () =>
    setS({
      ...s,
      bid: s.rules.minPoints,
      leader: -1,
      status: 'live',
      bidHistory: [],
      celebrationAt: 0,
      players: s.players.map((player, i) =>
        i === s.player
          ? { ...player, result: 'pending', soldTo: -1, soldPrice: 0 }
          : player,
      ),
    });
  const resetCompleteAuction = () => {
    if (
      !window.confirm(
        'Reset the complete auction? This will clear every bid and all sold or unsold results. Players, teams, logos, and settings will be kept.',
      )
    )
      return;
    setS({
      ...s,
      player: 0,
      activeSet: s.players[0]?.set || 'A',
      bid: s.rules.minPoints,
      leader: -1,
      status: 'live',
      bidHistory: [],
      celebrationAt: 0,
      obsMode: 'resting',
      projectorMode: 'resting',
      players: s.players.map((player) => ({
        ...player,
        base: s.rules.minPoints,
        result: 'pending',
        soldTo: -1,
        soldPrice: 0,
      })),
    });
  };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        tab !== 'auction' ||
        target?.isContentEditable ||
        target?.matches('input, textarea, select')
      )
        return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        next();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        previous();
      } else if (
        event.key === 'Enter' &&
        s.status === 'live' &&
        s.leader >= 0
      ) {
        event.preventDefault();
        sold();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [s, tab]);
  return (
    <main className="admin-view">
      <header>
        <Logo />
        <nav>
          <button
            onClick={() => setTab('auction')}
            className={tab === 'auction' ? 'active' : ''}
          >
            <Gavel />
            Auction
          </button>
          <button
            onClick={() => setTab('players')}
            className={tab === 'players' ? 'active' : ''}
          >
            <Users />
            Players
          </button>
          <button
            onClick={() => setTab('rosters')}
            className={tab === 'rosters' ? 'active' : ''}
          >
            <Trophy />
            Teams Screen
          </button>
          <button
            onClick={() => setTab('settings')}
            className={tab === 'settings' ? 'active' : ''}
          >
            <Settings />
            Settings
          </button>
          <a href="/overlay" target="_blank">
            <Radio />
            OBS
            <ExternalLink />
          </a>
          <a href="/projector" target="_blank">
            <MonitorUp />
            Projector
            <ExternalLink />
          </a>
        </nav>
      </header>
      {tab === 'auction' && (
        <div className="admin-grid">
          <section className="admin-main">
            <div className="section-title">
              <span>
                <b>LIVE AUCTION CONTROL</b>
                <small>SKILL SET {s.activeSet} - PLAYER AUCTION</small>
              </span>
              <em>
                PLAYER {Math.max(1, setPosition + 1)} OF {playersInSet.length}
              </em>
            </div>
            <div className="set-switcher">
              <span>
                <small>ACTIVE PLAYER SET</small>
                <b>Choose the skill group being auctioned</b>
              </span>
              {(['A', 'B', 'C'] as PlayerSet[]).map((set) => (
                <button
                  className={s.activeSet === set ? 'active' : ''}
                  onClick={() => switchSet(set)}
                >
                  SET {set}
                  <small>
                    {s.players.filter((player) => player.set === set).length}{' '}
                    PLAYERS
                  </small>
                </button>
              ))}
            </div>
            <div className="admin-player">
              <PlayerImage src={p.image} alt={p.name} />
              {s.status !== 'live' && (
                <div className={'admin-result-stamp ' + s.status}>
                  {s.status.toUpperCase()}
                </div>
              )}
              <div>
                <small>NOW BIDDING</small>
                <h1>{p.name}</h1>
                <p>{p.age ? `AGE ${p.age}` : p.role}</p>
                <span>
                  BASE PRICE <b>{pts(p.base)}</b>
                </span>
              </div>
              <div className="admin-bid">
                <small>{team ? 'CURRENT BID' : 'OPENING PRICE'}</small>
                <strong>{pts(s.bid)}</strong>
                <p>{team?.name || 'Select a team to place bid'}</p>
              </div>
            </div>
            <h3>
              FRANCHISE DESKS <small>CLICK TO PLACE NEXT BID</small>
            </h3>
            <div className="team-buttons">
              {s.teams.map((t, i) => {
                const count = rosterCount(s, i);
                const cap = maxAllowedBid(s, i);
                const nextBid =
                  s.leader < 0 ? s.rules.minPoints : s.bid + BID_STEP;
                const disabled =
                  s.status !== 'live' ||
                  count >= s.rules.maxPlayers ||
                  nextBid > cap;
                return (
                  <button
                    onClick={() => bid(i)}
                    disabled={disabled}
                    className={s.leader === i ? 'leading' : ''}
                  >
                    <TeamMark team={t} />
                    <span>
                      <b>{t.name}</b>
                      <small>
                        {pts(left(s, i))} left - {count}/{s.rules.maxPlayers}{' '}
                        players
                      </small>
                      {count >= s.rules.maxPlayers && <small>SQUAD FULL</small>}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="auction-actions">
              <button className="move-player" onClick={previous}>
                <ChevronLeft />
                <span>
                  <small>LEFT ARROW KEY</small>
                  PREVIOUS
                </span>
              </button>
              <button
                className="sold"
                onClick={sold}
                disabled={s.leader < 0 || s.status !== 'live'}
              >
                <Gavel />
                <span>
                  <small>KEYBOARD: ENTER</small>
                  SOLD
                </span>
              </button>
              <button
                className="unsold"
                onClick={unsold}
                disabled={s.status !== 'live'}
              >
                <span>
                  <small>NO SALE</small>
                  UNSOLD
                </span>
              </button>
              <button
                className="undo"
                onClick={undoBid}
                disabled={!s.bidHistory.length || s.status !== 'live'}
              >
                <Undo2 />
                <span>
                  <small>{s.bidHistory.length} BIDS SAVED</small>
                  UNDO BID
                </span>
              </button>
              <button className="reset-player" onClick={reset}>
                <RotateCcw />
                <span>
                  <small>REOPEN PLAYER</small>
                  RESET
                </span>
              </button>
              <button className="move-player next" onClick={next}>
                <span>
                  <small>RIGHT ARROW KEY</small>
                  NEXT
                </span>
                <ChevronRight />
              </button>
            </div>
          </section>
          <aside className="admin-panel">
            <h2 className="output-heading">Output controls</h2>
            <button
              className={'auction-power ' + (auctionRunning ? 'running' : '')}
              onClick={() =>
                setS({
                  ...s,
                  obsMode: auctionRunning ? 'resting' : 'auction',
                  projectorMode: auctionRunning ? 'resting' : 'auction',
                })
              }
            >
              {auctionRunning ? <Pause /> : <Play />}
              <span>
                <small>
                  {auctionRunning ? 'ALL OUTPUTS LIVE' : 'ALL OUTPUTS ON HOME'}
                </small>
                {auctionRunning ? 'PAUSE AUCTION' : 'START AUCTION'}
              </span>
            </button>
            <section className="output-mode-group">
              <header>
                <Radio />
                <span>
                  <b>OBS Overlay</b>
                  <small>SELECT ONE SCREEN</small>
                </span>
              </header>
              <div>
                {(
                  [
                    ['auction', 'Auction screen'],
                    ['rosters', 'Teams Screen'],
                    ['resting', 'Home screen'],
                  ] as [ObsMode, string][]
                ).map(([mode, label]) => (
                  <button
                    className={s.obsMode === mode ? 'active' : ''}
                    onClick={() => setS({ ...s, obsMode: mode })}
                  >
                    <i />
                    {label}
                  </button>
                ))}
              </div>
            </section>
            <section className="output-mode-group projector">
              <header>
                <MonitorUp />
                <span>
                  <b>Projector Screen</b>
                  <small>SELECT ONE SCREEN</small>
                </span>
              </header>
              <div>
                {(
                  [
                    ['auction', 'Auction screen'],
                    ['rosters', 'Teams Screen'],
                    ['stats', 'Auction stats'],
                    ['resting', 'Home screen'],
                  ] as [ProjectorMode, string][]
                ).map(([mode, label]) => (
                  <button
                    className={s.projectorMode === mode ? 'active' : ''}
                    onClick={() => setS({ ...s, projectorMode: mode })}
                  >
                    <i />
                    {label}
                  </button>
                ))}
              </div>
            </section>
            <button
              className={'audio-toggle ' + (s.celebrationMuted ? 'muted' : '')}
              onClick={() =>
                setS({ ...s, celebrationMuted: !s.celebrationMuted })
              }
            >
              {s.celebrationMuted ? <VolumeX /> : <Volume2 />}
              {s.celebrationMuted
                ? 'SOLD CELEBRATION AUDIO MUTED'
                : 'SOLD CELEBRATION AUDIO ON'}
            </button>
          </aside>
        </div>
      )}
      {tab === 'players' && (
        <section className="manage-page">
          <div className="manage-head">
            <span>
              <small>AUCTION OPERATIONS</small>
              <h1>Player list</h1>
              <p>
                Select any player for the live auction or correct a completed
                result.
              </p>
            </span>
          </div>
          <div className="player-filters">
            <section>
              <small>FILTER BY SET</small>
              <div>
                {(['all', 'A', 'B', 'C'] as const).map((set) => (
                  <button
                    className={playerSetFilter === set ? 'active' : ''}
                    onClick={() => setPlayerSetFilter(set)}
                  >
                    {set === 'all' ? 'All sets' : `Set ${set}`}
                  </button>
                ))}
              </div>
            </section>
            <section>
              <small>FILTER BY STATUS</small>
              <div>
                {(
                  [
                    ['all', 'All players'],
                    ['pending', 'Pending'],
                    ['sold', 'Sold'],
                    ['unsold', 'Unsold'],
                  ] as const
                ).map(([status, label]) => (
                  <button
                    className={playerStatusFilter === status ? 'active' : ''}
                    onClick={() => setPlayerStatusFilter(status)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>
            <strong>
              {filteredPlayers.length} OF {s.players.length} PLAYERS
            </strong>
          </div>
          <div className="player-table">
            <div className="table-row labels">
              <span>PLAYER</span>
              <span>BASE</span>
              <span>STATUS</span>
              <span>TEAM / PRICE</span>
              <span>ACTION</span>
            </div>
            {filteredPlayers.map(({ player: x, index: i }) => (
              <div className={'table-row ' + (s.player === i ? 'current' : '')}>
                <span>
                  <PlayerImage src={x.image} alt={x.name} />
                  <b>
                    {x.name}
                    <small>
                      SET {x.set} - {x.age ? `AGE ${x.age}` : x.role}
                    </small>
                  </b>
                </span>
                <span className="player-base-set">
                  <b>{pts(x.base)}</b>
                  <select
                    value={x.set}
                    onChange={(event) =>
                      patchPlayer(i, {
                        set: event.target.value as PlayerSet,
                      })
                    }
                  >
                    <option value="A">Set A</option>
                    <option value="B">Set B</option>
                    <option value="C">Set C</option>
                  </select>
                </span>
                <span>
                  <select
                    value={x.result}
                    onChange={(e) => {
                      const result = e.target.value as Player['result'];
                      patchPlayer(i, {
                        result,
                        soldTo:
                          result === 'sold'
                            ? x.soldTo >= 0
                              ? x.soldTo
                              : 0
                            : -1,
                        soldPrice:
                          result === 'sold' ? x.soldPrice || x.base : 0,
                      });
                    }}
                  >
                    <option value="pending">Pending</option>
                    <option value="sold">Sold</option>
                    <option value="unsold">Unsold</option>
                  </select>
                </span>
                <span>
                  {x.result === 'sold' ? (
                    <>
                      <select
                        value={x.soldTo}
                        onChange={(e) =>
                          patchPlayer(i, { soldTo: Number(e.target.value) })
                        }
                      >
                        {s.teams.map((t, ti) => (
                          <option value={ti}>{t.name}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={s.rules.minPoints}
                        max={s.rules.maxPoints}
                        step={500}
                        value={x.soldPrice}
                        onChange={(e) =>
                          patchPlayer(i, {
                            soldPrice: clampBid(
                              Number(e.target.value),
                              s.rules,
                            ),
                          })
                        }
                      />
                    </>
                  ) : (
                    <em>-</em>
                  )}
                </span>
                <span>
                  <button onClick={() => send(i)}>
                    {s.player === i ? 'LIVE NOW' : 'Send to auction'}
                  </button>
                </span>
              </div>
            ))}
            {!filteredPlayers.length && (
              <div className="empty-player-filter">
                No players match the selected filters.
              </div>
            )}
          </div>
        </section>
      )}
      {tab === 'rosters' && (
        <section className="manage-page">
          <div className="manage-head">
            <span>
              <small>SQUAD MANAGEMENT</small>
              <h1>Teams Screen</h1>
              <p>Review purchases and remaining points for every franchise.</p>
            </span>
            <button
              className="big-projector-toggle"
              onClick={() => setS({ ...s, projectorMode: 'rosters' })}
            >
              <Eye />
              {s.projectorMode === 'rosters'
                ? 'Currently shown on projector'
                : 'Show this on projector'}
            </button>
          </div>
          <div className="admin-roster-grid">
            {s.teams.map((t, ti) => {
              const roster = s.players.filter(
                (p) => p.result === 'sold' && p.soldTo === ti,
              );
              return (
                <article>
                  <header>
                    <TeamMark team={t} />
                    <span>
                      <b>{t.name}</b>
                      <small>{roster.length} players</small>
                    </span>
                    <strong>
                      {pts(left(s, ti))}
                      <small>POINTS LEFT</small>
                    </strong>
                  </header>
                  {roster.length ? (
                    roster.map((x) => (
                      <p>
                        <span>
                          {x.name}
                          <small>{x.age ? `AGE ${x.age}` : x.role}</small>
                        </span>
                        <b>{pts(x.soldPrice)}</b>
                      </p>
                    ))
                  ) : (
                    <em>No purchases yet</em>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}
      {tab === 'settings' && (
        <section className="settings-page">
          <div className="settings-heading">
            <span>
              <small>ADMIN SETTINGS</small>
              <h1>Auction settings</h1>
              <p>
                Configure auction rules, team wallets, and the branding used by
                the OBS and Projector home screens.
              </p>
            </span>
            <Settings />
          </div>
          <div className="settings-card">
            <div className="auction-rule-settings">
              <header>
                <small>AUCTION CONFIGURATION</small>
                <h2>Auction rules</h2>
                <p>
                  These values control bid eligibility, squad reserves, and
                  every team's available wallet.
                </p>
              </header>
              <label>
                <span>Number of players in each team</span>
                <input
                  type="number"
                  min={1}
                  value={s.rules.maxPlayers}
                  onChange={(event) =>
                    updateRules({ maxPlayers: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                <span>Maximum points per player</span>
                <input
                  type="number"
                  min={s.rules.minPoints}
                  step={1000}
                  value={s.rules.maxPoints}
                  onChange={(event) =>
                    updateRules({ maxPoints: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                <span>Minimum points per player</span>
                <input
                  type="number"
                  min={1}
                  step={1000}
                  value={s.rules.minPoints}
                  onChange={(event) =>
                    updateRules({ minPoints: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                <span>Team wallet total points</span>
                <input
                  type="number"
                  min={s.rules.maxPlayers * s.rules.minPoints}
                  step={5000}
                  value={s.rules.teamWallet}
                  onChange={(event) =>
                    updateRules({ teamWallet: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                <span>Next player selection</span>
                <select
                  value={s.randomPlayerSelection ? 'random' : 'sequential'}
                  onChange={(event) =>
                    setS({
                      ...s,
                      randomPlayerSelection: event.target.value === 'random',
                    })
                  }
                >
                  <option value="random">Random pending player</option>
                  <option value="sequential">Sequential order</option>
                </select>
              </label>
              <em>
                Minimum wallet required for a full squad:{' '}
                {pts(s.rules.maxPlayers * s.rules.minPoints)}
              </em>
            </div>
            <div className="celebration-settings">
              <header>
                <small>SOLD CELEBRATION</small>
                <h2>Confetti appearance</h2>
                <p>
                  Adjust the celebration shown on both OBS and Projector
                  screens.
                </p>
              </header>
              <label>
                <span>Confetti density</span>
                <input
                  type="number"
                  min={10}
                  max={1000}
                  step={5}
                  value={s.celebration.density}
                  onChange={(event) =>
                    setS({
                      ...s,
                      celebration: {
                        ...s.celebration,
                        density: Math.min(
                          1000,
                          Math.max(10, Number(event.target.value) || 10),
                        ),
                      },
                    })
                  }
                />
                <small>Enter a value from 10 to 1,000.</small>
              </label>
              <label>
                <span>Confetti size</span>
                <input
                  type="number"
                  min={10}
                  max={1000}
                  step={5}
                  value={s.celebration.size}
                  onChange={(event) =>
                    setS({
                      ...s,
                      celebration: {
                        ...s.celebration,
                        size: Math.min(
                          1000,
                          Math.max(10, Number(event.target.value) || 10),
                        ),
                      },
                    })
                  }
                />
                <small>Enter a value from 10 to 1,000.</small>
              </label>
            </div>
            <div className="player-database-settings">
              <header>
                <small>PLAYER DATABASE</small>
                <h2>Published spreadsheet link</h2>
                <p>
                  Download and immediately apply names, ages, and photos from
                  the published XLS or XLSX link.
                </p>
              </header>
              <div className="database-download-control">
                <label>
                  <span>Published Google Sheets XLS URL</span>
                  <input
                    type="url"
                    inputMode="url"
                    placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=xlsx"
                    value={s.playerDatabaseUrl}
                    disabled={databaseImport.running}
                    onChange={(event) =>
                      setS({
                        ...s,
                        playerDatabaseUrl: event.target.value.trim(),
                      })
                    }
                  />
                  <small>Saved automatically on this device.</small>
                </label>
                <button
                  type="button"
                  className="download-database-button"
                  disabled={!s.playerDatabaseUrl || databaseImport.running}
                  onClick={downloadPlayerDatabase}
                >
                  {databaseImport.running
                    ? 'Downloading and applying database...'
                    : 'Download and apply player database'}
                </button>
                {(databaseImport.running || databaseImport.message) && (
                  <div
                    className={
                      'database-progress ' +
                      (databaseImport.error ? 'error' : '')
                    }
                  >
                    <progress
                      max={Math.max(1, databaseImport.total)}
                      value={databaseImport.completed}
                    />
                    <span>{databaseImport.message}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="branding-settings">
              <header>
                <small>EVENT BRANDING</small>
                <h2>Projector and Home Screen logos</h2>
                <p>
                  Names appear on the Home Screen. The Projector auction screen
                  displays only the uploaded logos.
                </p>
              </header>
              {(
                [
                  ['tournament', 'tournamentLogo', 'Tournament'],
                  ['sponsor', 'sponsorLogo', 'Title sponsor'],
                  ['groundSponsor', 'groundSponsorLogo', 'Ground sponsor'],
                ] as const
              ).map(([nameField, logoField, label]) => (
                <article>
                  <BrandMark
                    src={s.branding[logoField]}
                    label={s.branding[nameField]}
                  />
                  <label>
                    <span>{label} name</span>
                    <input
                      value={s.branding[nameField]}
                      onChange={(event) =>
                        setS({
                          ...s,
                          branding: {
                            ...s.branding,
                            [nameField]: event.target.value,
                          },
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>Upload {label.toLowerCase()} logo</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(event) =>
                        uploadBrandingLogo(logoField, event.target.files?.[0])
                      }
                    />
                  </label>
                </article>
              ))}
              <label className="ticker-speed-setting">
                <span>Ticker scrolling speed  {s.tickerSpeed}/10</span>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={s.tickerSpeed}
                  onChange={(event) =>
                    setS({
                      ...s,
                      tickerSpeed: Number(event.target.value),
                    })
                  }
                />
                <small>
                  1 is slowest and 10 is fastest. This applies immediately to
                  the Projector ribbon.
                </small>
              </label>
            </div>
            <div className="team-logo-settings">
              <header>
                <span>
                  <small>TEAM IDENTITY</small>
                  <h2>Team names and logos</h2>
                  <p>
                    Add or remove teams, edit their names, and upload square
                    logos.
                  </p>
                </span>
                <button
                  type="button"
                  className="add-team-button"
                  onClick={addTeam}
                >
                  <Plus />
                  Add Team
                </button>
              </header>
              {s.teams.map((team, teamIndex) => (
                <article className="team-identity-card">
                  <TeamMark team={team} />
                  <div>
                    <label>
                      <span>Team name</span>
                      <input
                        value={team.name}
                        onChange={(event) =>
                          setS({
                            ...s,
                            teams: s.teams.map((item, index) =>
                              index === teamIndex
                                ? { ...item, name: event.target.value }
                                : item,
                            ),
                          })
                        }
                      />
                    </label>
                    <label className="team-logo-upload">
                      <span>Upload team logo</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(event) =>
                          uploadTeamLogo(teamIndex, event.target.files?.[0])
                        }
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    className="remove-team-button"
                    onClick={() => removeTeam(teamIndex)}
                    disabled={s.teams.length <= 1}
                    aria-label={`Remove ${team.name}`}
                  >
                    <Trash2 />
                    Remove
                  </button>
                </article>
              ))}
            </div>
            <div className="reset-auction-settings">
              <span>
                <small>DANGER ZONE</small>
                <h2>Reset complete auction</h2>
                <p>
                  Clear every bid and player result, restore all team wallets,
                  and return OBS and Projector to the Home Screen.
                </p>
              </span>
              <button type="button" onClick={resetCompleteAuction}>
                <RotateCcw />
                Reset Complete Auction
              </button>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
export function Admin() {
  const [ready, setReady] = useState(false),
    [unlocked, setUnlocked] = useState(false),
    [value, setValue] = useState(''),
    [error, setError] = useState(''),
    [isSetup, setIsSetup] = useState(false);
  useEffect(() => {
    setIsSetup(!localStorage.getItem('boundaryx-admin-password'));
    setReady(true);
  }, []);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.length < 6) {
      setError('Use at least 6 characters');
      return;
    }
    const saved = localStorage.getItem('boundaryx-admin-password');
    if (!saved) {
      localStorage.setItem('boundaryx-admin-password', value);
      setUnlocked(true);
    } else if (saved === value) setUnlocked(true);
    else setError('Incorrect password');
  };
  if (!ready) return null;
  if (!unlocked)
    return (
      <main className="admin-lock">
        <div>
          <Logo />
          <small>
            {isSetup ? 'FIRST-TIME ADMIN SETUP' : 'PROTECTED CONTROL ROOM'}
          </small>
          <h1>{isSetup ? 'Create admin password' : 'Welcome back'}</h1>
          <p>
            {isSetup
              ? 'This password will protect auction controls on this device.'
              : 'Enter your password to manage the auction.'}
          </p>
          <form onSubmit={submit}>
            <input
              type="password"
              autoFocus
              placeholder={isSetup ? 'Create password' : 'Admin password'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            {error && <em>{error}</em>}
            <button>
              {isSetup ? 'SET PASSWORD & CONTINUE' : 'UNLOCK ADMIN'}
            </button>
          </form>
        </div>
      </main>
    );
  return <AdminConsole />;
}
