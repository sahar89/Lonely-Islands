# The Space Between Us

An interactive, generative pixel-art world of floating islands about friendship, separation, migration, belonging, and how hard it is to stay close to one another. Each island is drawn in white and electric blue `#2200FF` with ordered dithering, and each has a single inhabitant going about their day. Between the islands, real human writing drifts through the empty space like slow water: mostly whole sentences and passages (a single word only rarely) from public-domain letters, diaries, fiction and poetry. The writing parts around the islands, follows them when they're dragged, and never touches them.

## Interact
- **Drag empty space** to explore the infinite canvas.
- **Drag an island** to move it. Islands never overlap. The writing parts around it as it moves and closes again behind it.
- **Scroll or pinch** to zoom around the cursor.

## Repository
| Path | What it is |
| --- | --- |
| `index.html` | The whole artwork: HTML, CSS and Canvas 2D JavaScript, with no build step. |
| `content.json` | The writing the currents carry, with full source attribution. |
| `curation/sources.json` | The public-domain books the collection draws from. |
| `curation/picks.json` | The hand-picked excerpts: book, paragraph, and exact first and last words. |
| `curation/build_content.py` | Rebuilds `content.json` from the original texts (Python 3, standard library only). |
| `.github/workflows/pages.yml` | Publishes `index.html` and `content.json` to GitHub Pages on every push to `main`. |

## The writing
The collection holds 30 words, 46 sentences and 59 passages from 19 books first published before 1929, all in the public domain in the United States. The authors are Willa Cather, James Joyce, Edith Wharton, Virginia Woolf, Katherine Mansfield, Anton Chekhov (tr. Constance Garnett), Joseph Conrad, Jane Austen, Charlotte Brontë, Henry David Thoreau, John Keats (letters), Walt Whitman, Emily Dickinson and Rabindranath Tagore.

Excerpts were chosen for ordinary, specific moments rather than declared feelings: a father who no longer plays his violin in the new country, a grandmother who thinks she is home in Norway, a letter that can't be written, a friend who lives in the same city and is never seen.

- **Exact wording.** The build copies each excerpt character for character from the Project Gutenberg text (via the GITenberg mirror on GitHub) and stops if a start or end phrase can't be found. The only changes are layout: line breaks inside a paragraph become spaces, line breaks in verse become ` / `, and Gutenberg's markup for italics and superscripts is dropped.
- **Attribution.** Every entry records its author, title, translator or editor where there is one, year, Gutenberg edition, URL and paragraph. The artwork does not display it.
- **Rights.** The texts are public domain in the US. Some translations and editions may still be protected elsewhere, so check local law before reusing them outside the US.

### Adding or changing excerpts
1. If the book is new, add it to `curation/sources.json` with its Gutenberg number and GITenberg repository name.
2. Add an entry to `curation/picks.json` with the book, the paragraph number, a theme, and the exact `start` and `end` words. Use `"verse": true` for poetry.
3. Run `python3 curation/build_content.py`. Use `--check` to verify without writing. Downloaded texts are cached in `curation/.cache/`.

## `content.json`
```json
{
  "id": "7e5c542d15",
  "content": "We immigrants never speak any language well.",
  "type": "sentence",
  "language": "en",
  "theme": "migration",
  "source": {
    "title": "The Song of the Lark", "author": "Willa Cather", "year": 1915, "form": "novel",
    "edition": "Project Gutenberg #44", "url": "https://www.gutenberg.org/ebooks/44",
    "locator": "paragraph 1178", "license": "Public domain in the USA (published before 1929)"
  },
  "collected_at": "2026-10-28",
  "permission_status": "public-domain",
  "origin": "curated",
  "status": "approved"
}
```
- `type`: `word`, `sentence` or `passage`.
- `theme`: `friendship`, `separation`, `migration`, `belonging` or `connection`.
- `permission_status`: only `public-domain`, `licensed` or `granted` entries can appear.
- `origin`: `curated` for this collection, `visitor` for future visitor writing.
- `status`: `approved`, `pending` or `rejected`. Only `approved` entries appear.

**Visitor writing (not built yet).** A submission would be stored as `"origin": "visitor"`, `"status": "pending"`, `"permission_status": "pending"`. After moderation, and once the writer has granted permission (`"granted"`), it joins the same currents with no change to the artwork. Nothing collects submissions today.

## How the artwork uses it
- **Rotation.** The collection turns over slowly. Each piece rises and falls on its own tide, with a cycle of about 23 minutes that shifts from day to day, and a piece that has just flowed past rests for about nine minutes. Frequency plays no part. The page reloads `content.json` every three hours and falls back to the last copy the browser saw.
- **Mix.** About half of what flows is passages and half sentences. Single words are rare. A piece already flowing isn't picked again until the collection runs out, and copies of the same piece are kept far apart.
- **Lanes.** The water is a stack of parallel lanes, all flowing left to right and undulating together, so lanes never cross, fold back or circle. Each lane carries pieces end to end in reading order, so text never overlaps.
- **Sentences** run as one line, or two for long ones. **Passages** form ribbons of up to four lines.
- **Around the islands.** Each island parts the water: lines passing near it bend smoothly over or under it and follow it as it's dragged, without ever crossing each other. Writing that runs straight into an island slips beneath it and comes out on the other side. Letters fade out near an island's edge and are never drawn on or against an island or its inhabitant.
- **Nothing pops in.** New pieces enter and leave only well outside the view. The whole water fades in once, with the islands, when the page opens.
- **Type.** IBM Plex Mono 400 at 12px (at the default zoom), `rgba(34, 0, 255, 0.5)` on `#FFFFFF`.

## Deploy
Every push to `main` deploys to GitHub Pages (**Settings → Pages → Source: GitHub Actions**).

**Embedding in Framer.** Add an **Embed** component, choose **URL**, and paste the Pages address (for example `https://sahar89.github.io/Lonely-Islands/`). The artwork fills whatever frame it's given and has no UI of its own. Scroll and drag inside the embed control the canvas, so leave some page area outside it for scrolling.

## Run locally
Serve the folder over HTTP so `content.json` can load (for example `python3 -m http.server`), then open it in a modern desktop browser.
