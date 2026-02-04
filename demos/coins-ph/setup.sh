#!/bin/bash
# Setup script for Coins.ph demo ledger
#
# Prerequisites:
# - Formance stack running (minikube or cloud)
# - Gateway port-forwarded: kubectl port-forward -n yhkjzhkjctlk-txpg svc/gateway 8081:8080
# - jq installed

set -e

# Configuration
API_URL="${API_URL:-http://localhost:8081}"
CLIENT_ID="${CLIENT_ID:-local-test-client}"
CLIENT_SECRET="${CLIENT_SECRET:-local-test-secret}"
LEDGER_NAME="${LEDGER_NAME:-coins-ph-demo}"

echo "Setting up Coins.ph demo ledger..."
echo "API URL: $API_URL"
echo "Ledger: $LEDGER_NAME"

# Get auth token
echo "Getting auth token..."
TOKEN=$(curl -s "$API_URL/api/auth/oauth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=$CLIENT_ID&client_secret=$CLIENT_SECRET" \
  | jq -r '.access_token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "Error: Failed to get auth token. Is the gateway port-forwarded?"
  echo "Run: kubectl port-forward -n yhkjzhkjctlk-txpg svc/gateway 8081:8080"
  exit 1
fi

echo "Got auth token"

# Check if ledger exists
echo "Checking if ledger exists..."
LEDGER_CHECK=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/ledger/v2/$LEDGER_NAME" \
  -H "Authorization: Bearer $TOKEN")

if [ "$LEDGER_CHECK" = "200" ]; then
  echo "Ledger '$LEDGER_NAME' already exists"
  echo ""
  echo "To access the demo:"
  echo "http://localhost:3200/yhkjzhkjctlk/txpg/ledgers/$LEDGER_NAME?region=local-dev&demo=true"
  exit 0
fi

# Create ledger with its own bucket
echo "Creating ledger '$LEDGER_NAME' with dedicated bucket..."
RESULT=$(curl -s -X POST "$API_URL/api/ledger/v2/$LEDGER_NAME" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"bucket\": \"$LEDGER_NAME\", \"metadata\": {\"demo\": \"coins-ph\"}}")

# Check for errors
if echo "$RESULT" | jq -e '.errorCode' > /dev/null 2>&1; then
  echo "Error creating ledger:"
  echo "$RESULT" | jq .
  exit 1
fi

echo "Ledger created successfully!"
echo ""
echo "To access the demo:"
echo "http://localhost:3200/yhkjzhkjctlk/txpg/ledgers/$LEDGER_NAME?region=local-dev&demo=true"
echo ""
echo "Make sure the console has the coins-ph demo config in useDemoMode.ts"
