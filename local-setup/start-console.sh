#!/bin/bash

# Formance Console - Local Development Startup Script
# This script starts the port-forward and dev server cleanly

set -e

echo "🧹 Cleaning up any existing processes..."
pkill -9 -f "pnpm dev" 2>/dev/null || true
pkill -9 -f "kubectl port-forward.*gateway" 2>/dev/null || true
lsof -ti:3200,8081 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 2

echo "🚀 Starting port-forward to gateway..."
kubectl port-forward -n yhkjzhkjctlk-txpg svc/gateway 8081:8080 > /tmp/gateway-port-forward.log 2>&1 &
PORTFORWARD_PID=$!
sleep 3

echo "🔐 Testing authentication..."
TOKEN=$(curl -s http://localhost:8081/api/auth/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=local-test-client&client_secret=local-test-secret" | jq -r '.access_token' 2>/dev/null)

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Authentication failed!"
  kill $PORTFORWARD_PID 2>/dev/null || true
  exit 1
fi

echo "✅ Authentication working!"
echo "Token: ${TOKEN:0:30}..."

echo "🎨 Starting UI dev server on port 3200..."
cd /Users/finnmabie/Documents/my-local-set-up/platform-ui/apps/console-v3
PORT=3200 pnpm dev

# Cleanup on exit
trap "echo '🧹 Cleaning up...'; kill $PORTFORWARD_PID 2>/dev/null || true" EXIT

