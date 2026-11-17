#!/usr/bin/env bash
# Import a curated list of Lichess broadcasts (tournament id | database name), one at a time.
# Pauses between downloads and retries once, to stay within Lichess rate limits.
# Add lines to the list to import more leagues/seasons. Re-running is safe (duplicates are ignored).
cd "$(dirname "$0")/.."
LEAGUES=(
  "qQ6KaBtg|Österreich Bundesliga 2024/25"
  "Kyghh1Jd|England 4NCL Division 1 2025/26"
  "fqkQKdui|England 4NCL Division 1 2024/25"
  "s5GWwv3Q|England 4NCL Division 1 2023/24"
  "hNPxNrIz|Tschechien Extraliga 2024/25"
  "xQNzConj|Tschechien Extraliga 2023/24"
  "5jJn4ZUP|Schweden Elitserien 2025"
  "7UkfM3GV|Schweden Elitserien 2024/25"
  "hlDD2gHf|Niederlande Meesterklasse 2025/26"
  "SPNqcX5P|Niederlande Meesterklasse 2024/25"
  "9xQ57LBQ|Kroatien Liga 2025"
  "4JGSRsEC|Griechenland Liga 2026"
  "xp8xVuJc|Griechenland Liga 2025"
  "MUMsoJjE|Norwegen Liga 2025"
  "q4TALbVA|Serbien Liga 2024"
  "QK1nAHwX|Slowakei Extraliga 2024/25"
  "AuD8VHCN|Slowenien Liga 2025"
  "XxDvLe1g|Rumänien Superliga 2024"
  "Bg03NbVS|Europapokal der Vereine 2022"
)
for spec in "${LEAGUES[@]}"; do
  id="${spec%%|*}"; name="${spec#*|}"
  echo "== $name ($id)"
  tools/fetch_lichess.sh "$id" "$name" 2>&1 | tail -1 || { sleep 20; tools/fetch_lichess.sh "$id" "$name" 2>&1 | tail -1; }
  sleep 4
done
echo ALL_DONE
