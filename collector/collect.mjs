#!/usr/bin/env node
// Floating Islands — vocabulary collector.
//
// Reads recent public Bluesky posts about friendship, loneliness, belonging,
// migration, homesickness, connection and community, keeps individual words
// and short phrases that at least two different people used, and merges them
// into words.json. Posts, post IDs, handles and author IDs are never written.
//
//   node collect.mjs ../words.json
//
// Sources, in order:
//   1. app.bsky.feed.searchPosts on the public AppView (or signed in, if
//      BLUESKY_HANDLE and BLUESKY_APP_PASSWORD are set).
//   2. Jetstream, Bluesky's public live post stream, filtered by the same
//      theme terms, when search is refused.
// If both yield nothing, words.json is left unchanged.

import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const naughty = require('naughty-words');
const stopwordsIso = require('stopwords-iso');
import { THEMES, SKIP_LABELS, SPAM_PATTERNS, SENSITIVE, LIMITS } from './config.mjs';

const OUT = process.argv[2] || '../words.json';
const LANGS = Object.keys(THEMES);
const PUBLIC_APPVIEW = 'https://public.api.bsky.app';
const JETSTREAM = 'wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post';
const UA = 'floating-islands-collector/1.0 (+art project; aggregated vocabulary only)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[collect]', ...a);

/* ------------------------------------------------------------------ lists */
const STOP = Object.fromEntries(LANGS.map((l) => [l, new Set((stopwordsIso[l] || []).map((w) => w.toLocaleLowerCase(l)))]));
const BAD = new Set();
const BAD_PHRASES = [];
for (const [k, list] of Object.entries(naughty)) {
  if (!Array.isArray(list)) continue;
  for (const w of list) {
    const lw = String(w).toLowerCase().trim();
    if (!lw) continue;
    if (/\s/.test(lw)) BAD_PHRASES.push(lw); else BAD.add(lw);
  }
}
const isBad = (lower) => BAD.has(lower) || SENSITIVE.has(lower);
const phraseIsBad = (lower) => lower.split(' ').some(isBad) || BAD_PHRASES.some((p) => lower.includes(p)) || [...SENSITIVE].some((s) => lower.includes(s));

const KEYWORDS = []; // { lang, theme, term, re }
for (const lang of LANGS) for (const [theme, terms] of Object.entries(THEMES[lang])) for (const term of terms) {
  const esc = term.toLocaleLowerCase(lang).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = lang === 'ja' ? new RegExp(esc, 'u') : new RegExp(`(?<![\\p{L}])${esc}(?![\\p{L}])`, 'u');
  KEYWORDS.push({ lang, theme, term, re });
}
const HASHTAG_KEEP = new Set(KEYWORDS.map((k) => k.term.toLowerCase().replace(/\s+/g, '')));

