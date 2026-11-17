#!/usr/bin/env python3
"""Pass 2: from the pass-1 candidates keep top-division European team-league games and name their databases.
   python3 -I tools/select_leagues.py <candidates.pgn> <existing_games.tsv> <out.pgn> [--dry]
 - event must belong to a known league family (FAMILIES) and have an average top rating >= MIN_AVG_MAX
 - stronger player >= MIN_STRONG; rating gap >= MIN_GAP (except Bundesliga: all games); >= MIN_PLIES plies
 - games already in the database (same moves + result) and duplicates inside the file are dropped
 - writes a [Database "<League> <season>"] tag into every kept game"""
import re, sys, csv, hashlib, collections

cand, existing_tsv, out = sys.argv[1], sys.argv[2], sys.argv[3]
DRY = '--dry' in sys.argv
MIN_AVG_MAX, MIN_STRONG, MIN_GAP, MIN_PLIES = 2350, 2300, 100, 20

FAMILIES = [  # (name, regex on lower-cased event) -- first match wins
 ('Österreich Bundesliga', r'austri|[öo]sterreich|tch-aut|aut_cht|staatsliga'),
 ('Schweiz SMM', r'\bsmm\b|tch-sui|swiss|schweiz'),
 ('Bundesliga', r'(schach-?)?bundesliga'),
 ('Europapokal der Vereine', r'european (chess )?club cup|euro club cup|\becc\b'),
 ('Slowakei Extraliga', r'tch-svk|svk|slovak|eco-c extraliga|sachova extraliga'),
 ('Tschechien Extraliga', r'extraliga|tch-cze \d{4}|cze-cht|czech|[sš]achy\.cz'),
 ('Ungarn NB I', r'tch-hun|hun-cht|hungar'),
 ('Schweden Elitserien', r'elitserien|allsvenskan|tch-swe'),
 ('Frankreich Top 12', r'top ?1[26]|tch-fra'),
 ('Türkei Süper Lig', r's[üu]per lig|super league|turkish league|tch-tur|tur-cht|t[üu]rkiye'),
 ('Portugal Top League', r'portuguese|tch-por'),
 ("Katalonien Div. d'Honor", r'tch-cat'),
 ('England 4NCL', r'4ncl|bcf-cht'),
 ('Finnland SM-Liiga', r'tch-fin'),
 ('Belgien Interclubs', r'tch-bel|belgian'),
 ('Niederlande Meesterklasse', r'meesterklasse|tch-ned|ned-cht|dutch league|dutch team'),
 ('Griechenland Liga', r'greek|tch-gre'),
 ('Kroatien Liga', r'croat|tch-cro'),
 ('Israel Liga', r'tch-isr|israel'),
 ('Serbien Liga', r'serbian|tch-srb|prva liga (centralne )?srbije|srbije'),
 ('Slowenien Liga', r'sloven|tch-slo'),
 ('Rumänien Superliga', r'romania|superliga|tch-rou'),
 ('Polen Ekstraliga', r'ekstraliga|tch-pol|pol-cht|polish'),
 ('Spanien Liga', r'tch-esp|division de honor|divisi[óo]n de honor'),
 ('Russland Liga', r'russian|tch-rus|rus-cht'),
 ('Ukraine Liga', r'ukrain|tch-ukr'),
 ('Dänemark Skakligaen', r'skakligaen|tch-den|danish'),
 ('Norwegen Liga', r'norwegian|tch-nor'),
 ('Bulgarien Liga', r'bulgar|tch-bul'),
 ('Italien Serie A', r'serie a|tch-ita|campionato italiano a squadre'),
]
FAM = [(n, re.compile(r)) for n, r in FAMILIES]
EXC = re.compile(r'2nd|second|zweite|\b2\.|\b1\.? ?liga|\bliga ?1\b|1 liga|\bi liga|ii liga|\bdivision [2-9]|division ii|division d\b|premier b|reserve|preferente|regional|first league|b group|group b|pro league|bcf-cht ?[2-9]|4s |4n |3s |3n |\bu ?\d\d|veteran|school|club championship|\bopen\b|cht rap|rapid|quality|superettan|women|frauen|juniors?|chn|chinese|china|indian|india|iran|usa\b|uzbek|kazakh', re.I)

