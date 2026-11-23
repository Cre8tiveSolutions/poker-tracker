/* Poker Tracker — app logic (plain JavaScript, no build step). */
(() => {
'use strict';

const CFG = window.POKER_CONFIG || {};
const QUICK = CFG.quickAmounts || [10, 20, 50, 100];
const $app = document.getElementById('app');
const $modal = document.getElementById('modal');
const $toast = document.getElementById('toast');

/* ================= Helpers ================= */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cents = (n) => Math.round(Number(n || 0) * 100);
function money(c, sign = false) {
  const abs = Math.abs(c) / 100;
  const s = Number.isInteger(abs)
    ? abs.toLocaleString('en-SG')
    : abs.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (c < 0 ? '−' : (sign && c > 0 ? '+' : '')) + '$' + s;
}
const netClass = (c) => (c > 0 ? 'up' : 'down');
const fmtTime = (d) => new Date(d).toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit' }).replace(/\s?([AP])\.?M\.?/i, (m, a) => ' ' + a.toLowerCase() + 'm');
function fmtDate(iso, withYear = false) {
  const d = new Date(iso + 'T00:00:00');
  const o = { weekday: 'short', day: 'numeric', month: 'short' };
  if (withYear) o.year = 'numeric';
  return d.toLocaleDateString('en-GB', o).replace(',', '');
}
const pad = (n) => String(n).padStart(2, '0');
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const toLocalInput = (d) => { d = new Date(d); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const byTime = (a, b) => new Date(a.bought_at) - new Date(b.bought_at);
const duration = (a, b) => { const m = Math.max(0, Math.round((new Date(b) - new Date(a)) / 60000)); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; };
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

const ic = {
  back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
  plus: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  note: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 4h14v16H5zM9 9h6M9 13h6M9 17h3"/></svg>',
  edit: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  trash: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg>',
  check: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>',
  warn: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" style="flex-shrink:0"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/></svg>',
  arrow: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg>',
  cal: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
  bars: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 20V11M12 20V5M18 20v-6"/></svg>',
  users: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 010 7M21 20c0-2.6-1.6-4.8-4-5.6"/></svg>',
  more: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.6 3.1-6.5 7-6.5s7 2.9 7 6.5"/></svg>',
  clock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'
};

/* ================= Data connection ================= */
function supabaseBackend() {
  if (!window.supabase || !CFG.supabaseUrl || !CFG.supabaseKey) throw new Error('App settings missing (assets/config.js).');
  const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true } });
  const fail = (error) => { if (error) throw new Error(error.message || 'Something went wrong'); };
  async function all(table, orders) {
    const size = 1000; let out = [];
    for (let from = 0; ; from += size) {
      let q = sb.from(table).select('*');
      orders.forEach((o) => { q = q.order(o, { ascending: true }); });
      const { data, error } = await q.range(from, from + size - 1);
      fail(error); out = out.concat(data || []);
      if (!data || data.length < size) break;
    }
    return out;
  }
  const matchQ = (q, m) => { Object.entries(m).forEach(([k, v]) => { q = q.eq(k, v); }); return q; };
  const NOT_ALLOWED = 'Not allowed — please sign in as a banker.';
  let dbChannel = null;
  return {
    async loadAll() {
      const { data: groups, error } = await sb.from('groups').select('*').order('created_at').limit(1);
      fail(error);
      const group = groups && groups[0];
      if (!group) return { group: null };
      const [players, sessions, sp, buyIns, pays, names] = await Promise.all([
        all('players', ['created_at', 'id']),
        all('sessions', ['started_at', 'id']),
        all('session_players', ['session_id', 'player_id']),
        all('buy_ins', ['bought_at', 'id']),
        all('settle_payments', ['session_id', 'from_player_id', 'to_player_id']),
        sb.rpc('banker_names', { gid: group.id }).then((r) => { fail(r.error); return r.data || []; })
      ]);
      return { group, players, sessions, sp, buyIns, pays, names };
    },
    async insert(table, rows) { const { data, error } = await sb.from(table).insert(rows).select(); fail(error); if (!data || !data.length) throw new Error(NOT_ALLOWED); return data; },
    async update(table, match, patch) { const { data, error } = await matchQ(sb.from(table).update(patch), match).select(); fail(error); if (!data || !data.length) throw new Error(NOT_ALLOWED); return data; },
    async remove(table, match) { const { data, error } = await matchQ(sb.from(table).delete(), match).select(); fail(error); if (!data || !data.length) throw new Error(NOT_ALLOWED); return data; },
    async upsert(table, row, onConflict) { const { data, error } = await sb.from(table).upsert(row, { onConflict }).select(); fail(error); if (!data || !data.length) throw new Error(NOT_ALLOWED); return data; },
    async rpc(name, args) { const { data, error } = await sb.rpc(name, args); fail(error); return data; },
    async getUser() { const { data } = await sb.auth.getSession(); return data.session ? data.session.user : null; },
    async signIn(email, password) { const { data, error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message); return data.user; },
    async signOut() { await sb.auth.signOut(); },
    async changePassword(password) { const { error } = await sb.auth.updateUser({ password }); fail(error); },
    onAuth(cb) { sb.auth.onAuthStateChange((_e, session) => cb(session ? session.user : null)); },
    async myRole(gid, uid) { const { data, error } = await sb.from('members').select('role').eq('group_id', gid).eq('user_id', uid).maybeSingle(); fail(error); return data ? data.role : null; },
    subscribe(onChange) {
      if (dbChannel) return;
      dbChannel = sb.channel('poker-db')
        .on('postgres_changes', { event: '*', schema: 'public' }, () => onChange())
        .subscribe();
    },
    presence(sessionId, onCount) {
      const key = Math.random().toString(36).slice(2);
      const ch = sb.channel('room-' + sessionId, { config: { presence: { key } } });
      ch.on('presence', { event: 'sync' }, () => onCount(Object.keys(ch.presenceState()).length))
        .subscribe((status) => { if (status === 'SUBSCRIBED') ch.track({ at: Date.now() }); });
      return () => { sb.removeChannel(ch); };
    }
  };
}

let DB;
try { DB = window.POKER_BACKEND || supabaseBackend(); } catch (e) { $app.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }

/* ================= State ================= */
const S = {
  loading: true, error: null, group: null,
  players: [], sessions: [], sp: [], buyIns: [], pays: [], names: [],
  user: null, role: null, hasOwner: true,
  bankers: null, presence: 0, presenceFor: null, stopPresence: null,
  cashDraft: {}, period: 'all', bi: null
};
const isBanker = () => S.role === 'owner' || S.role === 'banker';
const isOwner = () => S.role === 'owner';
let IDX = null;

function buildIndex() {
  const players = new Map(S.players.map((p) => [p.id, p]));
  const spBy = new Map(); S.sp.forEach((r) => { if (!spBy.has(r.session_id)) spBy.set(r.session_id, []); spBy.get(r.session_id).push(r); });
  const biBy = new Map(); S.buyIns.forEach((b) => { if (!biBy.has(b.session_id)) biBy.set(b.session_id, []); biBy.get(b.session_id).push(b); });
  biBy.forEach((l) => l.sort(byTime));
  const names = new Map((S.names || []).map((n) => [n.user_id, n.display_name]));
  IDX = { players, spBy, biBy, names, sd: new Map(), stats: new Map() };
}
const player = (id) => (IDX && IDX.players.get(id)) || { id, name: 'Unknown', nickname: null };
const enteredBy = (uid) => (uid && IDX.names.get(uid)) || 'a banker';

/* ================= Calculations ================= */
function sessionData(sid) {
  if (IDX.sd.has(sid)) return IDX.sd.get(sid);
  const s = S.sessions.find((x) => x.id === sid);
  if (!s) return null;
  const bis = IDX.biBy.get(sid) || [];
  const rows = (IDX.spBy.get(sid) || []).map((r) => {
    const pb = bis.filter((b) => b.player_id === r.player_id);
    const inC = pb.reduce((a, b) => a + cents(b.amount), 0);
    const outC = r.cash_out == null ? null : cents(r.cash_out);
    return { r, p: player(r.player_id), bis: pb, inC, outC, netC: outC == null ? null : outC - inC };
  }).sort((a, b) => a.p.name.localeCompare(b.p.name));
  const totalIn = rows.reduce((a, x) => a + x.inC, 0);
  const allOut = rows.length > 0 && rows.every((x) => x.outC != null);
  const totalOut = rows.reduce((a, x) => a + (x.outC || 0), 0);
  const d = { s, rows, bis, totalIn, totalOut, allOut, balanced: allOut && totalIn === totalOut };
  IDX.sd.set(sid, d);
  return d;
}

