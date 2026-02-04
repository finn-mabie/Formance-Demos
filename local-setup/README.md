# Formance Local Development Setup

This repository contains everything you need to run the Formance stack locally.

## Quick Start

To start the Formance Console UI with authentication:

```bash
./start-console.sh
```

This script will:
1. Clean up any existing processes
2. Start port-forward to the gateway (port 8081)
3. Test authentication
4. Start the UI dev server on **http://localhost:3200**

## Manual Start (if needed)

If you need to start components separately:

### 1. Port-forward to Gateway
```bash
kubectl port-forward -n yhkjzhkjctlk-txpg svc/gateway 8081:8080
```

### 2. Start UI Dev Server
```bash
cd /Users/finnmabie/Documents/my-local-set-up/platform-ui/apps/console-v3
PORT=3200 pnpm dev
```

## Access the Console

Once running, access the console at:
- **UI**: http://localhost:3200
- **Main URL**: http://localhost:3200/yhkjzhkjctlk/txpg?region=local-dev

### Key Features

- **Reconciliation**: http://localhost:3200/yhkjzhkjctlk/txpg/reconciliation/policies?region=local-dev
  - ▶️ Run button on each policy to execute reconciliation
  - View reports with drift calculations
  - Granular breakdown of ledger vs payment accounts

## Authentication

The setup uses **client credentials OAuth flow** in microstack mode:
- Client ID: `local-test-client`
- Client Secret: `local-test-secret`
- Token endpoint: http://localhost:8081/api/auth/oauth/token

These credentials are configured in:
- `.env` file: `MICRO_STACK_CLIENT_ID` and `MICRO_STACK_CLIENT_SECRET`
- Auth service automatically issues tokens

## Configuration Files

### Console UI (.env)
Location: `/Users/finnmabie/Documents/my-local-set-up/platform-ui/apps/console-v3/.env`

Key settings:
- `MICRO_STACK=1` - Enables microstack mode
- `API_URL=http://localhost:8081/api` - Gateway URL
- `PORT=3200` - UI port
- `DEBUG=1` - Enable debug logging

## Troubleshooting

### Port already in use
If port 3200 is already in use:
```bash
lsof -ti:3200 | xargs kill -9
./start-console.sh
```

### Authentication errors (401/403)
1. Check port-forward is running: `lsof -i:8081`
2. Test auth manually:
```bash
curl -s http://localhost:8081/api/auth/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=local-test-client&client_secret=local-test-secret"
```

### UI not loading / 422 errors
1. Restart the dev server: `./start-console.sh`
2. Clear Vite cache:
```bash
cd /Users/finnmabie/Documents/my-local-set-up/platform-ui/apps/console-v3
rm -rf node_modules/.vite .react-router
```

### Backend services not responding
Check Kubernetes pods:
```bash
kubectl get pods -n yhkjzhkjctlk-txpg
```

All pods should be in `Running` state.

## Architecture

```
┌─────────────────┐
│   Browser       │
│  localhost:3200 │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Console UI     │
│  (React/Remix)  │
│  Port: 3200     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Port Forward   │
│  localhost:8081 │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Kubernetes (Minikube)          │
│  Namespace: yhkjzhkjctlk-txpg   │
│                                 │
│  - Gateway                      │
│  - Auth                         │
│  - Ledger                       │
│  - Payments                     │
│  - Reconciliation               │
│  - Wallets                      │
└─────────────────────────────────┘
```

## Key Changes Made

1. **Authentication**: Implemented client credentials OAuth flow for microstack mode
2. **Cash Pools**: Added SDK validation error handling for missing `type` field
3. **Reconciliation**:
   - Added Run button (▶️) directly in policies list
   - Fixed drift calculation (subtraction instead of sum)
   - Added granular breakdown view on reports
   - Fixed point-in-time balance queries
4. **Performance**: Removed per-account balance fetching from accounts list

## Directory Structure

```
my-local-set-up/
├── start-console.sh          # Main startup script
├── README.md                 # This file
├── formance-local-deploy/    # K8s deployment configs
└── platform-ui/              # Console UI source
    └── apps/console-v3/
        ├── .env              # UI configuration
        └── app/
            └── utils/
                └── auth.server.ts  # OAuth implementation
```

## Stopping Services

To stop everything:
1. Press `Ctrl+C` in the terminal running `start-console.sh`
2. Or manually:
```bash
pkill -9 -f "pnpm dev"
pkill -9 -f "kubectl port-forward"
```