ev_stats = {r['event']: (int(r['count']), int(r['avg_max_elo'])) for r in csv.DictReader(open(cand + '.events.tsv'), delimiter='\t')}
def family(ev):
    if EXC.search(ev) or ev_stats.get(ev, (0, 0))[1] < MIN_AVG_MAX: return None
    l = ev.lower()
    for name, rx in FAM:
        if rx.search(l): return name
    return None

key = lambda moves, res: hashlib.sha1((moves + '|' + res).encode()).digest()
seen = set()
for line in open(existing_tsv, encoding='utf-8'):
    mv, _, res = line.rstrip('\n').partition('\t'); seen.add(key(mv, res))
print(f'existing games known for duplicate check: {len(seen):,}', file=sys.stderr)

def norm_moves(lines):
    mt = ' '.join(lines)
    mt = re.sub(r'\{[^}]*\}', ' ', mt)
    while re.search(r'\([^()]*\)', mt): mt = re.sub(r'\([^()]*\)', ' ', mt)
    mt = re.sub(r'\$\d+', ' ', mt); mt = re.sub(r'\d+\.(\.\.)?', ' ', mt)
    return [t.rstrip('!?') for t in mt.split() if t not in ('1-0', '0-1', '1/2-1/2', '*')]

TAG = re.compile(r'\[(\w+) "(.*)"\]')
counts = collections.Counter(); fam_games = collections.Counter(); dropped = collections.Counter(); unmatched = collections.Counter()
o = None if DRY else open(out, 'w', encoding='utf-8')

def handle(block):
    h = {}; head = []; body = []; in_h = True
    for ln in block:
        if in_h and ln.startswith('['):
            m = TAG.match(ln); head.append(ln)
            if m: h[m.group(1)] = m.group(2)
        else:
            in_h = False; body.append(ln)
    ev = h.get('Event', '')
    fam = family(ev)
    if not fam:
        if ev_stats.get(ev, (0, 0))[1] >= MIN_AVG_MAX and not EXC.search(ev): unmatched[ev] += 1
        return
    try: we, be = int(h['WhiteElo']), int(h['BlackElo'])
    except Exception: return
    if max(we, be) < MIN_STRONG: dropped['weak'] += 1; return
    if fam != 'Bundesliga' and abs(we - be) < MIN_GAP: dropped['gap'] += 1; return
    moves = norm_moves(body)
    if len(moves) < MIN_PLIES: dropped['short'] += 1; return
    k = key(' '.join(moves), h.get('Result', ''))
    if k in seen: dropped['duplicate'] += 1; return
    seen.add(k)
    y, mo = int(h['Date'][:4]), int(h['Date'][5:7]) if h['Date'][5:7].isdigit() else 8
    season = f'{y}/{(y + 1) % 100:02d}' if mo >= 7 else f'{y - 1}/{y % 100:02d}'
    db = f'{fam} {season}'
    counts[db] += 1; fam_games[fam] += 1
    if o: o.write(''.join(head) + f'[Database "{db}"]\n' + ''.join(body).rstrip('\n') + '\n\n')

block = []
with open(cand, encoding='utf-8', errors='replace') as f:
    for line in f:
        if line.startswith('[Event ') and block: handle(block); block = []
        block.append(line if line.endswith('\n') else line + '\n')
    if block: handle(block)
if o: o.close()
print(f'\nKEPT {sum(counts.values()):,} games in {len(counts)} databases | dropped: ' + ', '.join(f'{k} {v:,}' for k, v in dropped.items()), file=sys.stderr)
print('per league family:', file=sys.stderr)
for fam, n in fam_games.most_common(): print(f'  {n:7,}  {fam}', file=sys.stderr)
print('\nstrong events not matched by any family (top 12):', file=sys.stderr)
for ev, n in unmatched.most_common(12): print(f'  {n:6,}  {ev[:80]}', file=sys.stderr)
