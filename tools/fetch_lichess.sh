#!/usr/bin/env bash
# Download a Lichess broadcast (whole tournament, all rounds) as PGN and import it.
# Usage: tools/fetch_lichess.sh <tournamentId> "<Database name>"
#   tournamentId = "tour.id" of a broadcast, e.g. jJzJv14g (German Bundesliga 2026/27).
#   Find it with:  curl -sH 'Accept: application/json' https://lichess.org/api/broadcast/<slug>/<round-slug>/<roundId> | grep -o '"tour":{"id":"[^"]*"'
set -euo pipefail
cd "$(dirname "$0")/.."
id="${1:?tournament id}"; name="${2:?database name}"
mkdir -p data
curl -fsS "https://lichess.org/api/broadcast/${id}.pgn" -o "data/lichess_${id}.pgn"
php tools/import_pgn.php games "data/lichess_${id}.pgn" "$name" "lichess broadcast ${id}"
