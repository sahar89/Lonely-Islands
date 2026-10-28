# Floating Islands

An interactive, generative pixel-art world of floating islands about loneliness, belonging and how hard it is to reach one another. The islands are drawn in white and electric blue `#2200FF` with ordered dithering, and each has a single inhabitant going about their day. Words that real people used on Bluesky drift through the empty space between the islands like slow water. The currents bend around the islands and never touch them.

## Interact
- **Drag empty space** to explore the infinite canvas.
- **Drag an island** to move it. Islands never overlap. The language current parts around a moving island and closes again behind it.
- **Scroll or pinch** to zoom around the cursor.

## Repository
| Path | What it is |
| --- | --- |
| `index.html` | The whole artwork: HTML, CSS and Canvas 2D JavaScript, with no build step. |
| `words.json` | The current vocabulary, updated by the daily workflow. |
| `collector/` | Node script that gathers the vocabulary from public Bluesky posts. |
| `.github/workflows/collect-words.yml` | Runs the collector daily (and on demand), commits `words.json`, then redeploys. |
| `.github/workflows/pages.yml` | Publishes `index.html` and `words.json` to GitHub Pages. |

## Setup
1. Push this repository to GitHub.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. In **Actions**, open **Collect words** and click **Run workflow**. The site deploys when the run finishes. Until this first run, `words.json` is empty and the currents are simply absent.
4. *(Optional)* Add the repository secrets `BLUESKY_HANDLE` and `BLUESKY_APP_PASSWORD` (an app password, not your main password). Signed-in search is more reliable. Without them, the collector uses Bluesky's unauthenticated public search. If that is refused, it listens to Jetstream, Bluesky's public live post stream, for a few minutes instead.

The workflow runs every day at 09:17 UTC. If Bluesky can't be reached or nothing new passes the filters, `words.json` stays as it was and the site keeps showing the last vocabulary.

## How the vocabulary is collected
- **Sources.** Recent public posts (last 72 hours) matching theme terms in English, Spanish, Portuguese, French, German and Japanese: friendship, loneliness, belonging, migration, homesickness, human connection, losing touch, reconnecting and community. The terms are in `collector/config.mjs`.
- **What's removed.** URLs, @mentions, emails, numbers, emoji and unrelated hashtags; words that look like names (capitalised mid-sentence, or matching an author's handle or display name); stopwords; posts carrying moderation labels; spam patterns; profanity (multilingual lists from `naughty-words`); and self-harm or violence vocabulary.
- **Privacy.** A word or phrase is kept only if **at least two different people** used it in the same run. Posts, post IDs, handles and author IDs are never written anywhere. Each author contributes at most two posts per run.
- **Change over time.** Frequencies decay by 15% per run. Words not seen for 45 days are dropped, and the vocabulary is capped at 1,500 entries.

The collector makes at most a few hundred read requests per run, about one per second, well within Bluesky's public rate limits. Because entries are aggregated and unattributed, nothing in `words.json` can be traced back to a post or a person. Data from deleted posts isn't stored either; the words simply age out.

## `words.json`
```json
{
  "schema": 1,
  "updatedAt": "2026-10-29T09:20:11.000Z",
  "source": "bluesky-search",
  "entries": [
    { "text": "homesick", "kind": "word", "lang": "en", "theme": "homesickness",
      "origin": "bluesky", "status": "approved",
      "firstSeen": "2026-10-29T09:20:11.000Z", "lastSeen": "2026-10-29T09:20:11.000Z", "frequency": 7 }
  ]
}
```
- `kind`: `word` or `phrase` (2–4 words).
- `origin`: `bluesky` for collected words, `visitor` for future visitor contributions.
- `status`: `approved`, `pending` or `rejected`. Only `approved` entries appear in the artwork.
- `frequency`: decayed count of distinct people who used the entry.

**Visitor contributions (future).** Add entries with `"origin": "visitor"` and `"status": "pending"`. Once a moderator sets them to `approved`, they join the same currents. The collector never changes or removes visitor entries.

## How the artwork uses it
- **Loading.** The page loads `words.json` from its own site, never from Bluesky, and checks for a new version every three hours. If the file can't be loaded, it uses the last copy this browser saw. If there is none, the islands appear without words. Loading problems are never shown on screen.
- **Choosing words.** Recently seen words appear more often. New words enter gradually over about two days, and words that keep returning persist longer. Frequency counts for only part of a word's weight, and each theme and language is balanced so none dominates.
- **Motion.** Words are carried in world space by a slowly drifting stream function. Its level lines form long, loose currents, and much of the world is left empty. Near an island the current turns along the shore and speeds up slightly. A moving island pushes water ahead of it and leaves a wake. Words are also checked against where each island is about to be, so even fast drags never pass through them; a word wedged between islands dissolves rather than overlapping.
- **Type.** IBM Plex Mono 400 at 12px (at the default zoom), `rgba(34, 0, 255, 0.5)`.

## Run locally
Serve the folder over HTTP so `words.json` can load (for example `npx serve .` or `python3 -m http.server`), then open it in a modern desktop browser. To collect words by hand: `cd collector && npm ci && npm run collect`.
