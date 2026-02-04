import { useSearchParams } from 'react-router';
import { useMemo } from 'react';

export type DemoStep = {
  txType: string;
  label: string;
  description?: string;
  // Numscript to execute for this step (with placeholders like {CUSTOMER_ID})
  numscript?: string;
  // Queries to show after this step is executed
  queries?: UsefulQuery[];
};

export type UsefulQuery = {
  title: string;
  description: string;
  // Query type determines how to fetch and display results
  queryType: 'balance' | 'transactions' | 'account' | 'accounts';
  // For balance queries - the address pattern to aggregate (single)
  addressFilter?: string;
  // For balance queries - multiple address patterns combined with $or
  addressFilters?: string[];
  // For account/accounts queries - the address or pattern
  accountAddress?: string;
  // For transactions - filter by account or metadata
  transactionFilter?: {
    account?: string;
    metadata?: Record<string, string>;
  };
  // Legacy format (deprecated)
  endpoint?: string;
  method?: string;
};

export type DemoAccount = {
  address: string;
  name: string;
  description: string;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'slate';
};

export type DemoConfig = {
  name: string;
  description: string;
  // Accounts used in this demo with descriptions
  accounts: DemoAccount[];
  // Legacy - kept for backwards compatibility
  accountGroups?: { name: string; pattern: string; color?: string }[];
  transactionSteps: DemoStep[];
  // Variables used across all steps
  variables?: Record<string, string>;
  // Useful queries to show at the end
  usefulQueries?: UsefulQuery[];
};

