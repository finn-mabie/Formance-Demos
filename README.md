# Formance Demo Configurations

Demo configurations for the Formance Console's interactive demo mode.

## Available Demos

### Monetae
**Fiat Custody + Stablecoin Conversion for Wealth Tech**

A demo showing:
- ACH deposits with pending states
- Fiat custody at central bank (per-customer accounts)
- USD → USDC conversion via exchange pattern
- USDC → tokenized asset (TSLA) investment
- 1:1 backing verification queries

## Setup

### Prerequisites

1. **Formance stack running** (minikube or cloud)
2. **Gateway port-forwarded** (for local): `kubectl port-forward -n yhkjzhkjctlk-txpg svc/gateway 8081:8080`
3. **Console running** with demo mode enabled

### Create a Demo Ledger

```bash
# Set your API URL
export API_URL=http://localhost:8081

# Get auth token (local setup)
TOKEN=$(curl -s $API_URL/api/auth/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=local-test-client&client_secret=local-test-secret" \
  | jq -r '.access_token')

# Create ledger with demo metadata
# IMPORTANT: Use a dedicated bucket for easier data management
curl -X POST "$API_URL/api/ledger/v2/monetae-demo" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bucket": "monetae-demo", "metadata": {"demo": "monetae"}}'
```

### Access the Demo

Open in browser:
```
http://localhost:3200/{org}/{stack}/ledgers/monetae-demo?region=local-dev&demo=true
```

For local minikube setup:
```
http://localhost:3200/yhkjzhkjctlk/txpg/ledgers/monetae-demo?region=local-dev&demo=true
```

## Console Integration

The demo configs in this repo need to be added to the Formance Console codebase:

**File:** `/apps/console-v3/app/hooks/useDemoMode.ts`

Add the demo config to the `DEMO_CONFIGS` object:
```typescript
const DEMO_CONFIGS: Record<string, DemoConfig> = {
  monetae: monetaeConfig,  // Import from demos/monetae/config.ts
  // ... other demos
};
```

## Clearing Demo Data

To reset a demo ledger, the console needs direct database access:

1. Port-forward PostgreSQL:
   ```bash
   kubectl port-forward -n formance-system svc/postgresql 5432:5432
   ```

2. Set environment variable in console `.env`:
   ```
   LEDGER_DATABASE_URL=postgresql://formance:formance@localhost:5432/yhkjzhkjctlk-txpg-ledger
   ```

3. Use the "Clear Ledger" button in demo mode

## Demo Design Principles

See [Account Naming Conventions](./docs/account-naming-conventions.md) for best practices on:
- Account hierarchy and naming
- Exchange pattern for currency conversion
- Per-customer custody accounts
- Multi-asset accounts
- Avoiding double-counting