// Fewest transfers: first match exact equal amounts, then largest debtor pays largest winner.
function settle(rows) {
  const cred = [], debt = [];
  rows.forEach((x) => { if (x.netC > 0) cred.push({ id: x.p.id, amt: x.netC }); else if (x.netC < 0) debt.push({ id: x.p.id, amt: -x.netC }); });
  const out = [];
  debt.forEach((d) => {
    const c = cred.find((k) => k.amt === d.amt && k.amt > 0);
    if (c && d.amt > 0) { out.push({ from: d.id, to: c.id, c: d.amt }); c.amt = 0; d.amt = 0; }
  });
  const D = debt.filter((d) => d.amt > 0).sort((a, b) => b.amt - a.amt);
  const C = cred.filter((c) => c.amt > 0).sort((a, b) => b.amt - a.amt);
  let i = 0, j = 0;
  while (i < D.length && j < C.length) {
    const m = Math.min(D[i].amt, C[j].amt);
    out.push({ from: D[i].id, to: C[j].id, c: m });
    D[i].amt -= m; C[j].amt -= m;
    if (!D[i].amt) i++;
    if (!C[j].amt) j++;
  }
  return out;
}

const endedSessions = () => S.sessions.filter((s) => s.status === 'ended')
  .sort((a, b) => (a.played_on === b.played_on ? new Date(a.started_at) - new Date(b.started_at) : a.played_on.localeCompare(b.played_on)));

function stats(period) {
  if (IDX.stats.has(period)) return IDX.stats.get(period);
  const year = String(new Date().getFullYear());
  const map = new Map();
  endedSessions().filter((s) => period === 'all' || s.played_on.startsWith(year)).forEach((s) => {
    sessionData(s.id).rows.forEach((x) => {
      if (x.netC == null) return;
      if (!map.has(x.p.id)) map.set(x.p.id, { p: x.p, games: 0, wins: 0, netC: 0, best: null, worst: null, series: [] });
      const m = map.get(x.p.id);
      m.games++; if (x.netC > 0) m.wins++; m.netC += x.netC;
      if (m.best === null || x.netC > m.best.c) m.best = { c: x.netC, s };
      if (m.worst === null || x.netC < m.worst.c) m.worst = { c: x.netC, s };
      m.series.push({ s, c: x.netC, cum: m.netC });
    });
  });
  map.forEach((m) => {
    let st = 0; for (let k = m.series.length - 1; k >= 0 && m.series[k].c > 0; k--) st++;
    m.streak = st;
  });
  const list = [...map.values()].sort((a, b) => b.netC - a.netC || b.games - a.games);
  IDX.stats.set(period, list);
  return list;
}

function streakAt(pid, sid) {
  const m = stats('all').find((x) => x.p.id === pid);
  if (!m) return 0;
  const k = m.series.findIndex((e) => e.s.id === sid);
  let st = 0; for (let i = k; i >= 0 && m.series[i].c > 0; i--) st++;
  return st;
}

function awards(sid) {
  const d = sessionData(sid);
  const rows = d.rows.filter((x) => x.netC != null);
  if (!rows.length) return [];
  const out = [];
  const best = rows.reduce((a, x) => (x.netC > (a ? a.netC : 0) ? x : a), null);
  if (best) out.push({ t: 'Biggest winner', w: best.p.name, y: money(best.netC, true) + ' tonight', top: true });
  const reb = rows.reduce((a, x) => ((x.bis.length - 1) > (a ? a.bis.length - 1 : 0) ? x : a), null);
  if (reb) out.push({ t: 'Most re-buys', w: reb.p.name, y: plural(reb.bis.length - 1, 're-buy') });
  const cb = rows.filter((x) => x.bis.length > 1 && x.netC > 0 && x !== best).sort((a, b) => b.netC - a.netC)[0];
  if (cb) out.push({ t: 'Comeback', w: cb.p.name, y: `Re-bought, still ${money(cb.netC, true)}` });
  if (d.s.status === 'ended') {
    const hot = rows.map((x) => ({ x, st: streakAt(x.p.id, sid) })).filter((o) => o.st >= 3).sort((a, b) => b.st - a.st)[0];
    if (hot) out.push({ t: 'Hot streak', w: hot.x.p.name, y: `${hot.st} wins in a row` });
  }
  return out;
}

function busiestHour(d) {
  const firsts = new Set(d.rows.map((x) => x.bis[0] && x.bis[0].id));
  let list = d.bis.filter((b) => !firsts.has(b.id));
  if (!list.length) return null;
  const count = {}; list.forEach((b) => { const h = new Date(b.bought_at).getHours(); count[h] = (count[h] || 0) + 1; });
  const h = Number(Object.entries(count).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0]);
  const lab = (x) => { const hh = x % 12 || 12; return `${hh}`; };
  return `${lab(h)}–${lab(h + 1)} ${(h + 1) % 24 < 12 ? 'am' : 'pm'}`;
}

/* ================= Loading & sync ================= */
async function reload() {
  try {
    const data = await DB.loadAll();
    if (!data.group) { S.group = null; S.loading = false; S.error = 'setup'; render(); return; }
    Object.assign(S, data, { loading: false, error: null });
    await refreshRole();
    buildIndex();
    render();
  } catch (e) {
    S.loading = false; S.error = e.message; render();
  }
}
async function refreshRole() {
  S.user = await DB.getUser();
  S.role = S.user && S.group ? await DB.myRole(S.group.id, S.user.id) : null;
  S.hasOwner = S.group ? await DB.rpc('group_has_owner', { gid: S.group.id }) : true;
}
let reloadTimer = null;
const softReload = () => { clearTimeout(reloadTimer); reloadTimer = setTimeout(reload, 350); };

async function run(fn, okMsg) {
  try { const r = await fn(); if (okMsg) toast(okMsg); await reload(); return r; }
  catch (e) { toast(e.message, { err: true }); await reload(); return null; }
}

/* ================= Toast & modal ================= */
let toastTimer = null;
function toast(msg, opt = {}) {
  clearTimeout(toastTimer);
  $toast.innerHTML = `<div class="t${opt.err ? ' err' : ''}"><span>${esc(msg)}</span>${opt.action ? `<button type="button" data-toast-act>${esc(opt.action)}</button>` : ''}</div>`;
  const b = $toast.querySelector('[data-toast-act]');
  if (b) b.onclick = () => { $toast.innerHTML = ''; opt.onAction(); };
  toastTimer = setTimeout(() => { $toast.innerHTML = ''; }, opt.ms || (opt.action ? 7000 : 3000));
}
function openModal(html, keep) {
  const sheet = keep && $modal.querySelector('.sheet');
  if (sheet) { sheet.innerHTML = `<div class="grab"></div>${html}`; return; }
  $toast.classList.add('at-top');
  $modal.innerHTML = `<div class="backdrop" data-act="closeBackdrop"><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div></div>`;
  const f = $modal.querySelector('[autofocus]'); if (f) f.focus();
}
function closeModal() { $modal.innerHTML = ''; $toast.classList.remove('at-top'); S.bi = null; if (pendingRender) render(); }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $modal.innerHTML) closeModal(); });

