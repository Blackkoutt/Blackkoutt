// Generates assets/stats.svg from your public GitHub data. Run by .github/workflows/stats.yml (no dependencies, Node 20+).
import { mkdirSync, writeFileSync } from 'node:fs';

const SANS = `"Segoe UI", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif`;
const MONO = `"JetBrains Mono", "Cascadia Code", "SF Mono", Menlo, Consolas, monospace`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (a, b, t) => '#' + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
const hue = (c) => { const [r, g, b] = hex(c).map((v) => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return 0; const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (h * 60 + 360) % 360; };
const hueGap = (a, b) => { const d = Math.abs(hue(a) - hue(b)); return Math.min(d, 360 - d); };
const CATS = ['#6EA8FE', '#F2B84B', '#B794F4', '#F472B6', '#5FD0C0', '#FF8A5B', '#9ECE6A'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const dayMs = 86400000;
const fmt = (d, year = true) => { const x = new Date(d + 'T00:00:00Z'); return `${MONTHS[x.getUTCMonth()]} ${x.getUTCDate()}${year ? ', ' + x.getUTCFullYear() : ''}`; };

function derive(s) {
  const total = s.days.reduce((p, [, n]) => p + n, 0);
  let run = 0, runStart = '', longest = 0, lStart = '', lEnd = '', prev = null;
  for (const [d, n] of s.days) {
    if (n > 0) { if (prev && run > 0 && new Date(d) - new Date(prev) === dayMs) run++; else { run = 1; runStart = d; } if (run > longest) { longest = run; lStart = runStart; lEnd = d; } } else run = 0;
    prev = d;
  }
  // current streak, same rule as the classic card: today may still be empty, the streak then ends yesterday
  const days = s.days; let i = days.length - 1, cur = 0, curStart = '';
  if (i >= 0 && days[i][1] === 0) i--;
  while (i >= 0 && days[i][1] > 0) { cur++; curStart = days[i][0]; i--; }
  return { total, longest, lStart, lEnd, cur, curStart, today: days[days.length - 1][0] };
}

const ICON = {
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  commit: '<circle cx="12" cy="12" r="4"/><path d="M2 12h6M16 12h6"/>',
  pr: '<circle cx="6" cy="5.5" r="2.3"/><circle cx="6" cy="18.5" r="2.3"/><circle cx="18" cy="18.5" r="2.3"/><path d="M6 8v8M18 16V10a3 3 0 0 0-3-3h-3"/><path d="m14 4-2.5 3L14 10"/>',
  issue: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/>',
  repo: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H18v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H18v-3"/>',
  bars: '<path d="M5 20V11M12 20V4M19 20v-6"/>',
  code: '<path d="m8 8-5 4 5 4M16 8l5 4-5 4M14 5l-4 14"/>',
  flame: '<path d="M12 2.5c.8 3-3.6 4.6-3.6 9a4.6 4.6 0 0 0 9.2 0c0-2-.9-3.2-1.9-4.2 0 1.8-.8 2.7-1.7 3 .9-3.6-.2-5.9-2-7.8z"/>',
};
const GH = 'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12';
const icon = (n, x, y, s, c, w = 1.8) => `<g transform="translate(${x} ${y}) scale(${s / 24})" fill="none" stroke="${c}" stroke-width="${(w * 24 / s).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round">${ICON[n]}</g>`;

function statsSvg(P, s, langs) {
  const d = derive(s);
  const W = 1000, H = 580;
  const css = `text { font-family: ${SANS}; } .mono { font-family: ${MONO}; }
    .in { animation: in .7s ease-out both; } @keyframes in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
    .arc { animation: arc 1.4s cubic-bezier(.2,.7,.2,1) both; } @keyframes arc { from { stroke-dasharray: 0 var(--c); } to { stroke-dasharray: var(--d) var(--c); } }
    .pulse { transform-box: fill-box; transform-origin: center; animation: pulse 4s ease-in-out infinite; } @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }
    .fl { transform-box: fill-box; transform-origin: center bottom; animation: fl 1.8s ease-in-out infinite; } @keyframes fl { 0%,100% { transform: scale(1); } 50% { transform: scale(1.1, .94); } }`;
  const card = (x, y, w, h) => `<rect x="${x + .5}" y="${y + .5}" width="${w - 1}" height="${h - 1}" rx="14" fill="${P.panel}" stroke="${P.line}"/>`;
  const title = (t, x, y) => `<g transform="translate(${x + 2} ${y - 28}) scale(1.25)" fill="none" stroke="${P.acc}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 4 7.5 20M16.5 4l-2 16M4.5 9h15M4 15h15"/></g><text x="${x + 48}" y="${y}" font-size="25" font-weight="700" fill="${P.ink}" letter-spacing="-.3">${t}</text>`;

  // ---------- stats card ----------
  const rows = [['star', 'Total stars', s.stars], ['commit', 'Total commits', s.commits], ['pr', 'Pull requests', s.prs], ['issue', 'Issues opened', s.issues], ['repo', 'Public repositories', s.repos]];
  const rowEls = rows.map(([ic, l, v], i) => { const y = 118 + i * 40;
    return `<g class="in" style="animation-delay:${(0.1 + i * 0.08).toFixed(2)}s">${icon(ic, 28, y - 20, 27, P.acc)}<text x="68" y="${y}" font-size="20" fill="${P.text}">${l}</text><text class="mono" x="324" y="${y}" text-anchor="end" font-size="23" font-weight="700" fill="${P.ink}">${v}</text></g>`; }).join('');
  const statsCard = `${card(0, 0, 490, 296)}${title('Stats', 28, 48)}${rowEls}
    <g class="pulse"><circle cx="404" cy="176" r="62" fill="${P.acc}" fill-opacity=".09"/><g transform="translate(354 126) scale(4.17)"><path d="${GH}" fill="${P.acc}"/></g></g>`;

  // ---------- languages donut ----------
  const cx = 640, cy = 176, r = 62, C = 2 * Math.PI * r, tot = langs.reduce((p, l) => p + l[1], 0);
  const shades = [P.acc, ...CATS.filter((c) => hueGap(c, P.acc) > 45).slice(0, langs.length - 1)].map((c, i) => (i ? mix(c, P.panel, 0.12) : c));
  let off = 0;
  const arcs = langs.map(([n, p], i) => { const len = (p / tot) * C, el = `<circle class="arc" style="--d:${Math.max(len - 3, 1).toFixed(1)}px;--c:${C.toFixed(1)}px;animation-delay:${(0.3 + i * 0.12).toFixed(2)}s" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${shades[i]}" stroke-width="24" stroke-dasharray="${Math.max(len - 3, 1).toFixed(1)} ${C.toFixed(1)}" stroke-dashoffset="${(-off).toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"/>`; off += len; return el; }).join('');
  const leg = langs.map(([n, p], i) => `<g class="in" style="animation-delay:${(0.5 + i * 0.08).toFixed(2)}s"><rect x="756" y="${122 + i * 40 - 15}" width="16" height="16" rx="4" fill="${shades[i]}"/><text x="784" y="${122 + i * 40}" font-size="20" fill="${P.ink}">${esc(n)}</text><text class="mono" x="976" y="${122 + i * 40}" text-anchor="end" font-size="21" font-weight="700" fill="${P.ink}">${p.toFixed(1)}%</text></g>`).join('');
  const langCard = `${card(510, 0, 490, 296)}${title('Top languages', 538, 48)}
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${P.line}" stroke-width="24" stroke-opacity=".55"/>${arcs}
    <text x="${cx}" y="${cy + 2}" text-anchor="middle" font-size="26" font-weight="700" fill="${P.ink}">${esc(langs[0][0])}</text><text class="mono" x="${cx}" y="${cy + 22}" text-anchor="middle" font-size="14" fill="${P.muted}">${langs[0][1].toFixed(0)}%</text>
    ${leg}<text x="976" y="46" text-anchor="end" font-size="16" fill="${P.muted}">by code size</text>`;

  // ---------- streak card ----------
  const y0 = 312, h2 = 268;
  const ringR = 60, RC = 2 * Math.PI * ringR, share = d.longest ? Math.min(d.cur / d.longest, 1) : 0, rx = 500, ry = y0 + 108;
  const arcLen = Math.max(share * RC, 0);
  const col1 = `<g class="in" style="animation-delay:.2s"><text x="167" y="${y0 + 124}" text-anchor="middle" font-size="76" font-weight="700" fill="${P.ink}" letter-spacing="-1.5">${d.total}</text><text x="167" y="${y0 + 170}" text-anchor="middle" font-size="25" fill="${P.text}">Total contributions</text><text x="167" y="${y0 + 206}" text-anchor="middle" font-size="19" fill="${P.muted}">${fmt(s.days[0][0])} – present</text></g>`;
  const ring = `<circle cx="${rx}" cy="${ry}" r="${ringR}" fill="none" stroke="${P.line}" stroke-width="10"/>${arcLen > 0 ? `<circle class="arc" style="--d:${arcLen.toFixed(1)}px;--c:${RC.toFixed(1)}px" cx="${rx}" cy="${ry}" r="${ringR}" fill="none" stroke="${P.acc}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${arcLen.toFixed(1)} ${RC.toFixed(1)}" transform="rotate(-90 ${rx} ${ry})"/>` : ''}
    <circle cx="${rx}" cy="${ry - ringR}" r="22" fill="${P.panel}"/><g class="fl">${icon('flame', rx - 16, ry - ringR - 17, 32, P.acc, 2)}</g>`;
  const col2 = `<g class="in" style="animation-delay:.35s">${ring}<text x="${rx}" y="${ry + 16}" text-anchor="middle" font-size="48" font-weight="700" fill="${P.ink}">${d.cur}</text><text x="${rx}" y="${y0 + 218}" text-anchor="middle" font-size="25" font-weight="700" fill="${P.acc}">Current streak</text><text x="${rx}" y="${y0 + 246}" text-anchor="middle" font-size="19" fill="${P.muted}">${d.cur ? `${fmt(d.curStart, false)} – ${fmt(d.today, false)}` : `as of ${fmt(d.today, false)}`}</text></g>`;
  const col3 = `<g class="in" style="animation-delay:.5s"><text x="833" y="${y0 + 124}" text-anchor="middle" font-size="76" font-weight="700" fill="${P.ink}" letter-spacing="-1.5">${d.longest}</text><text x="833" y="${y0 + 170}" text-anchor="middle" font-size="25" fill="${P.text}">Longest streak</text><text x="833" y="${y0 + 206}" text-anchor="middle" font-size="19" fill="${P.muted}">${fmt(d.lStart, false)} – ${fmt(d.lEnd)}</text></g>`;
  const streakCard = `${card(0, y0, 1000, h2)}<line x1="333" y1="${y0 + 30}" x2="333" y2="${y0 + h2 - 30}" stroke="${P.line}"/><line x1="667" y1="${y0 + 30}" x2="667" y2="${y0 + h2 - 30}" stroke="${P.line}"/>${col1}${col2}${col3}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="GitHub statistics: ${s.stars} stars, ${s.commits} commits, ${s.prs} pull requests, ${s.issues} issues, ${s.repos} public repositories. Top language ${langs[0][0]}. ${d.total} total contributions, current streak ${d.cur} days, longest streak ${d.longest} days.">
  <style>${css}</style>
  ${statsCard}${langCard}${streakCard}
</svg>`;
}

const PALETTES = {
  "sunset": {
    "bg": "#15131A",
    "panel": "#1C1923",
    "line": "#2E2A38",
    "ink": "#F3EDE6",
    "text": "#CFC7D2",
    "muted": "#8F8798",
    "acc": "#F08A4B"
  },
  "mint": {
    "bg": "#0E1216",
    "panel": "#141A20",
    "line": "#222B33",
    "ink": "#EAF3EF",
    "text": "#BCCBC6",
    "muted": "#7B8B86",
    "acc": "#4FD1A5"
  },
  "gold": {
    "bg": "#101A16",
    "panel": "#16231D",
    "line": "#26382F",
    "ink": "#F1EADB",
    "text": "#C9C3B0",
    "muted": "#869A8E",
    "acc": "#D9B25F"
  },
  "blue": {
    "bg": "#0D1117",
    "panel": "#151B23",
    "line": "#252C36",
    "ink": "#E6EDF3",
    "text": "#B6C2CF",
    "muted": "#7D8794",
    "acc": "#6AA9FF"
  },
  "red": {
    "bg": "#0C0C0C",
    "panel": "#141414",
    "line": "#262626",
    "ink": "#F5F5F5",
    "text": "#CFCFCF",
    "muted": "#8A8A8A",
    "acc": "#E5483D"
  }
};

const LOGIN = process.env.STATS_LOGIN || process.env.GITHUB_REPOSITORY_OWNER;
const TOKEN = process.env.GH_TOKEN;
const PALETTE = process.env.PALETTE || 'mint';
if (!LOGIN || !TOKEN) throw new Error('Set GH_TOKEN and STATS_LOGIN (or run inside GitHub Actions).');

async function gql(query) {
  const r = await fetch('https://api.github.com/graphql', { method: 'POST', headers: { Authorization: 'bearer ' + TOKEN, 'User-Agent': 'profile-stats' }, body: JSON.stringify({ query }) });
  const j = await r.json();
  if (j.errors) throw new Error(JSON.stringify(j.errors));
  return j.data.user;
}
async function rest(path) {
  const r = await fetch('https://api.github.com' + path, { headers: { Authorization: 'bearer ' + TOKEN, 'User-Agent': 'profile-stats', Accept: 'application/vnd.github+json' } });
  if (!r.ok) throw new Error(path + ' -> ' + r.status);
  return r.json();
}

async function fetchStats(login) {
  const meta = await gql(`query { user(login:"${login}") { createdAt repositories(privacy:PUBLIC, ownerAffiliations:OWNER, first:100) { totalCount nodes { stargazerCount } } repositoriesContributedTo(first:1, contributionTypes:[COMMIT,ISSUE,PULL_REQUEST,REPOSITORY]) { totalCount } } }`);
  const created = new Date(meta.createdAt), now = new Date();
  const out = { repos: meta.repositories.totalCount, stars: meta.repositories.nodes.reduce((p, n) => p + n.stargazerCount, 0), contributedTo: meta.repositoriesContributedTo.totalCount, created: meta.createdAt, commits: 0, prs: 0, issues: 0, reviews: 0, days: [] };
  for (let y = created.getUTCFullYear(); y <= now.getUTCFullYear(); y++) {
    const from = new Date(Date.UTC(y, 0, 1)), to = y === now.getUTCFullYear() ? now : new Date(Date.UTC(y, 11, 31, 23, 59, 59));
    const u = await gql(`query { user(login:"${login}") { contributionsCollection(from:"${from.toISOString()}", to:"${to.toISOString()}") { totalCommitContributions totalPullRequestContributions totalIssueContributions totalPullRequestReviewContributions contributionCalendar { weeks { contributionDays { date contributionCount } } } } } }`);
    const c = u.contributionsCollection;
    out.commits += c.totalCommitContributions; out.prs += c.totalPullRequestContributions; out.issues += c.totalIssueContributions; out.reviews += c.totalPullRequestReviewContributions;
    for (const w of c.contributionCalendar.weeks) for (const d of w.contributionDays) out.days.push([d.date, d.contributionCount]);
  }
  const seen = new Map(); out.days.forEach(([d, n]) => seen.set(d, n));
  out.days = [...seen.entries()].sort((a, b) => a[0].localeCompare(b[0])).filter(([d]) => new Date(d) >= new Date(created.toISOString().slice(0, 10)) && new Date(d) <= now);
  return out;
}

async function fetchLanguages(login) {
  const repos = (await rest('/users/' + login + '/repos?per_page=100&type=owner')).filter((r) => !r.fork);
  const total = {};
  for (const r of repos) { try { for (const [k, v] of Object.entries(await rest('/repos/' + login + '/' + r.name + '/languages'))) total[k] = (total[k] || 0) + v; } catch (e) { /* skip empty or private repos */ } }
  const sum = Object.values(total).reduce((p, c) => p + c, 0) || 1;
  return Object.entries(total).sort((p, c) => c[1] - p[1]).slice(0, 5).map(([k, v]) => [k, (v / sum) * 100]);
}

const P = PALETTES[PALETTE];
if (!P) throw new Error('Unknown PALETTE: ' + PALETTE + ' (use one of ' + Object.keys(PALETTES).join(', ') + ')');
const OUT = process.env.OUT_FILE || 'assets/stats.svg';
const [stats, langs] = await Promise.all([fetchStats(LOGIN), fetchLanguages(LOGIN)]);
mkdirSync(OUT.split('/').slice(0, -1).join('/') || '.', { recursive: true });
writeFileSync(OUT, statsSvg(P, stats, langs));
console.log('wrote', OUT, '|', stats.commits, 'commits,', stats.prs, 'PRs,', langs.map((l) => l[0] + ' ' + l[1].toFixed(1) + '%').join(', '));
