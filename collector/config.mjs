// What the collector looks for, per language and theme.
// Queries go to Bluesky's public search; the same terms filter the live
// stream fallback. Edit freely: the collector reads this file on every run.

// Languages the collector runs. The other term lists below stay ready for later.
export const ACTIVE_LANGUAGES = ['en'];

export const THEMES = {
  en: {
    friendship:   ['friendship', 'my friends', 'best friend', 'old friend', 'close friends'],
    loneliness:   ['lonely', 'loneliness', 'feel alone', 'feeling alone', 'so alone'],
    belonging:    ['belonging', 'where i belong', 'feel at home', 'feel like i belong'],
    migration:    ['immigrant', 'moved abroad', 'emigrated', 'new country', 'left my country'],
    homesickness: ['homesick', 'homesickness', 'miss home', 'missing home'],
    connection:   ['human connection', 'feel connected', 'meaningful connection', 'deep connection'],
    losingTouch:  ['lost touch', 'drifted apart', 'grew apart'],
    reconnecting: ['reconnected', 'reconnect with', 'caught up with an old'],
    community:    ['my community', 'sense of community', 'found community', 'find community'],
  },
  es: {
    friendship:   ['amistad', 'mis amigos', 'mejor amiga', 'mejor amigo'],
    loneliness:   ['soledad', 'me siento solo', 'me siento sola'],
    belonging:    ['pertenencia', 'sentirme en casa'],
    migration:    ['inmigrante', 'emigrar', 'emigré'],
    homesickness: ['extraño mi casa', 'extraño mi país', 'nostalgia'],
    connection:   ['conexión humana'],
    losingTouch:  ['perdimos contacto', 'nos alejamos'],
    reconnecting: ['reencuentro', 'reencontrarnos'],
    community:    ['comunidad'],
  },
  pt: {
    friendship:   ['amizade', 'meus amigos', 'melhor amiga', 'melhor amigo'],
    loneliness:   ['solidão', 'me sinto sozinho', 'me sinto sozinha'],
    belonging:    ['pertencimento', 'me sentir em casa'],
    migration:    ['imigrante', 'emigrar', 'morar fora'],
    homesickness: ['saudade de casa', 'saudades de casa'],
    connection:   ['conexão humana'],
    losingTouch:  ['perdemos contato', 'nos afastamos'],
    reconnecting: ['reencontro', 'reencontrar'],
    community:    ['comunidade'],
  },
  fr: {
    friendship:   ['amitié', 'mes amis', 'meilleure amie', 'meilleur ami'],
    loneliness:   ['solitude', 'me sens seul', 'me sens seule'],
    belonging:    ['appartenance', 'me sentir chez moi'],
    migration:    ['immigré', 'immigrée', 'expatrié'],
    homesickness: ['mal du pays'],
    connection:   ['lien humain', 'liens humains'],
    losingTouch:  ['perdu de vue', 'éloignés'],
    reconnecting: ['retrouvailles', 'se retrouver'],
    community:    ['communauté'],
  },
  de: {
    friendship:   ['Freundschaft', 'meine Freunde', 'beste Freundin'],
    loneliness:   ['Einsamkeit', 'einsam'],
    belonging:    ['Zugehörigkeit', 'dazugehören'],
    migration:    ['Einwanderer', 'ausgewandert', 'Auswanderung'],
    homesickness: ['Heimweh'],
    connection:   ['menschliche Verbindung', 'Verbundenheit'],
    losingTouch:  ['aus den Augen verloren'],
    reconnecting: ['wiedergesehen', 'Wiedersehen'],
    community:    ['Gemeinschaft'],
  },
  ja: {
    friendship:   ['友情', '友達'],
    loneliness:   ['孤独', '寂しい'],
    belonging:    ['居場所'],
    migration:    ['移住', '移民'],
    homesickness: ['ホームシック', '故郷が恋しい'],
    connection:   ['つながり', '人とのつながり'],
    losingTouch:  ['疎遠'],
    reconnecting: ['再会'],
    community:    ['コミュニティ'],
  },
};

// Posts carrying these labels are skipped entirely.
export const SKIP_LABELS = new Set(['porn', 'sexual', 'nudity', 'graphic-media', 'gore', 'spam', '!hide', '!warn', 'intolerant', 'rude']);

// Commercial or spammy posts are skipped.
export const SPAM_PATTERNS = [
  /follow\s*back/i, /giveaway/i, /promo\s*code/i, /discount/i, /\bcrypto\b/i, /\bnft\b/i,
  /onlyfans/i, /\bdm\s*me\b/i, /link in bio/i, /subscribe/i, /\bairdrop\b/i, /\bsale\b/i,
];

// Never shown, in any language: self-harm and violence vocabulary.
export const SENSITIVE = new Set([
  'suicide', 'suicidal', 'kms', 'kys', 'unalive', 'overdose', 'selfharm', 'self-harm', 'kill', 'killing', 'murder', 'rape',
  'suicidio', 'suicida', 'suicídio', 'selbstmord', 'suizid', '自殺', '死にたい',
]);

// Everyday filler that carries no feeling on its own; never kept as a single word.
export const GENERIC = new Set([
  'posting', 'post', 'posts', 'posted', 'wanna', 'gonna', 'gotta', 'based', 'anti', 'lol', 'lmao', 'omg', 'yeah', 'yes',
  'okay', 'thing', 'things', 'stuff', 'really', 'literally', 'actually', 'basically', 'today', 'tonight', 'week', 'year',
  'years', 'time', 'times', 'day', 'days', 'level', 'read', 'reading', 'thread', 'link', 'video', 'watch', 'twitter',
  'bluesky', 'bsky', 'skeet', 'follow', 'followers', 'account', 'news', 'article', 'via', 'rule', 'federal', 'policy',
]);

export const LIMITS = {
  searchPagesPerQuery: 3,      // 100 posts per page
  searchDelayMs: 1100,         // stay well under public rate limits
  sinceHours: 72,              // only recent posts
  jetstreamMinutes: 12,        // fallback listening window
  maxPostsPerAuthor: 2,        // per run; authors are never stored
  minDistinctAuthors: 2,       // a word must come from at least two people
  minPhraseAuthors: 3,         // a phrase must come from at least three people
  nearDuplicate: 0.4,          // share of a post's word sequences already seen that marks it as a copy
  maxEntries: 1500,            // vocabulary size cap
  forgetAfterDays: 45,         // collected words not seen for this long are removed
  decay: 0.85,                 // frequency carried over from previous runs
};