/* ================= Router & render ================= */
const route = () => {
  const h = location.hash.replace(/^#/, '') || '/';
  const p = h.split('/').filter(Boolean);
  return { h, p };
};
let pendingRender = false;
function render() {
  const a = document.activeElement;
  if (a && $app.contains(a) && /INPUT|TEXTAREA/.test(a.tagName) && a.type !== 'checkbox') { pendingRender = true; return; }
  pendingRender = false;
  if (S.loading) { $app.innerHTML = '<div class="loading">Loading…</div>'; return; }
  if (S.error === 'setup') { $app.innerHTML = `<div class="page"><h1>Almost there</h1><p class="sub">The database isn't set up yet. Run <b>setup/setup.sql</b> in Supabase → SQL Editor, then reload this page.</p></div>`; return; }
  if (S.error) { $app.innerHTML = `<div class="page"><h1>Can't connect</h1><p class="sub">${esc(S.error)}</p><p class="small">If the app hasn't been used for a while, the free database may be paused. Open the Supabase dashboard and click “Resume project”.</p><button class="btn blue" data-act="retry">Try again</button></div>`; return; }
  const { p } = route();
  let html;
  if (p[0] === 's' && p[1]) {
    if (p[2] === 'cashout') html = viewCashOut(p[1]);
    else if (p[2] === 'p' && p[3]) html = viewPlayerTonight(p[1], p[3]);
    else html = viewSession(p[1]);
  } else if (p[0] === 'new') html = viewNew();
  else if (p[0] === 'leaderboard') html = viewLeaderboard();
  else if (p[0] === 'players') html = viewPlayers();
  else if (p[0] === 'player' && p[1]) html = viewPlayer(p[1]);
  else if (p[0] === 'more') html = viewMore();
  else html = viewGames();
  $app.innerHTML = html;
  syncPresence();
}
window.addEventListener('hashchange', () => { closeModal(); render(); window.scrollTo(0, 0); });
document.addEventListener('focusout', () => { setTimeout(() => { if (pendingRender) render(); }, 0); });

function nav(active) {
  const tabs = [['#/', 'Games', ic.cal, 'games'], ['#/leaderboard', 'Leaderboard', ic.bars, 'lb'], ['#/players', 'Players', ic.users, 'players'], ['#/more', S.user ? 'Me' : 'Sign in', ic.more, 'more']];
  return `<nav class="tabbar" aria-label="Main">${tabs.map(([h, l, i, k]) => `<a href="${h}" class="${active === k ? 'on' : ''}" ${active === k ? 'aria-current="page"' : ''}>${i}<span>${l}</span></a>`).join('')}</nav>`;
}
const avatar = (p, lg) => `<span class="av${lg ? ' lg' : ''}">${p.photo_url ? `<img src="${esc(p.photo_url)}" alt="">` : esc((p.name || '?').trim().charAt(0).toUpperCase())}</span>`;
const backLink = (href, label = 'Back') => `<a class="back" href="${href}" aria-label="${esc(label)}">${ic.back}</a>`;

/* ---------- Games list ---------- */
function viewGames() {
  const sessions = [...S.sessions].sort((a, b) => (a.status !== b.status ? (a.status === 'live' ? -1 : 1) : b.played_on.localeCompare(a.played_on) || new Date(b.started_at) - new Date(a.started_at)));
  const ownerBanner = S.user && !S.hasOwner ? `<div class="card stack"><b>This group has no owner yet.</b><span class="small">You're signed in. Become the owner so you can add bankers.</span><button class="btn blue sm" data-act="claimOwner">Become owner</button></div>` : '';
  const cards = sessions.map((s) => {
    const d = sessionData(s.id);
    const w = d.rows.filter((x) => x.netC != null).sort((a, b) => b.netC - a.netC)[0];
    const meta = s.status === 'live'
      ? `${plural(d.rows.length, 'player')} · ${money(d.totalIn)} in so far`
      : `${plural(d.rows.length, 'player')} · ${money(d.totalIn)} in${w && w.netC > 0 ? ` · top: ${esc(w.p.name)} ${money(w.netC, true)}` : ''}`;
    return `<a class="row link" href="#/s/${s.id}"><div class="main"><div class="name">${esc(fmtDate(s.played_on))}${s.location ? ` · ${esc(s.location)}` : ''}</div><div class="meta">${meta}</div></div>${s.status === 'live' ? '<span class="pill"><span class="dot"></span>Live</span>' : ''}</a>`;
  }).join('');
  return `<div class="page">
    <div><h1>Poker nights</h1><div class="sub">${esc(S.group.name)}</div></div>
    ${ownerBanner}
    ${isBanker() ? `<a class="btn blue block" href="#/new">${ic.plus} Start a game night</a>` : ''}
    <div class="list">${cards || `<div class="empty">No game nights yet.${isBanker() ? '' : ' A banker can start one.'}</div>`}</div>
  </div>${nav('games')}`;
}

/* ---------- New game night ---------- */
function viewNew() {
  if (!isBanker()) return `<div class="page">${backLink('#/')}<h1>Bankers only</h1><p class="sub">Sign in as a banker to start a game night.</p><a class="btn blue" href="#/more">Sign in</a></div>${nav('games')}`;
  const dr = S.newDraft || (S.newDraft = { date: todayISO(), loc: '', picks: [] });
  const active = S.players.filter((p) => p.active).sort((a, b) => a.name.localeCompare(b.name));
  return `<div class="page has-actions">
    <div class="top">${backLink('#/')}</div>
    <h1>New game night</h1>
    <form id="newForm" data-form="newSession" class="stack">
      <label class="field">Date<input type="date" name="played_on" value="${esc(dr.date)}" required></label>
      <label class="field">Location<input type="text" name="location" value="${esc(dr.loc)}" placeholder="e.g. Marcus's place" maxlength="120"></label>
      <h2>Who's playing? <span id="pickCount">${dr.picks.length ? '· ' + dr.picks.length : ''}</span></h2>
      <div class="list">${active.map((p) => `<label class="pick"><input type="checkbox" name="players" value="${p.id}" ${dr.picks.includes(p.id) ? 'checked' : ''}>${avatar(p)}<span class="main">${esc(p.name)}${p.nickname ? ` <span class="small">“${esc(p.nickname)}”</span>` : ''}</span></label>`).join('') || '<div class="small">No players yet — add some below.</div>'}</div>
      <div class="inline-add"><input type="text" id="quickPlayer" placeholder="Add a new player" maxlength="60" aria-label="New player name"><button type="button" class="btn ghost sm" data-act="quickAddPlayer">Add</button></div>
    </form>
  </div>
  <div class="actions"><div class="inner"><button class="btn blue" type="submit" form="newForm">Start game night</button></div></div>${nav('games')}`;
}
function saveNewDraft() {
  const f = document.getElementById('newForm'); if (!f) return;
  S.newDraft = { date: f.played_on.value, loc: f.location.value, picks: [...f.querySelectorAll('input[name=players]:checked')].map((i) => i.value) };
  const c = document.getElementById('pickCount'); if (c) c.textContent = S.newDraft.picks.length ? '· ' + S.newDraft.picks.length : '';
}
document.addEventListener('change', (e) => { if (e.target.closest && e.target.closest('#newForm')) saveNewDraft(); });
document.addEventListener('input', (e) => { if (e.target.closest && e.target.closest('#newForm') && e.target.id !== 'quickPlayer') saveNewDraft(); });

/* ---------- Live / finished session ---------- */
function viewSession(sid) {
  const d = sessionData(sid);
  if (!d) return `<div class="page">${backLink('#/')}<div class="empty">Game night not found.</div></div>${nav('games')}`;
  const s = d.s, live = s.status === 'live', banker = isBanker();
  const head = `<div class="top">${backLink('#/')}${live ? `<span class="pill"><span class="dot"></span>Live${S.presence > 1 ? ` · ${S.presence} watching` : ''}</span>` : '<span class="pill ended">Finished</span>'}</div>
    <div><h1>${esc(fmtDate(s.played_on))}</h1><div class="sub">${s.location ? esc(s.location) + ' · ' : ''}${live ? 'started ' + fmtTime(s.started_at) : fmtTime(s.started_at) + ' – ' + (s.ended_at ? fmtTime(s.ended_at) + ` (${duration(s.started_at, s.ended_at)})` : '')}</div></div>
    <div class="tiles"><div class="tile dark"><div class="k">Total in</div><div class="v">${money(d.totalIn)}</div></div><div class="tile"><div class="k">Players</div><div class="v">${d.rows.length}</div></div><div class="tile"><div class="k">Buy-ins</div><div class="v">${d.bis.length}</div></div></div>`;
  if (live) {
    const rows = d.rows.map((x) => {
      const last = x.bis[x.bis.length - 1];
      const meta = x.bis.length ? `${plural(x.bis.length, 'buy-in')} · ${x.bis.length > 1 ? 'last ' : ''}${fmtTime(last.bought_at)}` : 'No buy-in yet';
      return `<div class="row">${avatar(x.p)}<button class="name-btn" data-act="go" data-href="#/s/${sid}/p/${x.p.id}" aria-label="${esc(x.p.name)}: see buy-ins"><span class="name">${esc(x.p.name)}</span><span class="meta">${meta}</span></button><span class="amt">${money(x.inC)}</span>${banker ? `<button class="plus" data-act="buyIn" data-sid="${sid}" data-pid="${x.p.id}" aria-label="Add buy-in for ${esc(x.p.name)}">${ic.plus}</button>` : ''}</div>`;
    }).join('');
    return `<div class="page${banker ? ' has-actions' : ''}">${head}
      ${s.notes ? `<div class="card notes">${esc(s.notes)}</div>` : ''}
      <h2>${banker ? 'Tap + to add a buy-in · tap a name for history' : 'Tap a name to see their buy-ins'}</h2>
      <div class="list">${rows || '<div class="empty">No players yet.</div>'}${banker ? `<button class="dashed" data-act="addToSession" data-sid="${sid}">+ Add player to tonight</button>` : ''}</div>
      ${timelineBlock(d)}
    </div>
    ${banker ? `<div class="actions"><div class="inner"><button class="btn ghost" style="width:56px;padding:0" data-act="notes" data-sid="${sid}" aria-label="Session notes">${ic.note}</button><a class="btn" href="#/s/${sid}/cashout">End game · Cash out</a></div></div>` : ''}${nav('games')}`;
  }
  return `<div class="page">${head}${resultsBlock(d)}
    ${s.notes ? `<h2>Notes</h2><div class="card notes">${esc(s.notes)}</div>` : ''}
    ${timelineBlock(d)}
    <div class="stack">
      <div class="hstack"><button class="btn ghost sm" style="flex:1" data-act="exportSession" data-sid="${sid}">Export CSV</button><button class="btn blue sm" style="flex:1" data-act="share" data-sid="${sid}">Share to WhatsApp</button></div>
      ${banker ? `<div class="hstack"><a class="btn ghost sm" style="flex:1" href="#/s/${sid}/cashout">Edit cash-outs</a><button class="btn ghost sm" style="flex:1" data-act="notes" data-sid="${sid}">Edit notes</button></div>
      <div class="hstack"><button class="btn ghost sm" style="flex:1" data-act="reopen" data-sid="${sid}">Reopen game</button><button class="btn danger sm" style="flex:1" data-act="deleteSession" data-sid="${sid}">Delete night</button></div>` : ''}
    </div>
  </div>${nav('games')}`;
}

function checkBlock(d) {
  if (!d.allOut) return `<div class="warn">${ic.warn}<div>Not everyone has a cash-out amount yet.</div></div>`;
  if (d.balanced) return `<div class="ok">${ic.check} Balanced · ${money(d.totalIn)} in · ${money(d.totalOut)} out</div>`;
  const diff = d.totalIn - d.totalOut;
  return `<div class="warn">${ic.warn}<div><b>${money(Math.abs(diff))} ${diff > 0 ? 'missing' : 'extra'}.</b> Buy-ins total ${money(d.totalIn)}, but cash-outs total ${money(d.totalOut)}. Please recount.</div></div>`;
}

function resultsBlock(d) {
  const rows = [...d.rows].sort((a, b) => (b.netC ?? -1e12) - (a.netC ?? -1e12));
  const table = `<div class="table">${rows.map((x) => `<div class="tr"><span class="n">${esc(x.p.name)}</span><span class="io">${money(x.inC)} → ${x.outC == null ? '?' : money(x.outC)}</span><span class="net ${x.netC == null ? '' : netClass(x.netC)}">${x.netC == null ? '–' : money(x.netC, true)}</span></div>`).join('')}</div>`;
  const aw = awards(d.s.id);
  const awardsHtml = aw.length ? `<h2>Awards</h2><div class="awards">${aw.map((a) => `<div class="award${a.top ? ' top' : ''}"><span class="t">${esc(a.t)}</span><span class="w">${esc(a.w)}</span><span class="y">${esc(a.y)}</span></div>`).join('')}</div>` : '';
  let settleHtml = '';
  if (d.balanced) {
    const tr = settle(d.rows);
    const paidOf = (t) => S.pays.find((x) => x.session_id === d.s.id && x.from_player_id === t.from && x.to_player_id === t.to && cents(x.amount) === t.c && x.paid);
    const paidCount = tr.filter(paidOf).length;
    settleHtml = `<div class="hstack"><h2 class="spacer">Settle up · ${plural(tr.length, 'transfer')}</h2>${tr.length ? `<span class="small" style="color:var(--accent-ink);font-weight:600">${paidCount} of ${tr.length} paid</span>` : ''}</div>
      <div class="list">${tr.map((t) => { const paid = !!paidOf(t); return `<div class="pay${paid ? ' paid' : ''}"><span class="who"><b>${esc(player(t.from).name)}</b> pays <b>${esc(player(t.to).name)}</b></span><span class="amt">${money(t.c)}</span><button class="tick" aria-pressed="${paid}" aria-label="Mark ${esc(player(t.from).name)} to ${esc(player(t.to).name)} as ${paid ? 'not paid' : 'paid'}" ${isBanker() ? `data-act="tick" data-sid="${d.s.id}" data-from="${t.from}" data-to="${t.to}" data-c="${t.c}" data-paid="${paid}"` : 'disabled'}>${paid ? ic.check : ''}</button></div>`; }).join('') || '<div class="small">Everyone broke even — nothing to settle.</div>'}</div>`;
  } else {
    settleHtml = `<h2>Settle up</h2><div class="small">Settle-up appears once the cash-outs match the buy-ins.</div>`;
  }
  return `<h2>Results</h2>${checkBlock(d)}${table}${settleHtml}${awardsHtml}`;
}

function timelineBlock(d) {
  if (!d.bis.length) return '';
  const firsts = new Set(d.rows.map((x) => x.bis[0] && x.bis[0].id));
  const items = d.bis.map((b) => `<div class="tl"><span class="tm">${fmtTime(b.bought_at)}</span><span class="rail"><i></i><span></span></span><span class="what"><b>${esc(player(b.player_id).name)}</b> <span class="m">${firsts.has(b.id) ? 'buy-in' : 're-buy'}</span></span><span class="a">${money(cents(b.amount))}</span></div>`);
  if (d.s.status === 'ended' && d.s.ended_at) items.push(`<div class="tl"><span class="tm">${fmtTime(d.s.ended_at)}</span><span class="rail"><i class="end"></i><span></span></span><span class="what"><b>Game ended</b> <span class="m">· cash-outs ${money(d.totalOut)}</span></span><span class="a"></span></div>`);
  const bh = busiestHour(d);
  return `<h2>Timeline${bh ? ` · busiest ${bh}` : ''}</h2><div class="card timeline">${items.join('')}</div>`;
}

/* ---------- One player's buy-ins tonight ---------- */
function viewPlayerTonight(sid, pid) {
  const d = sessionData(sid);
  if (!d) return viewGames();
  const x = d.rows.find((r) => r.p.id === pid);
  if (!x) return `<div class="page">${backLink('#/s/' + sid)}<div class="empty">Player not in this game.</div></div>${nav('games')}`;
  const banker = isBanker() && d.s.status === 'live';
  const editable = isBanker();
  const items = x.bis.map((b, i) => `<div class="row"><div style="width:78px"><div style="font-weight:700;font-size:17px">${fmtTime(b.bought_at)}</div><div class="meta">${i === 0 ? 'First buy-in' : 'Re-buy'}</div></div><div class="main"><div class="amt">${money(cents(b.amount))}</div><div class="meta">Entered by ${esc(enteredBy(b.created_by))}</div></div>${editable ? `<button class="icon-btn" data-act="editBuyIn" data-id="${b.id}" aria-label="Edit this buy-in">${ic.edit}</button><button class="icon-btn" data-act="deleteBuyIn" data-id="${b.id}" aria-label="Delete this buy-in">${ic.trash}</button>` : ''}</div>`).join('');
  return `<div class="page${banker ? ' has-actions' : ''}">
    <div class="top">${backLink('#/s/' + sid)}</div>
    <div class="hstack" style="gap:12px">${avatar(x.p, true)}<div><h1 style="font-size:24px">${esc(x.p.name)}</h1><div class="sub">${esc(fmtDate(d.s.played_on))} · ${money(x.inC)} in · ${plural(x.bis.length, 'buy-in')}${x.outC != null ? ` · out ${money(x.outC)}` : ''}</div></div></div>
    <h2>Buy-ins, by time</h2>
    <div class="list">${items || '<div class="empty">No buy-ins yet.</div>'}</div>
    ${editable && d.s.status === 'live' && x.bis.length === 0 ? `<button class="btn ghost sm" data-act="removeFromSession" data-sid="${sid}" data-pid="${pid}">Remove ${esc(x.p.name)} from tonight</button>` : ''}
  </div>
  ${banker ? `<div class="actions"><div class="inner"><button class="btn blue" data-act="buyIn" data-sid="${sid}" data-pid="${pid}">${ic.plus} Add buy-in for ${esc(x.p.name)}</button></div></div>` : ''}${nav('games')}`;
}

/* ---------- Cash-out ---------- */
function viewCashOut(sid) {
  const d = sessionData(sid);
  if (!d) return viewGames();
  if (!isBanker()) { location.hash = '#/s/' + sid; return ''; }
  const draft = S.cashDraft[sid] || (S.cashDraft[sid] = {});
  d.rows.forEach((x) => { if (draft[x.p.id] === undefined) draft[x.p.id] = x.outC == null ? '' : String(x.outC / 100); });
  return `<div class="page has-actions">
    <div class="top">${backLink('#/s/' + sid)}</div>
    <div><h1>Cash out</h1><div class="sub">Count each player's chips and enter the cash value.</div></div>
    <div id="cashCheck">${cashCheck(sid)}</div>
    <div class="list">${d.rows.map((x) => `<div class="row"><div class="main"><label for="co-${x.p.id}" class="name" style="display:block">${esc(x.p.name)}</label><div class="meta">Bought in ${money(x.inC)}</div></div><div class="money-in"><span>$</span><input id="co-${x.p.id}" inputmode="decimal" autocomplete="off" data-cash="${sid}" data-pid="${x.p.id}" value="${esc(draft[x.p.id])}" placeholder="0"></div></div>`).join('')}</div>
  </div>
  <div class="actions"><div class="inner"><button class="btn" data-act="saveCashOut" data-sid="${sid}">${d.s.status === 'live' ? 'Save & finish game' : 'Save changes'}</button></div></div>${nav('games')}`;
}
function cashCheck(sid) {
  const d = sessionData(sid); const draft = S.cashDraft[sid] || {};
  let out = 0, missing = 0;
  d.rows.forEach((x) => { const v = draft[x.p.id]; if (v === '' || v == null) missing++; else out += cents(v); });
  if (missing) return `<div class="warn">${ic.warn}<div>${plural(missing, 'player')} still to enter. So far ${money(out)} of ${money(d.totalIn)}.</div></div>`;
  if (out === d.totalIn) return `<div class="ok">${ic.check} Balanced · ${money(out)} out of ${money(d.totalIn)}</div>`;
  const diff = d.totalIn - out;
  return `<div class="warn">${ic.warn}<div><b>${money(Math.abs(diff))} ${diff > 0 ? 'missing' : 'extra'}.</b> Buy-ins total ${money(d.totalIn)}, but cash-outs total ${money(out)}. Please recount.</div></div>`;
}
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset && el.dataset.cash) {
    el.value = el.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    (S.cashDraft[el.dataset.cash] ||= {})[el.dataset.pid] = el.value;
    const box = document.getElementById('cashCheck'); if (box) box.innerHTML = cashCheck(el.dataset.cash);
  }
});

