#!/usr/bin/env python3
"""Build content.json from public-domain texts and the hand-picked excerpts.

    python3 curation/build_content.py            # writes content.json at the repo root
    python3 curation/build_content.py --check    # verify every pick, write nothing

Each excerpt is copied character for character from the Project Gutenberg
text (via the GITenberg mirror on GitHub). The only changes are layout:
line breaks inside a paragraph become spaces (or ' / ' for verse), and the
underscores and braces Gutenberg uses to mark italics and superscripts are dropped. If a pick's start or
end words can't be found exactly, the build stops instead of guessing.
Standard library only.
"""
import argparse, datetime, hashlib, json, os, re, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CACHE = os.path.join(HERE, '.cache')
RAW = 'https://raw.githubusercontent.com/GITenberg/{repo}/master/{file}'
GANJOOR = 'https://raw.githubusercontent.com/ganjoor/ganjoor-data/{sha}/poets/{poem}.json'


def fetch(book, repo, file=None):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, f'{book}.txt')
    if not os.path.exists(path):
        for name in ([file] if file else [f'{book}.txt', f'{book}-0.txt', f'{book}-8.txt']):
            try:
                with urllib.request.urlopen(RAW.format(repo=repo, file=name), timeout=60) as r:
                    data = r.read()
                break
            except Exception:
                data = None
        if data is None:
            sys.exit(f'could not download {repo}')
        with open(path, 'wb') as f:
            f.write(data)
    raw = open(path, 'rb').read()
    try:
        text = raw.decode('utf-8')
    except UnicodeDecodeError:
        text = raw.decode('latin-1')   # older Gutenberg files ("-8.txt") are ISO-8859-1
    return text.replace('\r\n', '\n')


def ganjoor_poem(sha, poem):
    """A poem from Ganjoor's public data export, pinned to one commit."""
    os.makedirs(os.path.join(CACHE, 'ganjoor'), exist_ok=True)
    path = os.path.join(CACHE, 'ganjoor', f"{sha[:12]}__{poem.replace('/', '__')}.json")
    if not os.path.exists(path):
        try:
            with urllib.request.urlopen(GANJOOR.format(sha=sha, poem=poem), timeout=60) as r:
                data = r.read()
        except Exception:
            sys.exit(f'could not download Ganjoor poem {poem}')
        with open(path, 'wb') as f:
            f.write(data)
    return json.load(open(path, encoding='utf-8'))


def ganjoor_excerpt(doc, first, last):
    """Couplets (or prose paragraphs) first..last, in order. Hemistichs and couplets are
    separated by ' / ', exactly as verse is everywhere else; the words are untouched."""
    vs = sorted((v for v in doc.get('Verses') or [] if first <= v['CoupletIndex'] <= last), key=lambda v: v['VOrder'])
    if not vs or {v['CoupletIndex'] for v in vs} != set(range(first, last + 1)):
        raise ValueError(f"couplets {first}-{last} not found in {doc.get('FullUrl')}")
    return ' / '.join(v['Text'].strip() for v in vs)


def paragraphs(text):
    s = re.search(r'\*\*\* ?START OF (THE|THIS) PROJECT GUTENBERG[^\n]*\n', text)
    e = re.search(r'\*\*\* ?END OF (THE|THIS) PROJECT GUTENBERG', text)
    body = text[s.end() if s else 0: e.start() if e else len(text)]
    return [[l.strip() for l in p.split('\n') if l.strip()] for p in re.split(r'\n\s*\n', body)]


def joined(lines, verse=False):
    if verse:
        # A verse line that starts in lowercase is Gutenberg's wrap of the line before it.
        t = lines[0] if lines else ''
        for l in lines[1:]:
            t += (' ' if l[:1].islower() else ' / ') + l
    else:
        t = ' '.join(lines)
    t = t.replace('_', '')
    t = re.sub(r'\{(\w+)\}', r'\1', t)   # superscript markup: 1{ly} -> 1ly
    return re.sub(r' {2,}', ' ', t)


def excerpt(paras, pick):
    text = joined(paras[pick['para']], pick.get('verse', False))
    if 'start' not in pick:
        return text
    a = text.find(pick['start'])
    if a < 0:
        raise ValueError(f"start not found: {pick['start']!r}\n  in: {text[:300]}")
    b = text.find(pick['end'], a)
    if b < 0:
        raise ValueError(f"end not found after start: {pick['end']!r}\n  in: {text[a:a + 400]}")
    return text[a:b + len(pick['end'])]


