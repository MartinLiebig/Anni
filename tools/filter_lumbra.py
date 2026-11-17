#!/usr/bin/env python3
"""Pass 1: stream a huge PGN once and keep only candidate team-league games.
   python3 -I tools/filter_lumbra.py <in.pgn> <out.pgn> [min_year]
Keeps: Date year >= min_year (default 2010), both WhiteElo/BlackElo, standard chess (no FEN/Variant), a result,
Event name looks like a team league, and Event does not look like women/youth/rapid/blitz/online/schools.
Also writes <out.pgn>.events.tsv (count, first/last year, mean rating gap, mean max rating per Event)."""
import re, sys, time, collections

inp, out = sys.argv[1], sys.argv[2]
MIN_YEAR = int(sys.argv[3]) if len(sys.argv) > 3 else 2010
TAG = re.compile(rb'\[(\w+) "(.*)"\]')
LEAGUE = re.compile(rb'bundesliga|schachbund|\bliga\b|\bliga|league|ligue|\bteam|ch-?t\b|\btch\b|extraliga|ekstraliga|superliga|super liga|division|divisi|serie a|top ?1[26]|interclub|nationalliga|elitserien|allsvenskan|meesterklasse|oberliga|verbandsliga|landesliga|\bsmm\b|4ncl|club cup|mannschaft|squadre|ekip|dru\xc5\xbcyn|mistrzostwa polski|satran\xc3\xa7|staatsliga|landesliga|\bnb ?i\b', re.I)
EXCLUDE = re.compile(rb'women|woman|frauen|damen|girls|ladies|female|feminin|junior|youth|jugend|\bu ?\d\d\b|\bu\d\d|schools?\b|kids|rapid|blitz|bullet|online|internet|senior|veteran|amateur|simul|congress|open\b|zonal|olympiad|world team|european team|euro club|campionato regionale', re.I)

def accept(h):
    d = h.get(b'Date', b'')
    if not (d[:4].isdigit() and int(d[:4]) >= MIN_YEAR): return None
    try:
        we, be = int(h[b'WhiteElo']), int(h[b'BlackElo'])
    except Exception: return None
    if we <= 0 or be <= 0 or b'FEN' in h or h.get(b'Variant', b'Standard') not in (b'Standard', b''): return None
    if h.get(b'Result') not in (b'1-0', b'0-1', b'1/2-1/2'): return None
    ev = h.get(b'Event', b'')
    if not LEAGUE.search(ev) or EXCLUDE.search(ev): return None
    return int(d[:4]), we, be

stats = collections.defaultdict(lambda: [0, 9999, 0, 0, 0])  # n, first, last, sum gap, sum max
total = kept = 0; t0 = time.time()
with open(inp, 'rb') as f, open(out, 'wb') as o:
    hdr = {}; buf = []; in_header = False; keep = False; info = None
    def flush():
        global kept
        if keep and buf:
            o.write(b''.join(buf)); o.write(b'\n'); kept += 1
            s = stats[hdr.get(b'Event', b'?')]; y, we, be = info
            s[0] += 1; s[1] = min(s[1], y); s[2] = max(s[2], y); s[3] += abs(we - be); s[4] += max(we, be)
    for line in f:
        if line.startswith(b'[Event '):
            flush(); total += 1
            hdr = {}; buf = [line]; in_header = True; keep = False; info = None
            m = TAG.match(line)
            if m: hdr[m.group(1)] = m.group(2)
            if total % 1000000 == 0:
                print(f'{total/1e6:.0f}M games scanned, {kept:,} kept, {time.time()-t0:.0f}s', file=sys.stderr, flush=True)
            continue
        if in_header:
            if line.startswith(b'['):
                m = TAG.match(line)
                if m: hdr[m.group(1)] = m.group(2)
                buf.append(line)
                continue
            in_header = False
            info = accept(hdr); keep = info is not None
            if keep: buf.append(line)
            continue
        if keep: buf.append(line)
    flush()
with open(out + '.events.tsv', 'w', encoding='utf-8') as e:
    e.write('count\tfirst\tlast\tavg_gap\tavg_max_elo\tevent\n')
    for ev, (n, a, b, g, mx) in sorted(stats.items(), key=lambda x: -x[1][0]):
        e.write(f'{n}\t{a}\t{b}\t{g//n}\t{mx//n}\t{ev.decode("utf-8", "replace")}\n')
print(f'done: {total:,} games scanned, {kept:,} kept in {len(stats):,} events, {time.time()-t0:.0f}s', file=sys.stderr)