/* ---------- Leaderboard ---------- */
function trendSvg(series, label) {
  if (series.length < 2) return '';
  const W = 320, H = 80, pad = 6;
  const vals = [0, ...series.map((e) => e.cum)];
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const x = (i) => (i / (vals.length - 1)) * W, y = (v) => pad + (1 - (v - min) / span) * (H - pad * 2);
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(label)}"><line x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}" stroke="currentColor" stroke-opacity=".25" stroke-dasharray="3 4" vector-effect="non-scaling-stroke"/><polyline fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" points="${pts}" vector-effect="non-scaling-stroke"/></svg>`;
}
function statCard(m, title) {
  const rate = m.games ? Math.round((m.wins / m.games) * 100) : 0;
  return `<div class="card dark stack" style="gap:8px">
    <div class="hstack" style="align-items:flex-start"><div class="spacer"><div class="small">${esc(title)}</div><div style="font-size:30px;font-weight:700" class="">${money(m.netC, true)}</div></div>
    <div class="small" style="text-align:right;line-height:1.5">${plural(m.games, 'game')} · ${rate}% wins<br>Best ${m.best ? money(m.best.c, true) : '–'} · Worst ${m.worst ? money(m.worst.c, true) : '–'}${m.streak >= 2 ? `<br>${m.streak} wins in a row` : ''}</div></div>
    <div style="color:var(--on-solid)">${trendSvg(m.series, `Running total for ${m.p.name} over ${m.games} games`)}</div></div>`;
}
function viewLeaderboard() {
  const list = stats(S.period);
  const year = new Date().getFullYear();
  return `<div class="page">
    <div class="top"><h1>Leaderboard</h1><div class="seg" role="group" aria-label="Period"><button data-act="period" data-v="all" aria-pressed="${S.period === 'all'}">All time</button><button data-act="period" data-v="year" aria-pressed="${S.period === 'year'}">${year}</button></div></div>
    ${list[0] ? statCard(list[0], `${list[0].p.name} · ${S.period === 'all' ? 'all-time leader' : year + ' leader'}`) : ''}
    <div class="list">${list.map((m, i) => `<a class="row link" href="#/player/${m.p.id}"><span class="rank">${i + 1}</span>${avatar(m.p)}<div class="main"><div class="name">${esc(m.p.name)}</div><div class="meta">${plural(m.games, 'game')} · ${Math.round((m.wins / m.games) * 100)}% wins</div></div><span class="amt ${netClass(m.netC)}">${money(m.netC, true)}</span></a>`).join('') || '<div class="empty">Results appear here after the first finished game night.</div>'}</div>
  </div>${nav('lb')}`;
}

