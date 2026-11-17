#!/usr/bin/env python3
"""Stream a (possibly huge) PGN file and report what it contains: which tags exist, which team-league events,
rating gaps, years. Nothing is imported. Usage: python3 -I tools/inspect_pgn.py <file.pgn> [--events 40]"""
import re, sys, collections

path = sys.argv[1]
top = int(sys.argv[sys.argv.index('--events') + 1]) if '--events' in sys.argv else 30
LEAGUE = re.compile(r'bundesliga|schachbund|\bliga\b|ligue|liga\b|mannschaft|team|interclub|league|extraliga|ekstraliga|serie a|top ?1[26]|nationalliga|elitserien|allsvenskan|meesterklasse|division|oberliga|verbandsliga|landesliga|\bSBL\b|\bDSB\b|club cup', re.I)

tags = collections.Counter(); n = 0
events = collections.Counter(); league_events = collections.Counter()
gaps = collections.Counter(); years = collections.Counter(); results = collections.Counter()
samples = {}; with_both_elo = 0; titles = 0; plies_short = 0
bundes = 0

def finish(h):
    global n, with_both_elo, titles, bundes
    if not h: return
    n += 1
    for k in h: tags[k] += 1
    ev = h.get('Event', '?'); events[ev] += 1
    if LEAGUE.search(ev) or LEAGUE.search(h.get('Site', '')) or LEAGUE.search(h.get('Source', '')): league_events[ev] += 1
    if re.search(r'bundesliga|schachbund|\bSBL\b', ev + ' ' + h.get('Site', ''), re.I): bundes += 1
    d = h.get('Date', '')
    m = re.match(r'(\d{4})', d)
    years[m.group(1) if m else 'unknown'] += 1
    results[h.get('Result', '?')] += 1
    try:
        w, b = int(h['WhiteElo']), int(h['BlackElo']); with_both_elo += 1
        g = abs(w - b); gaps['0-99' if g < 100 else '100-199' if g < 200 else '200-299' if g < 300 else '300+'] += 1
    except Exception: pass
    if h.get('WhiteTitle') or h.get('BlackTitle'): titles += 1
    for k in ('ECO', 'Opening', 'Site', 'Source', 'WhiteTitle'):
        if k in h and k not in samples: samples[k] = h[k]

hdr = {}
with open(path, encoding='utf-8', errors='replace') as f:
    for line in f:
        if line.startswith('['):
            m = re.match(r'\[(\w+)\s+"(.*)"\]', line)
            if m:
                if m.group(1) == 'Event' and hdr: finish(hdr); hdr = {}
                hdr[m.group(1)] = m.group(2)
    finish(hdr)

pct = lambda c: f'{100 * c / max(1, n):.1f}%'
print(f'games: {n:,}')
print('tag presence: ' + ', '.join(f'{k} {pct(tags[k])}' for k in ('ECO', 'Opening', 'WhiteElo', 'BlackElo', 'WhiteTitle', 'BlackTitle', 'Date', 'Event', 'Site', 'Source', 'Round', 'FEN', 'Variant') if tags[k]))
print(f'both Elo present: {pct(with_both_elo)} | any title tag: {pct(titles)} | sample ECO/Opening/Source: {samples.get("ECO")} / {samples.get("Opening")} / {samples.get("Source")}')
print('rating gap (both Elo): ' + ', '.join(f'{k}: {v:,}' for k, v in sorted(gaps.items())))
ys = sorted((y for y in years if y != 'unknown'))
print(f'years: {ys[0] if ys else "?"} - {ys[-1] if ys else "?"}; unknown date: {years.get("unknown", 0)}')
print(f'events mentioning Bundesliga/Schachbundesliga/SBL: {bundes:,}')
print(f'\nteam-league-like events: {sum(league_events.values()):,} games in {len(league_events)} events; top {top}:')
for ev, c in league_events.most_common(top): print(f'  {c:6,}  {ev[:90]}')
