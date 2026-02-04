#!/bin/bash

# Rain Demo Setup Script
# Creates a ledger for the Rain fiat→stablecoin on-ramp demo

# Configuration
GATEWAY_URL="${GATEWAY_URL:-http://localhost:8081}"
LEDGER_NAME="rain-demo"

echo "Creating Rain demo ledger..."
echo "Gateway URL: $GATEWAY_URL"
echo "Ledger Name: $LEDGER_NAME"
echo ""

# Create the ledger with demo metadata
curl -X POST "$GATEWAY_URL/api/ledger/v2/$LEDGER_NAME" \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {
      "demo": "rain",
      "description": "Rain Money-In: Fiat to stablecoin on-ramp via virtual accounts"
    }
  }'

echo ""
echo ""
echo "Done! Access the demo at:"
echo "http://localhost:3200/yhkjzhkjctlk/txpg/ledgers/$LEDGER_NAME?region=local-dev&demo=true"
echo ""
echo "Note: Replace 'yhkjzhkjctlk/txpg' with your actual organization/stack path"