/* ---------- Players ---------- */
function viewPlayers() {
  const all = stats('all');
  const list = [...S.players].sort((a, b) => (a.active === b.active ? a.name.localeCompare(b.name) : a.active ? -1 : 1));
  return `<div class="page">
    <div class="top"><h1>Players</h1>${isBanker() ? `<button class="btn blue sm" data-act="editPlayer">${ic.plus} Add</button>` : ''}</div>
    <div class="list">${list.map((p) => { const m = all.find((x) => x.p.id === p.id); return `<a class="row link" href="#/player/${p.id}" ${p.active ? '' : 'style="opacity:.6"'}>${avatar(p)}<div class="main"><div class="name">${esc(p.name)}${p.nickname ? ` <span class="small">“${esc(p.nickname)}”</span>` : ''}</div><div class="meta">${m ? plural(m.games, 'game') : 'No games yet'}${p.active ? '' : ' · inactive'}</div></div>${m ? `<span class="amt ${netClass(m.netC)}">${money(m.netC, true)}</span>` : ''}</a>`; }).join('') || '<div class="empty">No players yet.</div>'}</div>
  </div>${nav('players')}`;
}
function viewPlayer(pid) {
  const p = IDX.players.get(pid);
  if (!p) return viewPlayers();
  const m = stats('all').find((x) => x.p.id === pid);
  const games = m ? [...m.series].reverse() : [];
  return `<div class="page">
    <div class="top">${backLink('#/players')}${isBanker() ? `<button class="btn ghost sm" data-act="editPlayer" data-id="${pid}">${ic.edit} Edit</button>` : ''}</div>
    <div class="hstack" style="gap:12px">${avatar(p, true)}<div><h1>${esc(p.name)}</h1>${p.nickname ? `<div class="sub">“${esc(p.nickname)}”</div>` : ''}</div></div>
    ${m ? statCard(m, 'All-time') : '<div class="empty">No finished games yet.</div>'}
    ${games.length ? `<h2>Game nights</h2><div class="list">${games.map((g) => `<a class="row link" href="#/s/${g.s.id}"><div class="main"><div class="name">${esc(fmtDate(g.s.played_on, true))}</div><div class="meta">${esc(g.s.location || '')}</div></div><span class="amt ${netClass(g.c)}">${money(g.c, true)}</span></a>`).join('')}</div>` : ''}
  </div>${nav('players')}`;
}

