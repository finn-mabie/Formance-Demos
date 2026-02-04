/**
 * Coins.ph Demo Configuration
 *
 * Cross-Border Remittance with Tracked FX Conversions
 * USDT → BRL via exchange pattern with @world
 *
 * To use: Add this config to the Formance Console's useDemoMode.ts
 */

export const coinsPHConfig = {
  name: 'Coins.ph',
  description: 'Cross-border remittance with tracked FX conversions via exchange accounts',
  accounts: [
    {
      address: '@world',
      name: 'External',
      description: 'Crypto/fiat entering or leaving the system',
      color: 'slate',
    },
    {
      address: '@treasury:binance:hot',
      name: 'Binance Hot Wallet',
      description: 'USDT holdings on Binance exchange',
      color: 'blue',
    },
    {
      address: '@exchanges:usdt:brl:{EXCHANGE_ID}',
      name: 'Exchange Account',
      description: 'Tracks a specific USDT/BRL conversion - stores rate and amounts in metadata',
      color: 'purple',
    },
    {
      address: '@banks:bradesco:operating',
      name: 'Bradesco Operating',
      description: 'Main BRL bank account for local operations',
      color: 'green',
    },
    {
      address: '@banks:bradesco:pending:wire',
      name: 'Pending Wires',
      description: 'BRL funds in transit to recipients',
      color: 'green',
    },
    {
      address: '@platform:revenue',
      name: 'Platform Revenue',
      description: 'Fees earned on each remittance',
      color: 'orange',
    },
  ],
  variables: {
    REMITTANCE_ID: 'rem:001',
    EXCHANGE_ID: '001',
    CLIENT: 'Manila Manufacturing',
  },
  transactionSteps: [
    {
      txType: 'USDT_RECEIVED',
      label: 'USDT Received',
      description: 'Client sends 10,000 USDT for conversion to BRL',
      numscript: `send [USDT/6 10000000000] (
  source = @world
  destination = @treasury:binance:hot
)

set_tx_meta("type", "USDT_RECEIVED")
set_tx_meta("remittance_id", "{REMITTANCE_ID}")
set_tx_meta("client", "{CLIENT}")
set_tx_meta("amount", "10,000 USDT")`,
      queries: [
        {
          title: 'Treasury Holdings',
          description: 'USDT received and ready for conversion',
          queryType: 'balance',
          addressFilter: 'treasury:',
        },
      ],
    },
    {
      txType: 'FX_CONVERSION',
      label: 'FX Conversion',
      description: 'Execute exchange: USDT sold to @world, BRL purchased from @world at 5.45 rate',
      numscript: `send [USDT/6 10000000000] (
  source = @treasury:binance:hot
  destination = @exchanges:usdt:brl:{EXCHANGE_ID}
)

send [USDT/6 10000000000] (
  source = @exchanges:usdt:brl:{EXCHANGE_ID}
  destination = @world
)

send [BRL/2 5450000] (
  source = @world
  destination = @exchanges:usdt:brl:{EXCHANGE_ID}
)

send [BRL/2 5450000] (
  source = @exchanges:usdt:brl:{EXCHANGE_ID}
  destination = @banks:bradesco:operating
)

set_account_meta(@exchanges:usdt:brl:{EXCHANGE_ID}, "type", "USDT_BRL")
set_account_meta(@exchanges:usdt:brl:{EXCHANGE_ID}, "rate", "5.45")
set_account_meta(@exchanges:usdt:brl:{EXCHANGE_ID}, "usdt_amount", "10000")
set_account_meta(@exchanges:usdt:brl:{EXCHANGE_ID}, "brl_amount", "54500")
set_account_meta(@exchanges:usdt:brl:{EXCHANGE_ID}, "remittance_id", "{REMITTANCE_ID}")
set_account_meta(@exchanges:usdt:brl:{EXCHANGE_ID}, "executed_at", "2024-01-15T10:30:00Z")

set_tx_meta("type", "FX_CONVERSION")
set_tx_meta("exchange_id", "{EXCHANGE_ID}")
set_tx_meta("remittance_id", "{REMITTANCE_ID}")
set_tx_meta("rate", "5.45")`,
      queries: [
        {
          title: 'Exchange Account',
          description: 'Shows the exchange with metadata (rate, amounts, timestamp)',
          queryType: 'account',
          accountAddress: 'exchanges:usdt:brl:{EXCHANGE_ID}',
        },
        {
          title: 'Bank Position',
          description: 'BRL now in operating account',
          queryType: 'balance',
          addressFilter: 'banks:bradesco:operating',
        },
      ],
    },
    {
      txType: 'WIRE_INITIATED',
      label: 'Wire Initiated',
      description: 'Send R$54,350 to recipient, R$150 fee to platform',
      numscript: `send [BRL/2 5435000] (
  source = @banks:bradesco:operating
  destination = @banks:bradesco:pending:wire
)

send [BRL/2 15000] (
  source = @banks:bradesco:operating
  destination = @platform:revenue
)

set_tx_meta("type", "WIRE_INITIATED")
set_tx_meta("remittance_id", "{REMITTANCE_ID}")
set_tx_meta("recipient", "Supplier ABC Ltda")
set_tx_meta("amount", "R$54,350")
set_tx_meta("fee", "R$150")`,
      queries: [
        {
          title: 'Pending Wires',
          description: 'Funds awaiting settlement',
          queryType: 'balance',
          addressFilter: 'banks:bradesco:pending:wire',
        },
        {
          title: 'Platform Revenue',
          description: 'Fees collected',
          queryType: 'balance',
          addressFilter: 'platform:revenue',
        },
      ],
    },
    {
      txType: 'WIRE_SETTLED',
      label: 'Wire Settled',
      description: 'Wire transfer completed - recipient received funds',
      numscript: `send [BRL/2 5435000] (
  source = @banks:bradesco:pending:wire
  destination = @world
)

set_tx_meta("type", "WIRE_SETTLED")
set_tx_meta("remittance_id", "{REMITTANCE_ID}")
set_tx_meta("bank_ref", "TED-789012")
set_tx_meta("status", "COMPLETED")`,
      queries: [
        {
          title: 'Complete Remittance Journey',
          description: 'Full flow: deposit → conversion → wire → settlement',
          queryType: 'transactions',
          transactionFilter: {
            metadata: { remittance_id: '{REMITTANCE_ID}' },
          },
        },
        {
          title: 'Exchange Details',
          description: 'Account metadata stores FX rate and amounts',
          queryType: 'account',
          accountAddress: 'exchanges:usdt:brl:{EXCHANGE_ID}',
        },
      ],
    },
  ],
  usefulQueries: [
    {
      title: 'All Exchanges',
      description: 'List all exchange accounts with their metadata',
      queryType: 'accounts',
      accountAddress: 'exchanges:',
    },
    {
      title: 'Total Platform Liquidity',
      description: 'All treasury and bank accounts',
      queryType: 'balance',
      addressFilters: [
        'treasury:',
        'banks:',
      ],
    },
    {
      title: 'Pending Settlements',
      description: 'Funds in transit',
      queryType: 'balance',
      addressFilter: 'banks::pending:',
    },
    {
      title: 'Platform Revenue',
      description: 'Total fees collected',
      queryType: 'balance',
      addressFilter: 'platform:revenue',
    },
  ],
};

/**
 * KEY PATTERNS DEMONSTRATED:
 *
 * 1. Exchange Pattern (Bidirectional Swap with @world)
 *    - Treasury sends USDT to exchange account
 *    - Exchange sends USDT to @world (selling)
 *    - @world sends BRL to exchange (buying)
 *    - Exchange sends BRL to bank
 *    - NO "allowing unbounded overdraft" needed!
 *
 * 2. Per-Exchange Account with Metadata
 *    - @exchanges:usdt:brl:001 stores rate, amounts, timestamp
 *    - Query all exchanges to see conversion history
 *
 * 3. Wire Transfer with Pending State
 *    - @banks:bradesco:operating → @banks:bradesco:pending:wire
 *    - Then pending → @world when settled
 */
