/**
 * Coins.ph Demo Configuration
 *
 * Cross-Border Remittance: USD → USDT → BRL
 *
 * Flow:
 * 1. Client sends USD to Philippines entity
 * 2. Philippines converts USD → USDT (keeps spread)
 * 3. Philippines sends USDT to Brazil (intercompany)
 * 4. Brazil sells USDT → BRL via liquidity provider
 * 5. Brazil wires BRL to recipient
 *
 * Key: Track client funds throughout + intercompany obligations
 */

export const coinsPHConfig = {
  name: 'Coins.ph',
  description: 'Cross-border remittance: USD → USDT → BRL with client tracking and intercompany flows',
  accounts: [
    {
      address: '@world',
      name: 'External',
      description: 'Money entering or leaving the system',
      color: 'slate',
    },
    {
      address: '@clients:{CLIENT_ID}:ph:received',
      name: 'Client Funds (Philippines)',
      description: 'USD received from client - tracks our liability to deliver BRL',
      color: 'blue',
    },
    {
      address: '@treasury:ph:usdt',
      name: 'Philippines USDT',
      description: 'USDT holdings in Philippines entity',
      color: 'blue',
    },
    {
      address: '@treasury:br:binance',
      name: 'Brazil Binance',
      description: 'USDT holdings in Brazil Binance account',
      color: 'blue',
    },
    {
      address: '@interco:ph:debt',
      name: 'Intercompany (owed to PH)',
      description: 'What Brazil owes Philippines for USDT transfers',
      color: 'purple',
    },
    {
      address: '@exchanges:{EXCHANGE_ID}',
      name: 'FX Exchange',
      description: 'Per-conversion account - stores rate, amounts, currencies in metadata',
      color: 'purple',
    },
    {
      address: '@banks:bradesco:operating',
      name: 'Bradesco Operating',
      description: 'Main BRL bank account in Brazil',
      color: 'green',
    },
    {
      address: '@banks:bradesco:pending:wire:{REMITTANCE_ID}',
      name: 'Pending Wire',
      description: 'BRL in transit to recipient',
      color: 'green',
    },
    {
      address: '@platform:ph:revenue',
      name: 'PH Revenue',
      description: 'Philippines fees (USD→USDT spread)',
      color: 'orange',
    },
    {
      address: '@platform:br:revenue',
      name: 'BR Revenue',
      description: 'Brazil fees (wire fees)',
      color: 'orange',
    },
  ],
  variables: {
    REMITTANCE_ID: 'rem:001',
    CLIENT_ID: 'manilamfg',
    EXCHANGE_ID: '001',
  },
  transactionSteps: [
    {
      txType: 'USD_RECEIVED',
      label: 'Client Sends USD',
      description: 'Manila Manufacturing sends $10,000 USD to Philippines entity for BRL remittance',
      numscript: `send [USD/2 1000000] (
  source = @world
  destination = @clients:{CLIENT_ID}:ph:received
)

set_tx_meta("type", "USD_RECEIVED")
set_tx_meta("remittance_id", "{REMITTANCE_ID}")
set_tx_meta("client_id", "{CLIENT_ID}")
set_tx_meta("client_name", "Manila Manufacturing")
set_tx_meta("recipient", "Supplier ABC Ltda")
set_tx_meta("amount", "$10,000 USD")`,
      queries: [
        {
          title: 'Client Funds Received',
          description: 'USD we owe to deliver as BRL - our liability',
          queryType: 'balance',
          addressFilter: 'clients:{CLIENT_ID}:ph:received',
        },
        {
          title: 'All Client Liabilities',
          description: 'Total USD received from all clients pending delivery',
          queryType: 'balance',
          addressFilter: 'clients::ph:received',
        },
      ],
    },
    {
      txType: 'USD_TO_USDT',
      label: 'Philippines Converts USD → USDT',
      description: 'Philippines converts client USD to USDT at 0.998 rate, keeping $20 spread',
      numscript: `send [USD/2 1000000] (
  source = @clients:{CLIENT_ID}:ph:received
  destination = @exchanges:{EXCHANGE_ID}
)

send [USD/2 998000] (
  source = @exchanges:{EXCHANGE_ID}
  destination = @world
)

send [USDT/6 9980000000] (
  source = @world
  destination = @exchanges:{EXCHANGE_ID}
)

send [USDT/6 9980000000] (
  source = @exchanges:{EXCHANGE_ID}
  destination = @treasury:ph:usdt
)

send [USD/2 2000] (
  source = @exchanges:{EXCHANGE_ID}
  destination = @platform:ph:revenue
)

set_account_meta(@exchanges:{EXCHANGE_ID}, "type", "USD_USDT")
set_account_meta(@exchanges:{EXCHANGE_ID}, "rate", "0.998")
set_account_meta(@exchanges:{EXCHANGE_ID}, "usd_in", "10000")
set_account_meta(@exchanges:{EXCHANGE_ID}, "usdt_out", "9980")
set_account_meta(@exchanges:{EXCHANGE_ID}, "spread", "20")
set_account_meta(@exchanges:{EXCHANGE_ID}, "remittance_id", "{REMITTANCE_ID}")
set_account_meta(@exchanges:{EXCHANGE_ID}, "client_id", "{CLIENT_ID}")

set_tx_meta("type", "USD_TO_USDT")
set_tx_meta("exchange_id", "{EXCHANGE_ID}")
set_tx_meta("remittance_id", "{REMITTANCE_ID}")
set_tx_meta("rate", "0.998")`,
      queries: [
        {
          title: 'Philippines USDT Balance',
          description: 'USDT now held by Philippines entity',
          queryType: 'balance',
          addressFilter: 'treasury:ph:usdt',
        },
        {
          title: 'Philippines Revenue',
          description: 'Spread earned on USD→USDT conversion',
          queryType: 'balance',
          addressFilter: 'platform:ph:revenue',
        },
        {
          title: 'Exchange Details',
          description: 'Conversion metadata (rate, amounts)',
          queryType: 'account',
          accountAddress: 'exchanges:{EXCHANGE_ID}',
        },
      ],
    },
    {
      txType: 'INTERCO_TRANSFER',
      label: 'Philippines → Brazil USDT',
      description: 'Philippines sends USDT to Brazil entity, creating intercompany debt',
      numscript: `send [USDT/6 9980000000] (
  source = @treasury:ph:usdt
  destination = @treasury:br:binance
)

send [USDT/6 9980000000] (
  source = @world
  destination = @interco:ph:debt
)

set_tx_meta("type", "INTERCO_TRANSFER")
set_tx_meta("remittance_id", "{REMITTANCE_ID}")
set_tx_meta("from_entity", "coins_ph")
set_tx_meta("to_entity", "coins_br")
set_tx_meta("note", "Brazil owes Philippines for USDT transfer")`,
      queries: [
        {
          title: 'Brazil USDT Balance',
          description: 'USDT now in Brazil Binance account',
          queryType: 'balance',
          addressFilter: 'treasury:br:binance',
        },
        {
          title: 'Intercompany Debt',
          description: 'What Brazil owes Philippines (settled monthly)',
          queryType: 'balance',
          addressFilter: 'interco:ph:debt',
        },
      ],
    },
    {
      txType: 'USDT_TO_BRL',
      label: 'Brazil Sells USDT → BRL',
      description: 'Brazil sells USDT via OTC to liquidity provider at 5.45 BRL rate',
      numscript: `send [USDT/6 9980000000] (
  source = @treasury:br:binance
  destination = @exchanges:{EXCHANGE_ID}:br
)

send [USDT/6 9980000000] (
  source = @exchanges:{EXCHANGE_ID}:br
  destination = @world
)

send [BRL/2 5439100] (
  source = @world
  destination = @exchanges:{EXCHANGE_ID}:br
)

send [BRL/2 5439100] (
  source = @exchanges:{EXCHANGE_ID}:br
  destination = @banks:bradesco:operating
)

set_account_meta(@exchanges:{EXCHANGE_ID}:br, "type", "USDT_BRL")
set_account_meta(@exchanges:{EXCHANGE_ID}:br, "rate", "5.45")
set_account_meta(@exchanges:{EXCHANGE_ID}:br, "usdt_in", "9980")
set_account_meta(@exchanges:{EXCHANGE_ID}:br, "brl_out", "54391")
set_account_meta(@exchanges:{EXCHANGE_ID}:br, "remittance_id", "{REMITTANCE_ID}")
set_account_meta(@exchanges:{EXCHANGE_ID}:br, "liquidity_provider", "OTC Chat")

set_tx_meta("type", "USDT_TO_BRL")
set_tx_meta("exchange_id", "{EXCHANGE_ID}:br")
set_tx_meta("remittance_id", "{REMITTANCE_ID}")
set_tx_meta("rate", "5.45")`,
      queries: [
        {
          title: 'Brazil Bank Balance',
          description: 'BRL now in Bradesco operating account',
          queryType: 'balance',
          addressFilter: 'banks:bradesco:operating',
        },
        {
          title: 'Brazil Exchange Details',
          description: 'USDT→BRL conversion metadata',
          queryType: 'account',
          accountAddress: 'exchanges:{EXCHANGE_ID}:br',
        },
      ],
    },
    {
      txType: 'WIRE_INITIATED',
      label: 'Wire to Recipient',
      description: 'Brazil initiates BRL wire to Supplier ABC Ltda, R$150 fee',
      numscript: `send [BRL/2 5424100] (
  source = @banks:bradesco:operating
  destination = @banks:bradesco:pending:wire:{REMITTANCE_ID}
)

send [BRL/2 15000] (
  source = @banks:bradesco:operating
  destination = @platform:br:revenue
)

set_tx_meta("type", "WIRE_INITIATED")
set_tx_meta("remittance_id", "{REMITTANCE_ID}")
set_tx_meta("client_id", "{CLIENT_ID}")
set_tx_meta("recipient", "Supplier ABC Ltda")
set_tx_meta("recipient_bank", "Banco do Brasil")
set_tx_meta("amount", "R$54,241")
set_tx_meta("fee", "R$150")`,
      queries: [
        {
          title: 'Pending Wire',
          description: 'BRL awaiting delivery to recipient',
          queryType: 'balance',
          addressFilter: 'banks:bradesco:pending:wire:{REMITTANCE_ID}',
        },
        {
          title: 'Brazil Revenue',
          description: 'Wire fees collected',
          queryType: 'balance',
          addressFilter: 'platform:br:revenue',
        },
      ],
    },
    {
      txType: 'WIRE_SETTLED',
      label: 'Wire Delivered',
      description: 'Recipient receives BRL - remittance complete',
      numscript: `send [BRL/2 5424100] (
  source = @banks:bradesco:pending:wire:{REMITTANCE_ID}
  destination = @world
)

set_tx_meta("type", "WIRE_SETTLED")
set_tx_meta("remittance_id", "{REMITTANCE_ID}")
set_tx_meta("client_id", "{CLIENT_ID}")
set_tx_meta("bank_ref", "TED-789012")
set_tx_meta("status", "DELIVERED")`,
      queries: [
        {
          title: 'Complete Remittance Journey',
          description: 'All transactions for this remittance',
          queryType: 'transactions',
          transactionFilter: {
            metadata: { remittance_id: '{REMITTANCE_ID}' },
          },
        },
        {
          title: 'All Exchanges for This Remittance',
          description: 'USD→USDT and USDT→BRL conversion details',
          queryType: 'accounts',
          accountAddress: 'exchanges:{EXCHANGE_ID}',
        },
        {
          title: 'Total Platform Revenue',
          description: 'Philippines spread + Brazil wire fee',
          queryType: 'balance',
          addressFilters: [
            'platform:ph:revenue',
            'platform:br:revenue',
          ],
        },
      ],
    },
  ],
  usefulQueries: [
    {
      title: 'Client Liabilities',
      description: 'All client funds pending delivery',
      queryType: 'balance',
      addressFilter: 'clients:',
    },
    {
      title: 'Intercompany Position',
      description: 'What Brazil owes Philippines',
      queryType: 'balance',
      addressFilter: 'interco:ph:debt',
    },
    {
      title: 'All Treasury Positions',
      description: 'USDT holdings across entities',
      queryType: 'balance',
      addressFilter: 'treasury:',
    },
    {
      title: 'Total Platform Revenue',
      description: 'Combined PH spread + BR fees',
      queryType: 'balance',
      addressFilters: [
        'platform:ph:revenue',
        'platform:br:revenue',
      ],
    },
    {
      title: 'All Exchanges',
      description: 'FX conversion accounts with metadata',
      queryType: 'accounts',
      accountAddress: 'exchanges:',
    },
    {
      title: 'Pending Wires',
      description: 'All wires in transit',
      queryType: 'balance',
      addressFilter: 'banks:bradesco:pending:wire:',
    },
    {
      title: 'Track by Client',
      description: 'All transactions for a specific client',
      queryType: 'transactions',
      transactionFilter: {
        metadata: { client_id: '{CLIENT_ID}' },
      },
    },
  ],
};

/**
 * KEY PATTERNS DEMONSTRATED:
 *
 * 1. Client Fund Tracking
 *    - @clients:{CLIENT_ID}:ph:received tracks whose money this is
 *    - Query all client liabilities: clients::ph:received
 *
 * 2. Two-Leg FX Conversion
 *    - USD → USDT in Philippines (spread = PH revenue)
 *    - USDT → BRL in Brazil (OTC with liquidity provider)
 *    - Each conversion gets its own exchange account with metadata
 *
 * 3. Intercompany Tracking
 *    - @interco:ph:debt tracks what Brazil owes Philippines
 *    - Settled monthly via separate intercompany settlement process
 *
 * 4. Wire Pending State
 *    - Per-remittance pending account: @banks:bradesco:pending:wire:{REMITTANCE_ID}
 *    - Easy to query all pending wires
 *
 * 5. Multi-Entity Revenue Tracking
 *    - @platform:ph:revenue for Philippines spread
 *    - @platform:br:revenue for Brazil wire fees
 */