/* ---------- Me / settings ---------- */
function viewMore() {
  if (!S.user) {
    return `<div class="page"><h1>Banker sign in</h1><p class="sub">Only bankers need to sign in. Everyone else can just watch.</p>
      <form data-form="signIn" class="stack"><label class="field">Email<input type="email" name="email" autocomplete="username" required></label><label class="field">Password<input type="password" name="password" autocomplete="current-password" required></label><button class="btn blue block" type="submit">Sign in</button></form>
      <h2>Backup</h2><div class="hstack"><button class="btn ghost sm" style="flex:1" data-act="exportAll">Export all results</button><button class="btn ghost sm" style="flex:1" data-act="exportBuyIns">Export all buy-ins</button></div>
    </div>${nav('more')}`;
  }
  const roleText = S.role === 'owner' ? 'Owner' : S.role === 'banker' ? 'Banker' : 'Signed in (not a banker yet)';
  let bankers = '';
  if (isOwner()) {
    if (S.bankers === null) { loadBankers(); bankers = '<div class="small">Loading bankers…</div>'; }
    else bankers = `<div class="list">${S.bankers.map((b) => `<div class="row"><div class="main"><div class="name">${esc(b.display_name)}</div><div class="meta">${esc(b.email)} · ${b.role}</div></div>${b.role === 'banker' ? `<button class="icon-btn" data-act="removeBanker" data-id="${b.user_id}" data-name="${esc(b.display_name)}" aria-label="Remove ${esc(b.display_name)} as banker">${ic.trash}</button>` : ''}</div>`).join('')}</div>
      <form data-form="addBanker" class="card stack"><b>Add a banker</b><span class="small">First create their login in Supabase → Authentication → Users → Add user (tick “Auto Confirm User”). Then enter the same email here.</span><label class="field">Their email<input type="email" name="email" required></label><label class="field">Name to show<input type="text" name="name" maxlength="60" required></label><button class="btn blue sm" type="submit">Add banker</button></form>`;
  }
  return `<div class="page">
    <h1>Me</h1>
    <div class="card stack"><div><b>${esc(S.user.email)}</b><div class="small">${roleText}</div></div>
      ${!S.hasOwner ? '<button class="btn blue sm" data-act="claimOwner">Become owner</button>' : ''}
      <div class="hstack"><button class="btn ghost sm" style="flex:1" data-act="changePw">Change password</button><button class="btn ghost sm" style="flex:1" data-act="signOut">Sign out</button></div></div>
    ${isOwner() ? `<h2>Group</h2><form data-form="groupName" class="inline-add"><input type="text" name="name" value="${esc(S.group.name)}" maxlength="80" aria-label="Group name"><button class="btn ghost sm" type="submit">Save</button></form><h2>Bankers</h2>${bankers}` : ''}
    <h2>Backup</h2><div class="small">Tap now and then to keep a copy of everything on your phone.</div>
    <div class="hstack"><button class="btn ghost sm" style="flex:1" data-act="exportAll">Export all results</button><button class="btn ghost sm" style="flex:1" data-act="exportBuyIns">Export all buy-ins</button></div>
  </div>${nav('more')}`;
}
async function loadBankers() {
  try { S.bankers = await DB.rpc('banker_emails', { gid: S.group.id }) || []; } catch (e) { S.bankers = []; toast(e.message, { err: true }); }
  render();
}