def source_record(book, meta, locator):
    rec = {k: meta[k] for k in ('title', 'author', 'translator', 'editor', 'year', 'form') if k in meta}
    rec['edition'] = f'Project Gutenberg #{book}'
    rec['url'] = f'https://www.gutenberg.org/ebooks/{book}'
    rec['locator'] = locator
    rec['license'] = 'Public domain in the USA (published before 1929)'
    return rec


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--out', default=os.path.join(ROOT, 'content.json'))
    args = ap.parse_args()

    sources = {k: v for k, v in json.load(open(os.path.join(HERE, 'sources.json'))).items() if not k.startswith('_')}
    picks = json.load(open(os.path.join(HERE, 'picks.json')))
    books = {b: paragraphs(fetch(b, m['repo'], m.get('file'))) for b, m in sources.items()}

    try:
        prev = {e['id']: e for e in json.load(open(args.out))['entries']}
    except Exception:
        prev = {}
    today = datetime.date.today().isoformat()
    entries, errors = [], []

    def add(kind, pick, content, locator):
        eid = hashlib.sha1(f"{pick['book']}|{content}".encode()).hexdigest()[:10]
        entries.append({
            'id': eid,
            'content': content,
            'type': kind,
            'language': sources[pick['book']].get('language', 'en'),
            'theme': pick['theme'],
            'source': source_record(pick['book'], sources[pick['book']], locator),
            'collected_at': prev.get(eid, {}).get('collected_at', today),
            'permission_status': 'public-domain',
            'origin': 'curated',
            'status': 'approved',
        })

    for kind, key in (('passage', 'passages'), ('sentence', 'sentences')):
        for p in picks[key]:
            try:
                add(kind, p, excerpt(books[p['book']], p), f"paragraph {p['para']}")
            except Exception as e:
                errors.append(f"{kind} {p['book']}:{p['para']}: {e}")
    gmeta = json.load(open(os.path.join(HERE, 'sources.json'))).get('_ganjoor', {})
    for p in picks.get('ganjoor', []):
        poet = gmeta['poets'][p['poem'].split('/')[0]]
        try:
            doc = ganjoor_poem(gmeta['sha'], p['poem'])
            first, last = p['couplets']
            content = ganjoor_excerpt(doc, first, last)
        except Exception as e:
            errors.append(f"ganjoor {p['poem']}: {e}"); continue
        eid = hashlib.sha1(f"ganjoor:{p['poem']}|{content}".encode()).hexdigest()[:10]
        prose = any(v.get('Position') == 'Paragraph' for v in doc['Verses'] if first <= v['CoupletIndex'] <= last)
        unit = 'paragraph' if prose else 'couplet'
        locator = f"{unit} {first + 1}" if first == last else f"{unit}s {first + 1}-{last + 1}"
        entries.append({
            'id': eid,
            'content': content,
            'type': p['type'],
            'language': 'fa',
            'theme': p['theme'],
            'source': {
                'title': doc['FullTitle'], 'author': poet['author'], 'died': poet['died'], 'form': 'prose' if prose else 'poem',
                'edition': f"Ganjoor (ganjoor-data@{gmeta['sha'][:7]})", 'url': 'https://ganjoor.net' + doc['FullUrl'],
                'locator': locator, 'license': 'Public domain (classical Persian, written centuries ago); transcription from Ganjoor',
            },
            'collected_at': prev.get(eid, {}).get('collected_at', today),
            'permission_status': 'public-domain',
            'origin': 'curated',
            'status': 'approved',
        })

    for p in picks['words']:
        paras = books[p['book']]
        hit = next((i for i, ls in enumerate(paras)
                    if re.search(r'(?<![\w-])' + re.escape(p['word']) + r'(?![\w-])', joined(ls))), None)
        if hit is None:
            errors.append(f"word {p['word']!r} not found in {p['book']}")
        else:
            add('word', p, p['word'], f'paragraph {hit}')

    if errors:
        print('\n'.join(errors), file=sys.stderr)
        sys.exit(1)
    counts = {k: sum(1 for e in entries if e['type'] == k) for k in ('word', 'sentence', 'passage')}
    print(f'{len(entries)} entries ok', counts)
    if args.check:
        return
    doc = {
        'schema': 2,
        'updated_at': today,
        'note': 'Curated public-domain writing. Wording is exactly as in the cited edition; attribution is kept here even though the artwork does not display it.',
        'entries': entries,
    }
    with open(args.out, 'w', encoding='utf-8') as f:
        f.write('{\n')
        for k in ('schema', 'updated_at', 'note'):
            f.write(f'  {json.dumps(k)}: {json.dumps(doc[k], ensure_ascii=False)},\n')
        f.write('  "entries": [\n')
        f.write(',\n'.join('    ' + json.dumps(e, ensure_ascii=False) for e in entries))
        f.write('\n  ]\n}\n')
    print('wrote', args.out)


if __name__ == '__main__':
    main()