// Demo configurations keyed by ledger metadata `demo` value
const DEMO_CONFIGS: Record<string, DemoConfig> = {
  sportsbet: {
    name: 'Sportsbet',
    description:
      'Customer wallet lifecycle: deposit → wager → win/lose → withdraw',
    accounts: [
      {
        address: '@world',
        name: 'External World',
        description: 'Represents money entering or leaving the system (deposits from banks, withdrawals to banks)',
        color: 'slate',
      },
      {
        address: '@platform:float',
        name: 'House Bankroll',
        description: 'Platform funds used to pay out winning bets - the "house" money',
        color: 'green',
      },
      {
        address: '@customers:{CUSTOMER_ID}:deposits:pending',
        name: 'Pending Deposits',
        description: 'Holds customer funds while payment is being confirmed',
        color: 'blue',
      },
      {
        address: '@customers:{CUSTOMER_ID}:available',
        name: 'Available Balance',
        description: 'Funds the customer can use to place bets (from confirmed deposits)',
        color: 'blue',
      },
      {
        address: '@customers:{CUSTOMER_ID}:withdrawable',
        name: 'Withdrawable Balance',
        description: 'Winnings and funds eligible for withdrawal to bank account',
        color: 'blue',
      },
      {
        address: '@customers:{CUSTOMER_ID}:pending:wager',
        name: 'Pending Wager',
        description: 'Funds locked while a bet is in progress (returned if won, forfeited if lost)',
        color: 'purple',
      },
      {
        address: '@payments:withdrawals:pending',
        name: 'Pending Withdrawals',
        description: 'Funds being processed for withdrawal to customer bank account',
        color: 'orange',
      },
    ],
    variables: {
      CUSTOMER_ID: '12345',
      WAGER_ID: 'WGR-001',
      WITHDRAWAL_ID: 'WDR-001',
    },
    transactionSteps: [
      {
        txType: 'FLOAT_SEED',
        label: 'Seed Platform Float',
        description: 'Initialize $10,000 house bankroll for payouts',
        numscript: `send [AUD/2 1000000] (
  source = @world
  destination = @platform:float
)

set_tx_meta("type", "FLOAT_SEED")
set_tx_meta("note", "Initial house bankroll")`,
        queries: [
          {
            title: 'Platform Float',
            description: 'House bankroll now seeded and ready for payouts',
            queryType: 'balance',
            addressFilter: 'platform:float',
          },
        ],
      },
      {
        txType: 'DEPOSIT_INITIATED',
        label: 'Deposit Initiated',
        description: 'Customer deposits $100 via card (pending state)',
        numscript: `send [AUD/2 10000] (
  source = @world
  destination = @customers:{CUSTOMER_ID}:deposits:pending
)

set_tx_meta("type", "DEPOSIT_INITIATED")
set_tx_meta("customer_id", "{CUSTOMER_ID}")
set_tx_meta("payment_method", "CARD")
set_tx_meta("amount", "$100.00")`,
        queries: [
          {
            title: 'All Pending Deposits (Platform-Wide)',
            description: 'Aggregate of all customers with pending deposits',
            queryType: 'balance',
            addressFilter: 'customers::deposits:pending',
          },
          {
            title: 'Customer Journey: Deposits',
            description: 'All deposit transactions for this customer',
            queryType: 'transactions',
            transactionFilter: {
              metadata: { customer_id: '{CUSTOMER_ID}', type: 'DEPOSIT_INITIATED' },
            },
          },
        ],
      },
      {
        txType: 'DEPOSIT_CONFIRMED',
        label: 'Deposit Confirmed',
        description: 'Payment confirmed - funds now available for wagering',
        numscript: `send [AUD/2 10000] (
  source = @customers:{CUSTOMER_ID}:deposits:pending
  destination = @customers:{CUSTOMER_ID}:available
)

set_tx_meta("type", "DEPOSIT_CONFIRMED")
set_tx_meta("customer_id", "{CUSTOMER_ID}")`,
        queries: [
          {
            title: 'Total Customer Value',
            description: 'All funds across available + pending + withdrawable accounts',
            queryType: 'balance',
            addressFilters: [
              'customers:{CUSTOMER_ID}:available',
              'customers:{CUSTOMER_ID}:deposits:pending',
              'customers:{CUSTOMER_ID}:pending:wager',
              'customers:{CUSTOMER_ID}:withdrawable',
            ],
          },
          {
            title: 'Customer Journey So Far',
            description: 'All transactions for this customer (filtered by metadata)',
            queryType: 'transactions',
            transactionFilter: {
              metadata: { customer_id: '{CUSTOMER_ID}' },
            },
          },
        ],
      },
      {
        txType: 'WAGER_PLACED',
        label: 'Place Wager',
        description: 'Customer places $20 bet at 2.50 odds (potential $50 payout)',
        numscript: `send [AUD/2 2000] (
  source = {
    @customers:{CUSTOMER_ID}:available
    @customers:{CUSTOMER_ID}:withdrawable
  }
  destination = @customers:{CUSTOMER_ID}:pending:wager
)

set_tx_meta("type", "WAGER_PLACED")
set_tx_meta("customer_id", "{CUSTOMER_ID}")
set_tx_meta("wager_id", "{WAGER_ID}")
set_tx_meta("event", "AFL Grand Final 2026")
set_tx_meta("odds", "2.50")
set_tx_meta("potential_payout", "$50.00")`,
        queries: [
          {
            title: 'Total Locked in Wagers (Platform-Wide)',
            description: 'All customer funds locked in active bets',
            queryType: 'balance',
            addressFilter: 'customers::pending:wager',
          },
          {
            title: 'Customer Fund Breakdown',
            description: 'Available vs locked - shows how customer funds are allocated',
            queryType: 'balance',
            addressFilters: [
              'customers:{CUSTOMER_ID}:available',
              'customers:{CUSTOMER_ID}:pending:wager',
              'customers:{CUSTOMER_ID}:withdrawable',
            ],
          },
          {
            title: 'All Wagers for This Customer',
            description: 'Transaction history filtered by wager type',
            queryType: 'transactions',
            transactionFilter: {
              metadata: { customer_id: '{CUSTOMER_ID}', type: 'WAGER_PLACED' },
            },
          },
        ],
      },
      {
        txType: 'WAGER_WON',
        label: 'Wager Won!',
        description: 'Customer wins! $20 stake returned + $30 profit from house float',
        numscript: `send [AUD/2 2000] (
  source = @customers:{CUSTOMER_ID}:pending:wager
  destination = @customers:{CUSTOMER_ID}:withdrawable
)

send [AUD/2 3000] (
  source = @platform:float
  destination = @customers:{CUSTOMER_ID}:withdrawable
)

set_tx_meta("type", "WAGER_WON")
set_tx_meta("customer_id", "{CUSTOMER_ID}")
set_tx_meta("wager_id", "{WAGER_ID}")
set_tx_meta("stake", "$20.00")
set_tx_meta("payout", "$50.00")
set_tx_meta("profit", "$30.00")`,
        queries: [
          {
            title: 'Total Customer Value (Post-Win)',
            description: 'Aggregate of all customer funds after winning',
            queryType: 'balance',
            addressFilters: [
              'customers:{CUSTOMER_ID}:available',
              'customers:{CUSTOMER_ID}:pending:wager',
              'customers:{CUSTOMER_ID}:withdrawable',
            ],
          },
          {
            title: 'Platform Float Impact',
            description: 'House bankroll after paying out winnings',
            queryType: 'balance',
            addressFilter: 'platform:float',
          },
          {
            title: 'Customer Wagering History',
            description: 'All wager outcomes for this customer',
            queryType: 'transactions',
            transactionFilter: {
              metadata: { customer_id: '{CUSTOMER_ID}' },
            },
          },
          {
            title: 'All Customer Accounts',
            description: 'List all sub-accounts with their current state',
            queryType: 'accounts',
            accountAddress: 'customers:{CUSTOMER_ID}:',
          },
        ],
      },
      {
        txType: 'WITHDRAWAL_INITIATED',
        label: 'Withdrawal Initiated',
        description: 'Customer requests $50 withdrawal to bank account',
        numscript: `send [AUD/2 5000] (
  source = @customers:{CUSTOMER_ID}:withdrawable
  destination = @payments:withdrawals:pending
)

set_tx_meta("type", "WITHDRAWAL_INITIATED")
set_tx_meta("customer_id", "{CUSTOMER_ID}")
set_tx_meta("withdrawal_id", "{WITHDRAWAL_ID}")
set_tx_meta("method", "Bank Transfer")
set_tx_meta("amount", "$50.00")`,
        queries: [
          {
            title: 'All Pending Withdrawals (Platform-Wide)',
            description: 'Aggregate of all withdrawal requests being processed',
            queryType: 'balance',
            addressFilter: 'payments:withdrawals:pending',
          },
          {
            title: 'Customer Withdrawal Requests',
            description: 'All withdrawal transactions for this customer',
            queryType: 'transactions',
            transactionFilter: {
              metadata: { customer_id: '{CUSTOMER_ID}', type: 'WITHDRAWAL_INITIATED' },
            },
          },
        ],
      },
      {
        txType: 'WITHDRAWAL_SETTLED',
        label: 'Withdrawal Settled',
        description: 'Funds sent to customer bank account',
        numscript: `send [AUD/2 5000] (
  source = @payments:withdrawals:pending
  destination = @world
)

set_tx_meta("type", "WITHDRAWAL_SETTLED")
set_tx_meta("customer_id", "{CUSTOMER_ID}")
set_tx_meta("withdrawal_id", "{WITHDRAWAL_ID}")
set_tx_meta("bank_ref", "NPP-123456")`,
        queries: [
          {
            title: 'Final Customer Balance',
            description: 'Total funds remaining after withdrawal',
            queryType: 'balance',
            addressFilters: [
              'customers:{CUSTOMER_ID}:available',
              'customers:{CUSTOMER_ID}:deposits:pending',
              'customers:{CUSTOMER_ID}:pending:wager',
              'customers:{CUSTOMER_ID}:withdrawable',
            ],
          },
          {
            title: 'Complete Customer Journey',
            description: 'Full transaction history: deposit → wager → win → withdrawal',
            queryType: 'transactions',
            transactionFilter: {
              metadata: { customer_id: '{CUSTOMER_ID}' },
            },
          },
          {
            title: 'All Customer Accounts',
            description: 'Final state of all customer sub-accounts',
            queryType: 'accounts',
            accountAddress: 'customers:{CUSTOMER_ID}:',
          },
          {
            title: 'Platform Liabilities',
            description: 'All customer funds held by platform (total liability)',
            queryType: 'balance',
            addressFilter: 'customers:',
          },
        ],
      },
    ],
    // General queries available in the Explore section
    usefulQueries: [
      {
        title: 'Platform Total Liabilities',
        description: 'Sum of ALL customer funds held by the platform (using address pattern)',
        queryType: 'balance',
        addressFilter: 'customers:',
      },
      {
        title: 'Customer Total Value',
        description: 'This customer\'s total funds using $or aggregation',
        queryType: 'balance',
        addressFilters: [
          'customers:{CUSTOMER_ID}:available',
          'customers:{CUSTOMER_ID}:deposits:pending',
          'customers:{CUSTOMER_ID}:pending:wager',
          'customers:{CUSTOMER_ID}:withdrawable',
        ],
      },
      {
        title: 'Platform-Wide Locked Wagers',
        description: 'All customer funds currently locked in active bets',
        queryType: 'balance',
        addressFilter: 'customers::pending:wager',
      },
      {
        title: 'Platform Float',
        description: 'House bankroll available for payouts',
        queryType: 'balance',
        addressFilter: 'platform:float',
      },
      {
        title: 'Customer Journey by Metadata',
        description: 'Track deposit → wager → withdrawal using metadata filters',
        queryType: 'transactions',
        transactionFilter: {
          metadata: { customer_id: '{CUSTOMER_ID}' },
        },
      },
      {
        title: 'All Deposits Today',
        description: 'Filter transactions by type metadata',
        queryType: 'transactions',
        transactionFilter: {
          metadata: { type: 'DEPOSIT_INITIATED' },
        },
      },
      {
        title: 'All Winning Wagers',
        description: 'Filter transactions by outcome',
        queryType: 'transactions',
        transactionFilter: {
          metadata: { type: 'WAGER_WON' },
        },
      },
      {
        title: 'All Customer Accounts',
        description: 'List all accounts matching customer pattern',
        queryType: 'accounts',
        accountAddress: 'customers:{CUSTOMER_ID}:',
      },
    ],
  },
  'coins-ph': {
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
  },
  monetae: {
    name: 'Monetae',
    description: 'Fiat custody + stablecoin conversion for wealth tech. Central bank checks 1:1 backing every 5 minutes.',
    accounts: [
      {
        address: '@world',
        name: 'External',
        description: 'Money entering/leaving the system',
        color: 'slate',
      },
      {
        address: '@banks:centralbank:pending:{ACH_REF}',
        name: 'Pending ACH',
        description: 'ACH deposits in transit (not yet customer funds)',
        color: 'green',
      },
      {
        address: '@customers:{CUSTOMER_ID}:centralbank',
        name: 'Customer Fiat (Central Bank)',
        description: 'User USD held at central bank',
        color: 'blue',
      },
      {
        address: '@customers:{CUSTOMER_ID}:fireblocks:hot',
        name: 'Customer USDC (Fireblocks)',
        description: 'User USDC in Fireblocks custody',
        color: 'orange',
      },
      {
        address: '@customers:{CUSTOMER_ID}',
        name: 'Customer Portfolio',
        description: 'User tokenized assets (TSLA, etc.)',
        color: 'blue',
      },
      {
        address: '@exchanges:{CONVERSION_ID}',
        name: 'FX Exchange Account',
        description: 'Tracks USD→USDC conversion with rate metadata',
        color: 'purple',
      },
      {
        address: '@exchanges:{INVESTMENT_ID}',
        name: 'Investment Exchange Account',
        description: 'Tracks USDC→TSLA exchange with metadata',
        color: 'purple',
      },
      {
        address: '@platform:revenue',
        name: 'Platform Revenue',
        description: 'Fees collected on conversions and trades',
        color: 'purple',
      },
    ],
    variables: {
      CUSTOMER_ID: '001',
      ACH_REF: 'ach:001',
      CONVERSION_ID: 'conv:001',
      INVESTMENT_ID: 'inv:001',
    },
    transactionSteps: [
      {
        txType: 'ACH_INITIATED',
        label: 'User Initiates ACH Deposit',
        description: 'User deposits $10,000 via ACH. Funds pending until settlement.',
        numscript: `send [USD/2 1000000] (
  source = @world
  destination = @banks:centralbank:pending:{ACH_REF}
)

set_tx_meta("type", "ACH_INITIATED")
set_tx_meta("customer", "{CUSTOMER_ID}")
set_tx_meta("ach_ref", "{ACH_REF}")`,
        queries: [
          {
            title: 'Pending ACH',
            description: 'Deposit awaiting settlement',
            queryType: 'balance',
            addressFilter: 'banks:centralbank:pending:{ACH_REF}',
          },
        ],
      },
      {
        txType: 'ACH_SETTLED',
        label: 'ACH Settles',
        description: 'ACH clears. Funds now in central bank under customer name.',
        numscript: `send [USD/2 1000000] (
  source = @banks:centralbank:pending:{ACH_REF}
  destination = @customers:{CUSTOMER_ID}:centralbank
)

set_tx_meta("type", "ACH_SETTLED")
set_tx_meta("customer", "{CUSTOMER_ID}")
set_tx_meta("ach_ref", "{ACH_REF}")`,
        queries: [
          {
            title: 'Customer Fiat Balance',
            description: 'User USD at central bank',
            queryType: 'balance',
            addressFilter: 'customers:{CUSTOMER_ID}:centralbank',
          },
          {
            title: '1:1 Backing Check (All Customers)',
            description: 'Total fiat at central bank = SUM of all customer:centralbank',
            queryType: 'balance',
            addressFilter: 'customers::centralbank',
          },
        ],
      },
      {
        txType: 'FIAT_TO_USDC',
        label: 'Convert Fiat to USDC',
        description: 'User converts $5,000 USD to 4,990 USDC via exchange. The swap happens between exchange account and @world.',
        numscript: `send [USD/2 500000] (
  source = @customers:{CUSTOMER_ID}:centralbank
  destination = @exchanges:{CONVERSION_ID}
)

send [USD/2 499000] (
  source = @exchanges:{CONVERSION_ID}
  destination = @world
)

send [USDC/6 4990000000] (
  source = @world
  destination = @exchanges:{CONVERSION_ID}
)

send [USDC/6 4990000000] (
  source = @exchanges:{CONVERSION_ID}
  destination = @customers:{CUSTOMER_ID}:fireblocks:hot
)

send [USD/2 1000] (
  source = @exchanges:{CONVERSION_ID}
  destination = @platform:revenue
)

set_tx_meta("type", "FIAT_TO_USDC")
set_tx_meta("customer", "{CUSTOMER_ID}")
set_tx_meta("conversion_id", "{CONVERSION_ID}")

set_account_meta(@exchanges:{CONVERSION_ID}, "type", "USD_USDC")
set_account_meta(@exchanges:{CONVERSION_ID}, "rate", "0.998")
set_account_meta(@exchanges:{CONVERSION_ID}, "usd_in", "5000")
set_account_meta(@exchanges:{CONVERSION_ID}, "usdc_out", "4990")`,
        queries: [
          {
            title: 'Customer Fireblocks Balance',
            description: 'USDC now in custody',
            queryType: 'balance',
            addressFilter: 'customers:{CUSTOMER_ID}:fireblocks:hot',
          },
          {
            title: 'Customer Fiat Balance (After)',
            description: 'Reduced by conversion amount',
            queryType: 'balance',
            addressFilter: 'customers:{CUSTOMER_ID}:centralbank',
          },
          {
            title: '1:1 Backing Check',
            description: 'Total fiat still matches central bank',
            queryType: 'balance',
            addressFilter: 'customers::centralbank',
          },
          {
            title: 'Fireblocks Total (All Customers)',
            description: 'Total USDC across all customers',
            queryType: 'balance',
            addressFilter: 'customers::fireblocks:hot',
          },
        ],
      },
      {
        txType: 'INVESTMENT_PURCHASE',
        label: 'User Buys Tokenized Stock',
        description: 'User invests 2,000 USDC in tokenized Tesla (5 shares). Exchange swaps USDC for TSLA via @world.',
        numscript: `send [USDC/6 2000000000] (
  source = @customers:{CUSTOMER_ID}:fireblocks:hot
  destination = @exchanges:{INVESTMENT_ID}
)

send [USDC/6 1990000000] (
  source = @exchanges:{INVESTMENT_ID}
  destination = @world
)

send [TSLA/4 50000] (
  source = @world
  destination = @exchanges:{INVESTMENT_ID}
)

send [TSLA/4 50000] (
  source = @exchanges:{INVESTMENT_ID}
  destination = @customers:{CUSTOMER_ID}
)

send [USDC/6 10000000] (
  source = @exchanges:{INVESTMENT_ID}
  destination = @platform:revenue
)

set_tx_meta("type", "INVESTMENT_PURCHASE")
set_tx_meta("customer", "{CUSTOMER_ID}")
set_tx_meta("investment_id", "{INVESTMENT_ID}")
set_tx_meta("asset", "TSLA")
set_tx_meta("shares", "5")
set_tx_meta("price_per_share", "400")
set_tx_meta("fee_percent", "0.5")

set_account_meta(@exchanges:{INVESTMENT_ID}, "type", "USDC_TSLA")
set_account_meta(@exchanges:{INVESTMENT_ID}, "usdc_in", "2000")
set_account_meta(@exchanges:{INVESTMENT_ID}, "tsla_out", "5")`,
        queries: [
          {
            title: 'Customer Portfolio',
            description: 'Now holds TSLA tokens',
            queryType: 'balance',
            addressFilter: 'customers:{CUSTOMER_ID}',
          },
          {
            title: 'Customer Fireblocks (After)',
            description: 'USDC reduced by investment + fee',
            queryType: 'balance',
            addressFilter: 'customers:{CUSTOMER_ID}:fireblocks:hot',
          },
          {
            title: 'Platform Revenue',
            description: 'Fees from conversion + investment',
            queryType: 'balance',
            addressFilter: 'platform:revenue',
          },
        ],
      },
    ],
    usefulQueries: [
      {
        title: '1:1 Backing: Central Bank Total',
        description: 'All customer fiat at central bank (compare with actual bank balance)',
        queryType: 'balance',
        addressFilter: 'customers::centralbank',
      },
      {
        title: 'Fireblocks Total',
        description: 'All customer USDC in Fireblocks (compare with Fireblocks API)',
        queryType: 'balance',
        addressFilter: 'customers::fireblocks:hot',
      },
      {
        title: 'This Customer - Fiat',
        description: 'Customer USD at central bank',
        queryType: 'balance',
        addressFilter: 'customers:{CUSTOMER_ID}:centralbank',
      },
      {
        title: 'This Customer - USDC',
        description: 'Customer USDC in Fireblocks',
        queryType: 'balance',
        addressFilter: 'customers:{CUSTOMER_ID}:fireblocks:hot',
      },
      {
        title: 'This Customer - Portfolio',
        description: 'Customer tokenized assets',
        queryType: 'balance',
        addressFilter: 'customers:{CUSTOMER_ID}',
      },
      {
        title: 'Platform Revenue',
        description: 'Fees collected on conversions + trades',
        queryType: 'balance',
        addressFilter: 'platform:revenue',
      },
      {
        title: 'All Conversions',
        description: 'Exchange accounts with rate metadata',
        queryType: 'accounts',
        accountAddress: 'exchanges:',
      },
      {
        title: 'Customer Journey',
        description: 'All transactions for this customer',
        queryType: 'transactions',
        transactionFilter: {
          metadata: { customer: '{CUSTOMER_ID}' },
        },
      },
    ],
  },
};

export function useDemoMode(ledgerMetadata?: Record<string, string>) {
  const [searchParams] = useSearchParams();

  const isDemoMode = searchParams.get('demo') === 'true';

  // Get demo config from ledger metadata
  const demoConfig = useMemo(() => {
    if (!isDemoMode) return null;

    // Try to get config from ledger metadata
    if (ledgerMetadata) {
      const demoType = ledgerMetadata.demo as string | undefined;
      if (demoType && DEMO_CONFIGS[demoType]) {
        return DEMO_CONFIGS[demoType];
      }
    }

    // Return a generic "Demo Mode Active" config when no specific config found
    return {
      name: 'Demo Mode',
      description: 'Demo mode is active. Add "demo" key to ledger metadata for guided walkthrough.',
      accounts: [],
      transactionSteps: [],
    } as DemoConfig;
  }, [isDemoMode, ledgerMetadata]);

  return {
    isDemoMode,
    demoConfig,
  };
}

export function getDemoConfigForType(demoType: string): DemoConfig | null {
  return DEMO_CONFIGS[demoType] || null;
}

// Helper to replace variables in numscript
export function interpolateNumscript(
  numscript: string,
  variables: Record<string, string>
): string {
  let result = numscript;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}

export { DEMO_CONFIGS };