/* ================= Buy-in sheet ================= */
function openBuyIn(sid, pid, buyIn) {
  const d = sessionData(sid);
  const x = d.rows.find((r) => r.p.id === pid);
  const lastAmt = buyIn ? cents(buyIn.amount) : (x && x.bis.length ? cents(x.bis[x.bis.length - 1].amount) : (d.bis.length ? cents(d.bis[d.bis.length - 1].amount) : 5000));
  S.bi = { sid, pid, id: buyIn ? buyIn.id : null, digits: String(lastAmt / 100), fresh: true, time: buyIn ? toLocalInput(buyIn.bought_at) : null, editTime: false };
  renderBuyIn(true);
}
function renderBuyIn(first) {
  const b = S.bi; if (!b) return;
  const d = sessionData(b.sid); const x = d.rows.find((r) => r.p.id === b.pid); const p = player(b.pid);
  const amtC = cents(b.digits || 0);
  const nowTxt = b.time ? new Date(b.time).toLocaleString('en-SG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : `now (${fmtTime(new Date())})`;
  openModal(`
    <div class="hstack" style="gap:12px">${avatar(p)}<div class="spacer"><div class="small">${b.id ? 'Edit buy-in for' : 'Buy-in for'}</div><h3>${esc(p.name)}</h3></div><div class="small" style="text-align:right">So far<br><b style="color:var(--ink);font-size:16px">${money(x ? x.inC : 0)} · ${x ? x.bis.length : 0}×</b></div></div>
    <div class="big-amt${b.fresh ? ' fresh' : ''}" aria-live="polite">$${esc(b.digits || '0')}</div>
    <div class="quick">${QUICK.map((q) => `<button type="button" data-act="biQuick" data-v="${q}" aria-pressed="${!b.fresh && Number(b.digits) === q}">$${q}</button>`).join('')}</div>
    <div class="keys">${['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((k) => `<button type="button" data-act="biKey" data-k="${k}" aria-label="${k === '⌫' ? 'Delete' : k}">${k}</button>`).join('')}</div>
    ${b.editTime ? `<label class="field">Time<input type="datetime-local" id="biTime" value="${esc(b.time || toLocalInput(new Date()))}"></label>` : `<button type="button" class="timebtn" data-act="biTime"><span class="hstack">${ic.clock} Time: ${esc(nowTxt)}</span><b>Change</b></button>`}
    <div class="hstack"><button type="button" class="btn ghost" data-act="close">Cancel</button><button type="button" class="btn blue" style="flex:1" data-act="biSave" ${amtC > 0 ? '' : 'disabled'}>${b.id ? 'Save' : `Add ${money(amtC)} buy-in`}</button></div>`, !first);
}

/* ================= Actions ================= */
const ACT = {
  retry() { S.loading = true; render(); reload(); },
  go(ds) { location.hash = ds.href; },
  close() { closeModal(); },
  closeBackdrop(ds, el, e) { if (e.target === el) closeModal(); },
  period(ds) { S.period = ds.v; render(); },
  buyIn(ds) { openBuyIn(ds.sid, ds.pid); },
  biQuick(ds) { S.bi.digits = String(ds.v); S.bi.fresh = false; renderBuyIn(); },
  biKey(ds) {
    const b = S.bi; let v = b.fresh ? '' : b.digits; const k = ds.k;
    if (k === '⌫') v = b.fresh ? '' : v.slice(0, -1);
    else if (k === '.') { if (!v.includes('.')) v = (v || '0') + '.'; }
    else {
      const [i, f] = v.split('.');
      if (f !== undefined) { if (f.length < 2) v += k; }
      else if ((i || '').length < 6) v = (v === '0' ? '' : v) + k;
    }
    b.digits = v; b.fresh = false; renderBuyIn();
  },
  biTime() { S.bi.editTime = true; S.bi.time = S.bi.time || toLocalInput(new Date()); renderBuyIn(); },
  async biSave() {
    const b = S.bi; if (!b) return;
    const t = document.getElementById('biTime'); if (t && t.value) b.time = t.value;
    const amount = cents(b.digits) / 100;
    if (!(amount > 0)) return;
    const when = b.time ? new Date(b.time).toISOString() : new Date().toISOString();
    closeModal();
    if (b.id) { await run(() => DB.update('buy_ins', { id: b.id }, { amount, bought_at: when }), 'Buy-in updated'); return; }
    const pname = player(b.pid).name;
    const rows = await run(() => DB.insert('buy_ins', { session_id: b.sid, player_id: b.pid, group_id: S.group.id, amount, bought_at: when }));
    if (rows && rows[0]) {
      const id = rows[0].id;
      toast(`Added ${money(cents(amount))} for ${pname} · ${fmtTime(when)}`, { action: 'Undo', onAction: () => run(() => DB.remove('buy_ins', { id }), 'Buy-in removed') });
    }
  },
  editBuyIn(ds) { const bi = S.buyIns.find((x) => x.id === ds.id); if (bi) openBuyIn(bi.session_id, bi.player_id, bi); },
  async deleteBuyIn(ds) {
    const bi = S.buyIns.find((x) => x.id === ds.id); if (!bi) return;
    if (!confirm(`Delete this ${money(cents(bi.amount))} buy-in at ${fmtTime(bi.bought_at)}?`)) return;
    const copy = { session_id: bi.session_id, player_id: bi.player_id, group_id: bi.group_id, amount: bi.amount, bought_at: bi.bought_at };
    const ok = await run(() => DB.remove('buy_ins', { id: bi.id }));
    if (ok) toast('Buy-in deleted', { action: 'Undo', onAction: () => run(() => DB.insert('buy_ins', copy), 'Restored') });
  },
  addToSession(ds) {
    const inIt = new Set((IDX.spBy.get(ds.sid) || []).map((r) => r.player_id));
    const others = S.players.filter((p) => p.active && !inIt.has(p.id)).sort((a, b) => a.name.localeCompare(b.name));
    openModal(`<h3>Add player to tonight</h3>
      <div class="list">${others.map((p) => `<button class="row link" style="text-align:left" data-act="joinSession" data-sid="${ds.sid}" data-pid="${p.id}">${avatar(p)}<span class="main name">${esc(p.name)}</span></button>`).join('') || '<div class="small">Everyone is already playing.</div>'}</div>
      <form data-form="newPlayerJoin" data-sid="${ds.sid}" class="inline-add"><input type="text" name="name" placeholder="New player name" maxlength="60" aria-label="New player name" required><button class="btn blue sm" type="submit">Add</button></form>
      <button class="btn ghost" data-act="close">Close</button>`);
  },
  async joinSession(ds) { closeModal(); await run(() => DB.insert('session_players', { session_id: ds.sid, player_id: ds.pid, group_id: S.group.id }), `${player(ds.pid).name} added`); openBuyIn(ds.sid, ds.pid); },
  async removeFromSession(ds) {
    if (!confirm(`Remove ${player(ds.pid).name} from tonight?`)) return;
    await run(() => DB.remove('session_players', { session_id: ds.sid, player_id: ds.pid }), 'Removed');
    location.hash = '#/s/' + ds.sid;
  },
  notes(ds) {
    const s = S.sessions.find((x) => x.id === ds.sid);
    openModal(`<h3>Notes</h3><form data-form="notes" data-sid="${ds.sid}" class="stack"><textarea name="notes" maxlength="4000" placeholder="e.g. Marcus's birthday. Blinds up at 11 pm." aria-label="Notes" autofocus>${esc(s.notes || '')}</textarea><div class="hstack"><button type="button" class="btn ghost" data-act="close">Cancel</button><button class="btn blue" style="flex:1" type="submit">Save notes</button></div></form>`);
  },
  async saveCashOut(ds) {
    const sid = ds.sid; const d = sessionData(sid); const draft = S.cashDraft[sid] || {};
    const empty = d.rows.filter((x) => draft[x.p.id] === '' || draft[x.p.id] == null);
    if (empty.length) { toast(`Enter an amount for ${empty.map((x) => x.p.name).join(', ')} (0 if they lost it all).`, { err: true, ms: 5000 }); return; }
    const out = d.rows.reduce((a, x) => a + cents(draft[x.p.id]), 0);
    if (out !== d.totalIn && !confirm(`Totals don't match (${money(d.totalIn)} in, ${money(out)} out). Save anyway? Settle-up will wait until it's fixed.`)) return;
    const live = d.s.status === 'live';
    const ok = await run(async () => {
      const now = new Date().toISOString();
      for (const x of d.rows) {
        const v = cents(draft[x.p.id]) / 100;
        if (x.outC !== cents(v)) await DB.update('session_players', { session_id: sid, player_id: x.p.id }, { cash_out: v, cashed_out_at: now });
      }
      if (live) await DB.update('sessions', { id: sid }, { status: 'ended', ended_at: now });
      return true;
    }, live ? 'Game finished' : 'Saved');
    if (ok) { delete S.cashDraft[sid]; location.hash = '#/s/' + sid; }
  },
  async tick(ds) {
    const paid = ds.paid !== 'true';
    await run(() => DB.upsert('settle_payments', { session_id: ds.sid, from_player_id: ds.from, to_player_id: ds.to, group_id: S.group.id, amount: Number(ds.c) / 100, paid, paid_at: paid ? new Date().toISOString() : null }, 'session_id,from_player_id,to_player_id'));
  },
  async reopen(ds) { if (confirm('Reopen this game night so you can add more buy-ins?')) await run(() => DB.update('sessions', { id: ds.sid }, { status: 'live', ended_at: null }), 'Game reopened'); },
  async deleteSession(ds) {
    if (!confirm('Delete this whole game night, with all its buy-ins and results? This cannot be undone.')) return;
    const ok = await run(() => DB.remove('sessions', { id: ds.sid }), 'Game night deleted');
    if (ok) location.hash = '#/';
  },
  async quickAddPlayer() {
    const el = document.getElementById('quickPlayer'); const name = el.value.trim(); if (!name) return;
    saveNewDraft();
    el.value = '';
    const rows = await run(() => DB.insert('players', { group_id: S.group.id, name }), `${name} added`);
    if (rows && rows[0] && S.newDraft) { S.newDraft.picks.push(rows[0].id); render(); }
  },
  editPlayer(ds) {
    const p = ds.id ? IDX.players.get(ds.id) : { name: '', nickname: '', active: true, photo_url: null };
    S.photoDraft = undefined;
    openModal(`<h3>${ds.id ? 'Edit player' : 'Add player'}</h3><form data-form="player" data-id="${ds.id || ''}" class="stack">
      <div class="hstack" style="gap:12px"><span id="photoPrev">${avatar(p, true)}</span><label class="btn ghost sm" style="cursor:pointer">Choose photo<input type="file" accept="image/*" id="photoIn" class="sr"></label>${p.photo_url ? '<button type="button" class="linkish" data-act="clearPhoto">Remove photo</button>' : ''}</div>
      <label class="field">Name<input type="text" name="name" value="${esc(p.name)}" maxlength="60" required ${ds.id ? '' : 'autofocus'}></label>
      <label class="field">Nickname (optional)<input type="text" name="nickname" value="${esc(p.nickname || '')}" maxlength="40"></label>
      ${ds.id ? `<label class="pick"><input type="checkbox" name="active" ${p.active ? 'checked' : ''}><span class="main">Active (shows when starting a game)</span></label>` : ''}
      <div class="hstack"><button type="button" class="btn ghost" data-act="close">Cancel</button><button class="btn blue" style="flex:1" type="submit">Save</button></div></form>`);
    document.getElementById('photoIn').addEventListener('change', onPhoto);
  },
  clearPhoto() { S.photoDraft = null; document.getElementById('photoPrev').innerHTML = '<span class="av lg">–</span>'; },
  async claimOwner() {
    const name = prompt('Your name (shown to the group):', '');
    if (name === null) return;
    await run(() => DB.rpc('claim_ownership', { gid: S.group.id, my_name: name }), 'You are now the owner');
    S.bankers = null;
  },
  async removeBanker(ds) {
    if (!confirm(`Remove ${ds.name} as a banker? Their login stays, but they can no longer edit.`)) return;
    await run(() => DB.rpc('remove_banker', { gid: S.group.id, banker_user: ds.id }), 'Banker removed');
    S.bankers = null; render();
  },
  async signOut() { await DB.signOut(); S.user = null; S.role = null; S.bankers = null; await reload(); toast('Signed out'); },
  async changePw() {
    const pw = prompt('New password (at least 8 characters):');
    if (!pw) return;
    if (pw.length < 8) { toast('Password too short.', { err: true }); return; }
    try { await DB.changePassword(pw); toast('Password changed'); } catch (e) { toast(e.message, { err: true }); }
  },
  exportSession(ds) { exportSession(ds.sid); },
  exportAll() { exportAll(); },
  exportBuyIns() { exportBuyIns(); },
  share(ds) { shareSession(ds.sid); }
};

const FORM = {
  async newSession(fd) {
    const ids = fd.getAll('players');
    if (ids.length < 2) { toast('Pick at least 2 players.', { err: true }); return; }
    const rows = await run(async () => {
      const s = await DB.insert('sessions', { group_id: S.group.id, played_on: fd.get('played_on') || todayISO(), location: (fd.get('location') || '').trim() || null });
      await DB.insert('session_players', ids.map((pid) => ({ session_id: s[0].id, player_id: pid, group_id: S.group.id })));
      return s;
    }, 'Game night started');
    if (rows) { S.newDraft = null; location.hash = '#/s/' + rows[0].id; }
  },
  async newPlayerJoin(fd, f) {
    const name = String(fd.get('name') || '').trim(); if (!name) return;
    const sid = f.dataset.sid; closeModal();
    const rows = await run(() => DB.insert('players', { group_id: S.group.id, name }));
    if (rows) { await run(() => DB.insert('session_players', { session_id: sid, player_id: rows[0].id, group_id: S.group.id }), `${name} added`); openBuyIn(sid, rows[0].id); }
  },
  async notes(fd, f) { const sid = f.dataset.sid; closeModal(); await run(() => DB.update('sessions', { id: sid }, { notes: String(fd.get('notes') || '').trim() || null }), 'Notes saved'); },
  async player(fd, f) {
    const id = f.dataset.id;
    const row = { name: String(fd.get('name') || '').trim(), nickname: String(fd.get('nickname') || '').trim() || null };
    if (!row.name) return;
    if (id) row.active = fd.get('active') === 'on';
    if (S.photoDraft !== undefined) row.photo_url = S.photoDraft;
    closeModal();
    if (id) await run(() => DB.update('players', { id }, row), 'Player saved');
    else await run(() => DB.insert('players', { ...row, group_id: S.group.id }), 'Player added');
  },
  async signIn(fd) {
    try { await DB.signIn(String(fd.get('email')).trim(), String(fd.get('password'))); }
    catch (e) { toast(e.message, { err: true }); return; }
    S.bankers = null; await reload();
    toast(isBanker() ? `Signed in as ${S.role}` : 'Signed in — ask the owner to make you a banker');
  },
  async addBanker(fd) {
    await run(() => DB.rpc('add_banker', { gid: S.group.id, banker_email: String(fd.get('email')).trim(), banker_name: String(fd.get('name')).trim() }), 'Banker added');
    S.bankers = null; render();
  },
  async groupName(fd) { const name = String(fd.get('name') || '').trim(); if (name) await run(() => DB.update('groups', { id: S.group.id }, { name }), 'Saved'); }
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = ACT[el.dataset.act];
  if (!fn) return;
  if (el.dataset.act !== 'closeBackdrop') e.preventDefault();
  fn(el.dataset, el, e);
});
document.addEventListener('submit', (e) => {
  const f = e.target.closest('form[data-form]');
  if (!f) return;
  e.preventDefault();
  const fn = FORM[f.dataset.form];
  if (fn) fn(new FormData(f), f);
});

