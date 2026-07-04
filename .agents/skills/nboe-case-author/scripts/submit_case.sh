#!/usr/bin/env bash
# submit_case.sh — POST case JSON ke NBOE ingest-case endpoint.
# Usage:  CASE_INGEST_API_KEY=xxx bash submit_case.sh path/to/case.json
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <case.json>" >&2
  exit 2
fi

FILE="$1"
if [[ ! -f "$FILE" ]]; then
  echo "File not found: $FILE" >&2
  exit 2
fi

: "${CASE_INGEST_API_KEY:?Set CASE_INGEST_API_KEY env var first}"

URL="${NBOE_INGEST_URL:-https://nowebjmwrtkspvdwgevj.supabase.co/functions/v1/ingest-case}"

HTTP_CODE=$(curl -sS -o /tmp/nboe_ingest_resp.json -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "X-Agent-Api-Key: ${CASE_INGEST_API_KEY}" \
  --data-binary "@${FILE}" \
  "${URL}")

echo "HTTP ${HTTP_CODE}"
cat /tmp/nboe_ingest_resp.json
echo

if [[ "$HTTP_CODE" != "200" ]]; then
  exit 1
fi
