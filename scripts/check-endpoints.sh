#!/bin/bash
# SmartHouse — test endpoints (data-guard + alerts)
# Użycie: ./scripts/check-endpoints.sh [prod|local]

ENV=${1:-prod}

if [ "$ENV" = "local" ]; then
  BASE_URL="http://localhost:3000"
else
  BASE_URL="https://sw-house.pl"
fi

# Wczytaj CRON_SECRET z .env.local
SECRET=$(grep '^CRON_SECRET=' "$(dirname "$0")/../.env.local" 2>/dev/null | cut -d'=' -f2)
if [ -z "$SECRET" ]; then
  echo "❌ Brak CRON_SECRET w .env.local"
  exit 1
fi

AUTH="Authorization: Bearer $SECRET"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 SmartHouse endpoint check — $BASE_URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Data Guard ────────────────────────────────
echo ""
echo "📊 DATA GUARD (POST /api/data-guard)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/data-guard" \
  -H "$AUTH" -H "Content-Type: application/json")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ HTTP $HTTP_CODE"
  echo "$BODY" | jq '{checkedAt, firstRun, totalSheets: (.sheets | length), anomalies: (.anomalies | length), sheets}'
else
  echo "❌ HTTP $HTTP_CODE"
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
fi

# ── Alerts ────────────────────────────────────
echo ""
echo "🔔 ALERTS (POST /api/alerts)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/alerts" \
  -H "$AUTH" -H "Content-Type: application/json")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ HTTP $HTTP_CODE"
  echo "$BODY" | jq '{checkedAt, totalAlerts, summary}'
else
  echo "❌ HTTP $HTTP_CODE"
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
fi

# ── Data Guard snapshot ───────────────────────
echo ""
echo "📋 SNAPSHOT (GET /api/data-guard)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/data-guard" \
  -H "$AUTH")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ HTTP $HTTP_CODE"
  echo "$BODY" | jq '.snapshot | to_entries | map({sheet: .key, rows: .value.rowCount, checkedAt: .value.checkedAt})' 2>/dev/null
else
  echo "❌ HTTP $HTTP_CODE"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