/* ================= Photo (shrunk on the phone, stored small) ================= */
function onPhoto(e) {
  const file = e.target.files && e.target.files[0]; if (!file) return;
  const img = new Image();
  img.onload = () => {
    const size = 160, c = document.createElement('canvas'); c.width = c.height = size;
    const s = Math.min(img.width, img.height);
    c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
    S.photoDraft = c.toDataURL('image/jpeg', 0.8);
    document.getElementById('photoPrev').innerHTML = `<span class="av lg"><img src="${S.photoDraft}" alt=""></span>`;
    URL.revokeObjectURL(img.src);
  };
  img.onerror = () => toast('Could not read that photo.', { err: true });
  img.src = URL.createObjectURL(file);
}

/* ================= Export & share ================= */
function csvCell(v) {
  let s = String(v ?? '');
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) || s.startsWith("'") ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function download(name, rows) {
  const text = '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
const num = (c) => (c / 100).toFixed(2);
function exportSession(sid) {
  const d = sessionData(sid);
  const rows = [['Date', 'Location', 'Player', 'Buy-ins', 'Total in (SGD)', 'Cash out (SGD)', 'Net (SGD)']];
  d.rows.forEach((x) => rows.push([d.s.played_on, d.s.location || '', x.p.name, x.bis.length, num(x.inC), x.outC == null ? '' : num(x.outC), x.netC == null ? '' : num(x.netC)]));
  rows.push([]); rows.push(['Buy-in time', 'Player', 'Amount (SGD)', 'Entered by']);
  d.bis.forEach((b) => rows.push([new Date(b.bought_at).toLocaleString('en-SG'), player(b.player_id).name, num(cents(b.amount)), enteredBy(b.created_by)]));
  if (d.balanced) { rows.push([]); rows.push(['From', 'To', 'Amount (SGD)']); settle(d.rows).forEach((t) => rows.push([player(t.from).name, player(t.to).name, num(t.c)])); }
  download(`poker-${d.s.played_on}.csv`, rows);
}
function exportAll() {
  const rows = [['Date', 'Location', 'Status', 'Player', 'Buy-ins', 'Total in (SGD)', 'Cash out (SGD)', 'Net (SGD)']];
  [...S.sessions].sort((a, b) => a.played_on.localeCompare(b.played_on)).forEach((s) => sessionData(s.id).rows.forEach((x) => rows.push([s.played_on, s.location || '', s.status, x.p.name, x.bis.length, num(x.inC), x.outC == null ? '' : num(x.outC), x.netC == null ? '' : num(x.netC)])));
  download(`poker-all-results-${todayISO()}.csv`, rows);
}
function exportBuyIns() {
  const ses = new Map(S.sessions.map((s) => [s.id, s]));
  const rows = [['Date', 'Location', 'Buy-in time', 'Player', 'Amount (SGD)', 'Entered by']];
  [...S.buyIns].sort(byTime).forEach((b) => { const s = ses.get(b.session_id) || {}; rows.push([s.played_on || '', s.location || '', new Date(b.bought_at).toLocaleString('en-SG'), player(b.player_id).name, num(cents(b.amount)), enteredBy(b.created_by)]); });
  download(`poker-all-buyins-${todayISO()}.csv`, rows);
}
function shareSession(sid) {
  const d = sessionData(sid);
  const lines = [`🃏 Poker · ${fmtDate(d.s.played_on)}${d.s.location ? ' · ' + d.s.location : ''}`, ''];
  [...d.rows].sort((a, b) => (b.netC ?? 0) - (a.netC ?? 0)).forEach((x) => lines.push(`${x.p.name}: ${x.netC == null ? '?' : money(x.netC, true)}`));
  if (d.balanced) { const tr = settle(d.rows); if (tr.length) { lines.push('', 'Settle up:'); tr.forEach((t) => lines.push(`${player(t.from).name} → ${player(t.to).name}: ${money(t.c)}`)); } }
  const aw = awards(sid); if (aw.length) { lines.push(''); aw.forEach((a) => lines.push(`🏆 ${a.t}: ${a.w} (${a.y})`)); }
  const text = lines.join('\n');
  if (navigator.share) navigator.share({ text }).catch(() => {});
  else window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
}

/* ================= Live viewers ================= */
function syncPresence() {
  const { p } = route();
  const sid = p[0] === 's' && p[1] && !p[2] ? p[1] : null;
  const s = sid && S.sessions.find((x) => x.id === sid && x.status === 'live');
  const want = s ? sid : null;
  if (want === S.presenceFor) return;
  if (S.stopPresence) { S.stopPresence(); S.stopPresence = null; }
  S.presenceFor = want; S.presence = 0;
  if (want && DB.presence) S.stopPresence = DB.presence(want, (n) => { if (n !== S.presence) { S.presence = n; if (S.presenceFor === want) render(); } });
}

/* ================= Start ================= */
DB.onAuth && DB.onAuth(() => softReload());
DB.subscribe && DB.subscribe(softReload);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') softReload(); });
reload();
})();
