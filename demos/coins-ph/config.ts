/**
 * Coins.ph Demo Configuration
 *
 * Cross-Border Remittance: USD → USDT → BRL
 *
 * Flow:
 * 1. Client sends USD to Philippines entity (fiat bank)
 * 2. Philippines converts USD → USDT (keeps spread) → client's Fireblocks
 * 3. Philippines sends USDT to Brazil (USDT leaves PH, enters BR pending)
 * 4. Brazil settles USDT receipt
 * 5. Brazil sells USDT → BRL via liquidity provider (BRL stays as client funds)
 * 6. Brazil wires BRL to recipient (client funds → external recipient)
 *
 * Key: Per-customer custody accounts - always know whose money it is
 */

export const coinsPHConfig = {
  name: 'Coins.ph',
  description: 'Cross-border remittance: USD → USDT → BRL with per-customer custody tracking',
  accounts: [
    {
      address: '@world',
      name: 'External',
      description: 'Money entering or leaving the system',
      color: 'slate',
    },
    {
      address: '@clients:{CLIENT_ID}:ph:bank',
      name: 'Client USD (PH Bank)',
      description: 'Client USD received at Philippines bank',
      color: 'blue',
    },
    {
      address: '@clients:{CLIENT_ID}:ph:fireblocks',
      name: 'Client USDT (PH Fireblocks)',
      description: 'Client USDT in Philippines Fireblocks custody',
      color: 'blue',
    },
    {
      address: '@clients:{CLIENT_ID}:br:fireblocks:pending',
      name: 'Client USDT (BR Pending)',
      description: 'Client USDT in transit to Brazil - not yet settled',
      color: 'orange',
    },
    {
      address: '@clients:{CLIENT_ID}:br:fireblocks',
      name: 'Client USDT (BR Fireblocks)',
      description: 'Client USDT settled in Brazil Fireblocks custody',
      color: 'blue',
    },
    {
      address: '@clients:{CLIENT_ID}:br:bank',
      name: 'Client BRL (BR Bank)',
      description: 'Client BRL at Brazil bank - post conversion',
      color: 'blue',
    },
    {
      address: '@clients:{CLIENT_ID}:remittances:{REMITTANCE_ID}:pending',
      name: 'Pending Wire (Client)',
      description: 'Client BRL in transit to recipient',
      color: 'orange',
    },
    {
      address: '@exchanges:{EXCHANGE_ID}',
      name: 'FX Exchange',
      description: 'Per-conversion account - stores rate, amounts in metadata',
      color: 'purple',
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
      description: 'Manila Manufacturing sends $10,000 USD to Philippines bank account',
      numscript: `send [USD/2 1000000] (
  source = @world
  destination = @clients:{CLIENT_ID}:ph:bank
)

set_tx_meta("type", "USD_RECEIVED")
set_tx_meta("remittance_id", "{REMITTANCE_ID}")
set_tx_meta("client_id", "{CLIENT_ID}")
set_tx_meta("client_name", "Manila Manufacturing")
set_tx_meta("recipient", "Supplier ABC Ltda")
set_tx_meta("amount", "$10,000 USD")`,
      queries: [
        {
          title: 'Client Funds at PH Bank',
          description: 'USD received - we know exactly whose money this is',
          queryType: 'balance',
          addressFilter: 'clients:{CLIENT_ID}:ph:bank',
        },
        {
          title: 'All Client USD (Philippines)',
          description: 'Total USD across all clients at PH bank',
          queryType: 'balance',
          addressFilter: 'clients::ph:bank',
        },
        {
          title: 'Remittance Journey (1 of 7)',
          description: 'Track the complete remittance by ID - just getting started',
          queryType: 'transactions',
          transactionFilter: {
            metadata: { remittance_id: '{REMITTANCE_ID}' },
          },
        },
      ],
    },
    {
      txType: 'USD_TO_USDT',
      label: 'Philippines Converts USD → USDT',
      description: 'Convert client USD to USDT at 0.998 rate, keeping $20 spread. USDT goes to client Fireblocks account.',
      numscript: `send [USD/2 1000000] (
  source = @clients:{CLIENT_ID}:ph:bank
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
  destination = @clients:{CLIENT_ID}:ph:fireblocks
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
          title: 'Client USDT at PH Fireblocks',
          description: 'Client now has USDT in Philippines custody',
          queryType: 'balance',
          addressFilter: 'clients:{CLIENT_ID}:ph:fireblocks',
        },
        {
          title: 'Philippines Revenue',
          description: 'Spread earned on USD→USDT conversion',
          queryType: 'balance',
          addressFilter: 'platform:ph:revenue',
        },
        {
          title: 'All Client USDT (PH Fireblocks)',
          description: 'Total USDT across all clients at Philippines',
          queryType: 'balance',
          addressFilter: 'clients::ph:fireblocks',
        },
      ],
    },
    {
      txType: 'INTERCO_INITIATED',
      label: 'Send USDT to Brazil (Pending)',
      description: 'Philippines sends client USDT to Brazil Fireblocks - USDT leaves PH custody, enters BR pending',
      numscript: `send [USDT/6 9980000000] (
  source = @clients:{CLIENT_ID}:ph:fireblocks
  destination = @world
)

send [USDT/6 9980000000] (
  source = @world
  destination = @clients:{CLIENT_ID}:br:fireblocks:pending
)

set_tx_meta("type", "INTERCO_INITIATED")
set_tx_meta("remittance_id", "{REMITTANCE_ID}")
set_tx_meta("client_id", "{CLIENT_ID}")
set_tx_meta("from_entity", "coins_ph")
set_tx_meta("to_entity", "coins_br")
set_tx_meta("status", "PENDING")`,
      queries: [
        {
          title: 'Client USDT Left PH Custody',
          description: 'PH Fireblocks now zero for this client',
          queryType: 'balance',
          addressFilter: 'clients:{CLIENT_ID}:ph:fireblocks',
        },
        {
          title: 'Client USDT Pending at Brazil',
          description: 'USDT in transit - not yet settled',
          queryType: 'balance',
          addressFilter: 'clients:{CLIENT_ID}:br:fireblocks:pending',
        },
        {
          title: 'All Pending Intercompany',
          description: 'Total USDT pending settlement at Brazil',
          queryType: 'balance',
          addressFilter: 'clients::br:fireblocks:pending',
        },
      ],
    },
    {
      txType: 'INTERCO_SETTLED',
      label: 'Brazil Settles USDT Receipt',
      description: 'Brazil confirms USDT receipt - funds now available for conversion',
      numscript: `send [USDT/6 9980000000] (
  source = @clients:{CLIENT_ID}:br:fireblocks:pending
  destination = @clients:{CLIENT_ID}:br:fireblocks
)

set_tx_meta("type", "INTERCO_SETTLED")
set_tx_meta("remittance_id", "{REMITTANCE_ID}")
set_tx_meta("client_id", "{CLIENT_ID}")
set_tx_meta("status", "SETTLED")`,
      queries: [
        {
          title: 'Client USDT at Brazil Fireblocks',
          description: 'USDT settled and ready for conversion',
          queryType: 'balance',
          addressFilter: 'clients:{CLIENT_ID}:br:fireblocks',
        },
        {
          title: 'All Client USDT (BR Fireblocks)',
          description: 'Total settled USDT at Brazil',
          queryType: 'balance',
          addressFilter: 'clients::br:fireblocks',
        },
        {
          title: 'Remittance Journey (4 of 7)',
          description: 'Halfway there - USD received, converted to USDT, crossed entities',
          queryType: 'transactions',
          transactionFilter: {
            metadata: { remittance_id: '{REMITTANCE_ID}' },
          },
        },
      ],
    },
    {
      txType: 'USDT_TO_BRL',
      label: 'Brazil Sells USDT → BRL',
      description: 'Sell client USDT via OTC at 5.45 BRL rate - BRL still tracked as client funds',
      numscript: `send [USDT/6 9980000000] (
  source = @clients:{CLIENT_ID}:br:fireblocks
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
  destination = @clients:{CLIENT_ID}:br:bank
)

set_account_meta(@exchanges:{EXCHANGE_ID}:br, "type", "USDT_BRL")
set_account_meta(@exchanges:{EXCHANGE_ID}:br, "rate", "5.45")
set_account_meta(@exchanges:{EXCHANGE_ID}:br, "usdt_in", "9980")
set_account_meta(@exchanges:{EXCHANGE_ID}:br, "brl_out", "54391")
set_account_meta(@exchanges:{EXCHANGE_ID}:br, "remittance_id", "{REMITTANCE_ID}")
set_account_meta(@exchanges:{EXCHANGE_ID}:br, "client_id", "{CLIENT_ID}")
set_account_meta(@exchanges:{EXCHANGE_ID}:br, "liquidity_provider", "OTC Chat")

set_tx_meta("type", "USDT_TO_BRL")
set_tx_meta("exchange_id", "{EXCHANGE_ID}:br")
set_tx_meta("remittance_id", "{REMITTANCE_ID}")
set_tx_meta("client_id", "{CLIENT_ID}")
set_tx_meta("rate", "5.45")`,
      queries: [
        {
          title: 'Client BRL at Brazil Bank',
          description: 'BRL still tracked as client funds - ready for wire',
          queryType: 'balance',
          addressFilter: 'clients:{CLIENT_ID}:br:bank',
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
      description: 'Initiate BRL wire to Supplier ABC Ltda, R$150 fee deducted from client funds',
      numscript: `send [BRL/2 5424100] (
  source = @clients:{CLIENT_ID}:br:bank
  destination = @clients:{CLIENT_ID}:remittances:{REMITTANCE_ID}:pending
)

send [BRL/2 15000] (
  source = @clients:{CLIENT_ID}:br:bank
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
          title: 'Pending Wire (Client Funds)',
          description: 'BRL awaiting delivery - still tracked as client funds',
          queryType: 'balance',
          addressFilter: 'clients:{CLIENT_ID}:remittances:{REMITTANCE_ID}:pending',
        },
        {
          title: 'Client BRL Remaining',
          description: 'Should be zero after wire + fee',
          queryType: 'balance',
          addressFilter: 'clients:{CLIENT_ID}:br:bank',
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
      description: 'Recipient (Supplier ABC Ltda) receives BRL - remittance complete',
      numscript: `send [BRL/2 5424100] (
  source = @clients:{CLIENT_ID}:remittances:{REMITTANCE_ID}:pending
  destination = @world
)

set_tx_meta("type", "WIRE_SETTLED")
set_tx_meta("remittance_id", "{REMITTANCE_ID}")
set_tx_meta("client_id", "{CLIENT_ID}")
set_tx_meta("bank_ref", "TED-789012")
set_tx_meta("status", "DELIVERED")`,
      queries: [
        {
          title: 'Complete Remittance Journey (7 of 7)',
          description: 'Full audit trail: USD→USDT→BRL→delivered - all tracked by remittance_id',
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
      title: 'All Client Funds (Philippines)',
      description: 'USD + USDT held for all clients at PH',
      queryType: 'balance',
      addressFilter: 'clients::ph:',
    },
    {
      title: 'All Client Funds (Brazil)',
      description: 'USDT + BRL held for all clients at BR',
      queryType: 'balance',
      addressFilter: 'clients::br:',
    },
    {
      title: 'Pending Intercompany (USDT)',
      description: 'USDT in transit to Brazil - not yet settled',
      queryType: 'balance',
      addressFilter: 'clients::br:fireblocks:pending',
    },
    {
      title: 'Pending Wires (All Clients)',
      description: 'All client BRL pending wire delivery',
      queryType: 'balance',
      addressFilter: 'clients::remittances::pending',
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
      title: 'Track by Client',
      description: 'All transactions for a specific client',
      queryType: 'transactions',
      transactionFilter: {
        metadata: { client_id: '{CLIENT_ID}' },
      },
    },
    {
      title: 'This Client - All Accounts',
      description: 'All custody accounts for this client',
      queryType: 'accounts',
      accountAddress: 'clients:{CLIENT_ID}:',
    },
  ],
};

/**
 * KEY PATTERNS DEMONSTRATED:
 *
 * 1. Per-Customer Custody (Always Know Whose Money)
 *    - @clients:{CLIENT_ID}:ph:bank - Client USD at Philippines bank
 *    - @clients:{CLIENT_ID}:ph:fireblocks - Client USDT at Philippines
 *    - @clients:{CLIENT_ID}:br:fireblocks:pending - Client USDT in transit
 *    - @clients:{CLIENT_ID}:br:fireblocks - Client USDT settled at Brazil
 *    - @clients:{CLIENT_ID}:br:bank - Client BRL at Brazil bank
 *    - Query all clients: clients::ph:fireblocks (total PH Fireblocks)
 *
 * 2. Intercompany Transfer via @world
 *    - PH Fireblocks → @world (USDT leaves Philippines custody)
 *    - @world → BR Fireblocks:pending (USDT enters Brazil pending)
 *    - BR Fireblocks:pending → BR Fireblocks (settlement)
 *
 * 3. Two-Leg FX Conversion with Metadata
 *    - USD → USDT at Philippines (spread = revenue)
 *    - USDT → BRL at Brazil (OTC rate)
 *    - Each conversion has its own exchange account
 *
 * 4. Wire with Per-Client Pending State
 *    - @clients:{CLIENT_ID}:br:bank → pending remittance account
 *    - Pending remittance → @world (delivered to external recipient)
 */