/* ------------------------------------------------------------- utilities */
const URL_RE = /\b(?:https?:\/\/|www\.)\S+|\b\S+\.(?:com|org|net|io|app|social|me|co|ly|gg|tv|be)(?:\/\S*)?/giu;
const MENTION_RE = /@[\p{L}\p{N}._-]+/gu;
const EMAIL_RE = /\S+@\S+\.\S+/g;
const EMOJI_RE = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu;
const LATIN_WORD = /^\p{L}[\p{L}'’-]*\p{L}$/u;
const JA_WORD = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u;
const JA_CONTENT = /[\p{Script=Han}\p{Script=Katakana}]/u;
const baseLang = (l) => String(l || '').toLowerCase().split('-')[0];

function detectTheme(lang, text) {
  const lower = text.toLocaleLowerCase(lang);
  for (const k of KEYWORDS) if (k.lang === lang && k.re.test(lower)) return k.theme;
  return null;
}

function looksLikeSpam(text) {
  const tags = (text.match(/#/g) || []).length;
  if (tags > 3) return true;
  if (SPAM_PATTERNS.some((re) => re.test(text))) return true;
  const stripped = text.replace(URL_RE, '').replace(MENTION_RE, '').trim();
  return stripped.length < 20;
}

/* ------------------------------------------------------------- extraction */
// Returns { words: [{norm, form}], phrases: [{norm, form}] } for one post.
function extract(text, lang, nameParts) {
  let t = text.replace(URL_RE, ' ').replace(EMAIL_RE, ' ').replace(MENTION_RE, ' ');
  t = t.replace(/#([\p{L}\p{N}_]+)/gu, (_, w) => (HASHTAG_KEEP.has(w.toLowerCase()) ? ` ${w} ` : ' '));
  t = t.replace(EMOJI_RE, ' ').replace(/\p{N}+/gu, ' ');
  const seg = new Intl.Segmenter(lang, { granularity: 'word' });
  const toks = []; // null = break
  let sentenceStart = true;
  for (const s of seg.segment(t)) {
    if (!s.isWordLike) {
      if (/[.!?…\n。！？]/u.test(s.segment)) { sentenceStart = true; toks.push(null); }
      else if (/[,;:()"“”«»\[\]{}|/\\—–]/u.test(s.segment)) toks.push(null);
      continue;
    }
    toks.push({ raw: s.segment, start: sentenceStart });
    sentenceStart = false;
  }
  const stop = STOP[lang];
  const ok = []; // per token: { lower, form, content, valid }
  for (const tk of toks) {
    if (!tk) { ok.push(null); continue; }
    const raw = tk.raw.replace(/’/g, "'");
    const lower = raw.toLocaleLowerCase(lang);
    let valid;
    if (lang === 'ja') valid = JA_WORD.test(raw) && raw.length >= 2 && raw.length <= 8 && JA_CONTENT.test(raw);
    else valid = LATIN_WORD.test(raw) && raw.length >= 2 && raw.length <= 18;
    if (valid && isBad(lower)) valid = false;
    if (valid && nameParts.has(lower)) valid = false;
    // A capital letter mid-sentence usually marks a name (not in German, where nouns are capitalised).
    if (valid && lang !== 'de' && lang !== 'ja' && !tk.start && /^\p{Lu}/u.test(raw) && raw !== raw.toUpperCase()) valid = false;
    const isStop = stop.has(lower) || STOP.en.has(lower);
    const form = lang === 'de' ? (raw === raw.toUpperCase() ? raw[0] + raw.slice(1).toLowerCase() : raw) : lower;
    ok.push(valid ? { lower, form, content: !isStop && (lang === 'ja' || raw.length >= 3) } : { invalid: true });
  }
  const words = [], phrases = [];
  for (const o of ok) if (o && !o.invalid && o.content) words.push({ norm: o.lower, form: o.form });
  if (lang !== 'ja') {
    for (let i = 0; i < ok.length; i++) for (let n = 2; n <= 4; n++) {
      const win = ok.slice(i, i + n);
      if (win.length < n || win.some((o) => !o || o.invalid)) break;
      if (!win[0].content || !win[n - 1].content) continue;
      const norm = win.map((o) => o.lower).join(' ');
      if (norm.length > 34 || phraseIsBad(norm)) continue;
      phrases.push({ norm, form: win.map((o) => o.form).join(' ') });
    }
  }
  return { words, phrases };
}

/* ------------------------------------------------------------- aggregation */
const agg = new Map(); // key -> { lang, kind, forms: Map, themes: Map, authors: Set }
const seenTexts = new Set();
const authorPosts = new Map();
const authorIds = new Map(); // in-memory only: did -> small integer
let postsUsed = 0;

function addPost({ did, text, lang, theme, labels = [], nameParts = [] }) {
  if (!text || !LANGS.includes(lang)) return;
  if (labels.some((l) => SKIP_LABELS.has(l))) return;
  if (looksLikeSpam(text)) return;
  const sig = text.toLowerCase().replace(/\s+/g, ' ').trim();
  if (seenTexts.has(sig)) return;
  seenTexts.add(sig);
  const n = authorPosts.get(did) || 0;
  if (n >= LIMITS.maxPostsPerAuthor) return;
  authorPosts.set(did, n + 1);
  if (!authorIds.has(did)) authorIds.set(did, authorIds.size);
  const author = authorIds.get(did);
  theme = theme || detectTheme(lang, text);
  if (!theme) return;
  const names = new Set();
  for (const p of nameParts) for (const w of String(p || '').toLowerCase().split(/[^\p{L}]+/u)) if (w.length > 1) names.add(w);
  const { words, phrases } = extract(text, lang, names);
  postsUsed++;
  const add = (kind, { norm, form }) => {
    const key = `${lang}|${kind}|${norm}`;
    let e = agg.get(key);
    if (!e) agg.set(key, (e = { lang, kind, forms: new Map(), themes: new Map(), authors: new Set() }));
    e.forms.set(form, (e.forms.get(form) || 0) + 1);
    e.themes.set(theme, (e.themes.get(theme) || 0) + 1);
    e.authors.add(author);
  };
  const uniq = (arr) => [...new Map(arr.map((x) => [x.norm, x])).values()];
  for (const w of uniq(words)) add('word', w);
  for (const p of uniq(phrases)) add('phrase', p);
}

/* ------------------------------------------------------------- sources */
async function getJSON(url, headers = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json', ...headers } });
    if (res.status === 429) { await sleep(Number(res.headers.get('retry-after') || 10) * 1000); continue; }
    if (!res.ok) { const err = new Error(`HTTP ${res.status}`); err.status = res.status; throw err; }
    return res.json();
  }
  throw new Error('rate limited');
}

async function session() {
  const id = process.env.BLUESKY_HANDLE, pw = process.env.BLUESKY_APP_PASSWORD;
  if (!id || !pw) return null;
  try {
    const res = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
      body: JSON.stringify({ identifier: id, password: pw }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    log('signed in');
    return { base: 'https://bsky.social', headers: { Authorization: `Bearer ${j.accessJwt}` } };
  } catch (e) { log('sign-in failed, continuing without:', e.message); return null; }
}

async function fromSearch() {
  const auth = await session();
  const base = auth?.base || PUBLIC_APPVIEW, headers = auth?.headers || {};
  const since = new Date(Date.now() - LIMITS.sinceHours * 3600e3).toISOString();
  let ok = 0;
  for (const lang of LANGS) for (const [theme, terms] of Object.entries(THEMES[lang])) for (const term of terms) {
    let cursor;
    for (let page = 0; page < LIMITS.searchPagesPerQuery; page++) {
      const q = new URLSearchParams({ q: lang === 'ja' ? term : `"${term}"`, lang, sort: 'latest', limit: '100', since });
      if (cursor) q.set('cursor', cursor);
      let j;
      try { j = await getJSON(`${base}/xrpc/app.bsky.feed.searchPosts?${q}`, headers); }
      catch (e) {
        if ((e.status === 401 || e.status === 403) && ok === 0) { log(`search refused (${e.message})`); return false; }
        log(`search "${term}" (${lang}) failed: ${e.message}`); break;
      }
      ok++;
      for (const p of j.posts || []) {
        const rec = p.record || {};
        const pl = baseLang(rec.langs?.[0]) || lang;
        addPost({
          did: p.author?.did || p.uri, text: rec.text, lang: pl === lang ? lang : pl, theme: pl === lang ? theme : null,
          labels: [...(p.labels || []), ...(p.author?.labels || [])].map((l) => l.val),
          nameParts: [p.author?.handle?.split('.')[0], p.author?.displayName],
        });
      }
      cursor = j.cursor;
      await sleep(LIMITS.searchDelayMs);
      if (!cursor || !(j.posts || []).length) break;
    }
  }
  return ok > 0;
}

async function fromJetstream() {
  if (typeof WebSocket === 'undefined') { log('no WebSocket support in this Node version'); return false; }
  log(`listening to Jetstream for up to ${LIMITS.jetstreamMinutes} min`);
  const until = Date.now() + LIMITS.jetstreamMinutes * 60e3;
  let matched = 0;
  return new Promise((resolve) => {
    let ws;
    const finish = () => { try { ws?.close(); } catch {} log(`jetstream matched ${matched} posts`); resolve(matched > 0); };
    const timer = setTimeout(finish, Math.max(0, until - Date.now()));
    try { ws = new WebSocket(JETSTREAM); } catch (e) { clearTimeout(timer); log('jetstream failed:', e.message); return resolve(false); }
    ws.onerror = (e) => { log('jetstream error', e?.message || ''); };
    ws.onclose = () => { clearTimeout(timer); finish(); };
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      const c = m.commit;
      if (m.kind !== 'commit' || c?.operation !== 'create' || c.collection !== 'app.bsky.feed.post') return;
      const rec = c.record || {}, lang = baseLang(rec.langs?.[0]);
      if (!LANGS.includes(lang) || !rec.text) return;
      const theme = detectTheme(lang, rec.text);
      if (!theme) return;
      matched++;
      addPost({ did: m.did, text: rec.text, lang, theme, labels: (rec.labels?.values || []).map((l) => l.val) });
      if (matched >= 4000) { clearTimeout(timer); finish(); }
    };
  });
}

/* ------------------------------------------------------------- merge */
const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];

function serialize(doc) {
  const head = { ...doc, entries: undefined };
  const lines = doc.entries.map((e) => '    ' + JSON.stringify(e));
  const headJson = JSON.stringify(head, null, 2).replace(/\n}$/, '');
  return `${headJson},\n  "entries": [\n${lines.join(',\n')}\n  ]\n}\n`;
}

async function main() {
  let doc;
  try { doc = JSON.parse(await readFile(OUT, 'utf8')); } catch { doc = null; }
  if (!doc || !Array.isArray(doc.entries)) doc = { schema: 1, updatedAt: null, entries: [] };

  let source = null;
  if (await fromSearch() && agg.size) source = 'bluesky-search';
  else if (await fromJetstream() && agg.size) source = 'bluesky-jetstream';
  if (!source) { log('no posts collected; words.json left unchanged'); return; }

  const now = new Date().toISOString(), nowMs = Date.now();
  const fresh = new Map();
  for (const [key, e] of agg) {
    if (e.authors.size < LIMITS.minDistinctAuthors) continue;
    fresh.set(key, {
      text: top(e.forms), kind: e.kind, lang: e.lang, theme: top(e.themes),
      count: e.authors.size,
    });
  }
  log(`posts used ${postsUsed}, candidates ${agg.size}, kept ${fresh.size}`);
  if (!fresh.size) { log('nothing passed the filters; words.json left unchanged'); return; }

  const byKey = new Map();
  const keyOf = (e) => `${e.lang}|${e.kind}|${e.text.toLocaleLowerCase(e.lang)}|${e.origin}`;
  for (const e of doc.entries) byKey.set(keyOf(e), e);

  // Age every collected entry, then fold in this run.
  for (const e of byKey.values()) if (e.origin === 'bluesky') e.frequency = Math.round(e.frequency * LIMITS.decay * 100) / 100;
  for (const f of fresh.values()) {
    const k = keyOf({ ...f, origin: 'bluesky' });
    const e = byKey.get(k);
    if (e) { e.frequency = Math.round((e.frequency + f.count) * 100) / 100; e.lastSeen = now; e.theme = f.theme; e.text = f.text; }
    else byKey.set(k, {
      text: f.text, kind: f.kind, lang: f.lang, theme: f.theme,
      origin: 'bluesky', status: 'approved',
      firstSeen: now, lastSeen: now, frequency: f.count,
    });
  }

  // Forget collected words not seen for a while; keep visitor entries as they are.
  const forget = LIMITS.forgetAfterDays * 864e5;
  let entries = [...byKey.values()].filter((e) => e.origin !== 'bluesky' || nowMs - Date.parse(e.lastSeen) < forget);
  const score = (e) => Math.log1p(e.frequency) * Math.exp(-(nowMs - Date.parse(e.lastSeen)) / (14 * 864e5)) + (nowMs - Date.parse(e.firstSeen) < 3 * 864e5 ? 0.5 : 0);
  const collected = entries.filter((e) => e.origin === 'bluesky').sort((a, b) => score(b) - score(a)).slice(0, LIMITS.maxEntries);
  entries = [...collected, ...entries.filter((e) => e.origin !== 'bluesky')];
  entries.sort((a, b) => a.lang.localeCompare(b.lang) || a.kind.localeCompare(b.kind) || a.text.localeCompare(b.text, a.lang));

  doc = {
    schema: 1,
    updatedAt: now,
    source,
    note: 'Aggregated vocabulary from public Bluesky posts. Each entry was used by at least two different people. No posts, handles or author IDs are stored.',
    entries,
  };
  await writeFile(OUT, serialize(doc));
  const counts = {};
  for (const e of entries) counts[e.lang] = (counts[e.lang] || 0) + 1;
  log(`wrote ${entries.length} entries`, counts);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e); process.exitCode = 1; });
}

export { extract, addPost, agg, main }; // for tests
