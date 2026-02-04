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
        address: '@interco:ph:debt',
        name: 'Intercompany (owed to PH)',
        description: 'What Brazil owes Philippines for USDT transfers',
        color: 'purple',
      },
      {
        address: '@exchanges:{EXCHANGE_ID}',
        name: 'FX Exchange',
        description: 'Per-conversion account - stores rate, amounts in metadata',
        color: 'purple',
      },
      {
        address: '@banks:bradesco:operating',
        name: 'Bradesco Operating',
        description: 'BRL operating account in Brazil',
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
        description: 'Philippines sends client USDT to Brazil Fireblocks - pending settlement',
        numscript: `send [USDT/6 9980000000] (
  source = @clients:{CLIENT_ID}:ph:fireblocks
  destination = @clients:{CLIENT_ID}:br:fireblocks:pending
)

send [USDT/6 9980000000] (
  source = @world
  destination = @interco:ph:debt
)

set_tx_meta("type", "INTERCO_INITIATED")
set_tx_meta("remittance_id", "{REMITTANCE_ID}")
set_tx_meta("client_id", "{CLIENT_ID}")
set_tx_meta("from_entity", "coins_ph")
set_tx_meta("to_entity", "coins_br")
set_tx_meta("status", "PENDING")`,
        queries: [
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
          {
            title: 'Intercompany Debt',
            description: 'What Brazil owes Philippines',
            queryType: 'balance',
            addressFilter: 'interco:ph:debt',
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
        ],
      },
      {
        txType: 'USDT_TO_BRL',
        label: 'Brazil Sells USDT → BRL',
        description: 'Sell client USDT via OTC at 5.45 BRL rate',
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
  destination = @banks:bradesco:operating
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
        description: 'Initiate BRL wire to Supplier ABC Ltda, R$150 fee',
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
        title: 'All Client Funds (Philippines)',
        description: 'USD + USDT held for all clients at PH',
        queryType: 'balance',
        addressFilter: 'clients::ph:',
      },
      {
        title: 'All Client Funds (Brazil)',
        description: 'USDT held for all clients at BR (pending + settled)',
        queryType: 'balance',
        addressFilter: 'clients::br:',
      },
      {
        title: 'Pending Intercompany',
        description: 'USDT in transit to Brazil',
        queryType: 'balance',
        addressFilter: 'clients::br:fireblocks:pending',
      },
      {
        title: 'Intercompany Debt',
        description: 'What Brazil owes Philippines',
        queryType: 'balance',
        addressFilter: 'interco:ph:debt',
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
      {
        title: 'This Client - All Accounts',
        description: 'All custody accounts for this client',
        queryType: 'accounts',
        accountAddress: 'clients:{CLIENT_ID}:',
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
  rain: {
    name: 'Rain',
    description: 'Money-In: Fiat to stablecoin on-ramp via virtual accounts',
    accounts: [
      {
        address: '@world',
        name: 'External',
        description: 'Money entering or leaving the system',
        color: 'slate',
      },
      {
        address: '@partners:{PARTNER_ID}:customers:{CUSTOMER_ID}:virtual:usd',
        name: 'Customer Virtual Account',
        description: 'Customer USD virtual account (pending deposits)',
        color: 'blue',
      },
      {
        address: '@partners:{PARTNER_ID}:customers:{CUSTOMER_ID}:bank:usd',
        name: 'Customer USD (Settled)',
        description: 'Customer USD settled at Rain bank',
        color: 'blue',
      },
      {
        address: '@partners:{PARTNER_ID}:customers:{CUSTOMER_ID}:wallet:usdc',
        name: 'Customer USDC Wallet',
        description: 'Customer USDC balance - ready for cards/payouts',
        color: 'green',
      },
      {
        address: '@exchanges:{CONVERSION_ID}',
        name: 'FX Conversion',
        description: 'Per-conversion account with rate metadata',
        color: 'purple',
      },
      {
        address: '@treasury:circle:usdc',
        name: 'Circle Treasury',
        description: 'Rain USDC treasury at Circle',
        color: 'orange',
      },
      {
        address: '@platform:revenue:conversion',
        name: 'Conversion Revenue',
        description: 'Fees earned on fiat→USDC conversions',
        color: 'orange',
      },
      {
        address: '@platform:revenue:partner:{PARTNER_ID}',
        name: 'Partner Revenue Share',
        description: 'Revenue share allocated to partner',
        color: 'orange',
      },
    ],
    variables: {
      PARTNER_ID: 'acmewallet',
      CUSTOMER_ID: 'cust001',
      CONVERSION_ID: 'conv001',
      DEPOSIT_REF: 'dep001',
    },
    transactionSteps: [
      {
        txType: 'VIRTUAL_ACCOUNT_CREATED',
        label: 'Partner Creates Virtual Account',
        description: 'Acme Wallet (partner) provisions a USD virtual account for their customer via API',
        numscript: `set_account_meta(@partners:{PARTNER_ID}:customers:{CUSTOMER_ID}:virtual:usd, "partner_id", "{PARTNER_ID}")
set_account_meta(@partners:{PARTNER_ID}:customers:{CUSTOMER_ID}:virtual:usd, "customer_id", "{CUSTOMER_ID}")
set_account_meta(@partners:{PARTNER_ID}:customers:{CUSTOMER_ID}:virtual:usd, "account_number", "8901234567")
set_account_meta(@partners:{PARTNER_ID}:customers:{CUSTOMER_ID}:virtual:usd, "routing_number", "021000021")
set_account_meta(@partners:{PARTNER_ID}:customers:{CUSTOMER_ID}:virtual:usd, "status", "ACTIVE")
set_account_meta(@partners:{PARTNER_ID}:customers:{CUSTOMER_ID}:virtual:usd, "created_at", "2024-01-15T10:00:00Z")

set_tx_meta("type", "VIRTUAL_ACCOUNT_CREATED")
set_tx_meta("partner_id", "{PARTNER_ID}")
set_tx_meta("customer_id", "{CUSTOMER_ID}")`,
        queries: [
          {
            title: 'Virtual Account Created',
            description: 'Account metadata shows routing/account numbers',
            queryType: 'account',
            accountAddress: 'partners:{PARTNER_ID}:customers:{CUSTOMER_ID}:virtual:usd',
          },
          {
            title: 'All Virtual Accounts (This Partner)',
            description: 'All customer virtual accounts for Acme Wallet',
            queryType: 'accounts',
            accountAddress: 'partners:{PARTNER_ID}:customers:',
          },
        ],
      },
      {
        txType: 'DEPOSIT_INITIATED',
        label: 'Customer Initiates Wire',
        description: 'Customer sends $50,000 USD wire to their Rain virtual account',
        numscript: `send [USD/2 5000000] (
  source = @world
  destination = @partners:{PARTNER_ID}:customers:{CUSTOMER_ID}:virtual:usd
)

set_tx_meta("type", "DEPOSIT_INITIATED")
set_tx_meta("partner_id", "{PARTNER_ID}")
set_tx_meta("customer_id", "{CUSTOMER_ID}")
set_tx_meta("deposit_ref", "{DEPOSIT_REF}")
set_tx_meta("rail", "WIRE")
set_tx_meta("sender_name", "John Smith")
set_tx_meta("sender_bank", "Chase")
set_tx_meta("amount", "$50,000 USD")
set_tx_meta("status", "PENDING")`,
        queries: [
          {
            title: 'Customer Pending Deposit',
            description: 'USD in virtual account awaiting settlement',
            queryType: 'balance',
            addressFilter: 'partners:{PARTNER_ID}:customers:{CUSTOMER_ID}:virtual:usd',
          },
          {
            title: 'All Pending Deposits (Platform)',
            description: 'Total pending deposits across all partners',
            queryType: 'balance',
            addressFilter: 'partners::customers::virtual:usd',
          },
        ],
      },
      {
        txType: 'DEPOSIT_SETTLED',
        label: 'Deposit Settles at Bank',
        description: 'Wire clears - funds now in Rain\'s bank under customer name',
        numscript: `send [USD/2 5000000] (
  source = @partners:{PARTNER_ID}:customers:{CUSTOMER_ID}:virtual:usd
  destination = @partners:{PARTNER_ID}:customers:{CUSTOMER_ID}:bank:usd
)

set_tx_meta("type", "DEPOSIT_SETTLED")
set_tx_meta("partner_id", "{PARTNER_ID}")
set_tx_meta("customer_id", "{CUSTOMER_ID}")
set_tx_meta("deposit_ref", "{DEPOSIT_REF}")
set_tx_meta("bank_ref", "FED-2024011500123")
set_tx_meta("status", "SETTLED")`,
        queries: [
          {
            title: 'Customer USD Balance',
            description: 'Settled USD ready for conversion',
            queryType: 'balance',
            addressFilter: 'partners:{PARTNER_ID}:customers:{CUSTOMER_ID}:bank:usd',
          },
          {
            title: 'All Settled USD (This Partner)',
            description: 'Total settled USD for Acme Wallet customers',
            queryType: 'balance',
            addressFilter: 'partners:{PARTNER_ID}:customers::bank:usd',
          },
        ],
      },
      {
        txType: 'CONVERSION_EXECUTED',
        label: 'Convert USD → USDC',
        description: 'Rain converts $50,000 USD to 49,925 USDC (0.15% fee). Uses exchange pattern with Circle.',
        numscript: `send [USD/2 5000000] (
  source = @partners:{PARTNER_ID}:customers:{CUSTOMER_ID}:bank:usd
  destination = @exchanges:{CONVERSION_ID}
)

send [USD/2 4992500] (
  source = @exchanges:{CONVERSION_ID}
  destination = @world
)

send [USDC/6 49925000000] (
  source = @world
  destination = @exchanges:{CONVERSION_ID}
)

send [USDC/6 49925000000] (
  source = @exchanges:{CONVERSION_ID}
  destination = @partners:{PARTNER_ID}:customers:{CUSTOMER_ID}:wallet:usdc
)

send [USD/2 7500] (
  source = @exchanges:{CONVERSION_ID}
  destination = @platform:revenue:conversion
)

set_account_meta(@exchanges:{CONVERSION_ID}, "type", "USD_USDC")
set_account_meta(@exchanges:{CONVERSION_ID}, "rate", "1.0000")
set_account_meta(@exchanges:{CONVERSION_ID}, "usd_in", "50000")
set_account_meta(@exchanges:{CONVERSION_ID}, "usdc_out", "49925")
set_account_meta(@exchanges:{CONVERSION_ID}, "fee_usd", "75")
set_account_meta(@exchanges:{CONVERSION_ID}, "fee_percent", "0.15")
set_account_meta(@exchanges:{CONVERSION_ID}, "partner_id", "{PARTNER_ID}")
set_account_meta(@exchanges:{CONVERSION_ID}, "customer_id", "{CUSTOMER_ID}")
set_account_meta(@exchanges:{CONVERSION_ID}, "executed_at", "2024-01-15T10:05:00Z")

set_tx_meta("type", "CONVERSION_EXECUTED")
set_tx_meta("conversion_id", "{CONVERSION_ID}")
set_tx_meta("partner_id", "{PARTNER_ID}")
set_tx_meta("customer_id", "{CUSTOMER_ID}")
set_tx_meta("rate", "1.0000")
set_tx_meta("fee_percent", "0.15")`,
        queries: [
          {
            title: 'Customer USDC Wallet',
            description: 'USDC now available for cards/payouts',
            queryType: 'balance',
            addressFilter: 'partners:{PARTNER_ID}:customers:{CUSTOMER_ID}:wallet:usdc',
          },
          {
            title: 'Platform Conversion Revenue',
            description: 'Fees earned on this conversion',
            queryType: 'balance',
            addressFilter: 'platform:revenue:conversion',
          },
          {
            title: 'Conversion Details',
            description: 'Exchange account with rate and fee metadata',
            queryType: 'account',
            accountAddress: 'exchanges:{CONVERSION_ID}',
          },
        ],
      },
      {
        txType: 'PARTNER_REVENUE_SHARE',
        label: 'Partner Revenue Share',
        description: 'Rain shares 20% of conversion fee ($15) with partner Acme Wallet',
        numscript: `send [USD/2 1500] (
  source = @platform:revenue:conversion
  destination = @platform:revenue:partner:{PARTNER_ID}
)

set_tx_meta("type", "PARTNER_REVENUE_SHARE")
set_tx_meta("partner_id", "{PARTNER_ID}")
set_tx_meta("conversion_id", "{CONVERSION_ID}")
set_tx_meta("share_percent", "20")
set_tx_meta("amount", "$15 USD")`,
        queries: [
          {
            title: 'Partner Revenue Balance',
            description: 'Revenue share accumulated for Acme Wallet',
            queryType: 'balance',
            addressFilter: 'platform:revenue:partner:{PARTNER_ID}',
          },
          {
            title: 'Net Platform Revenue',
            description: 'Platform revenue after partner share',
            queryType: 'balance',
            addressFilter: 'platform:revenue:conversion',
          },
          {
            title: 'All Partner Revenue Shares',
            description: 'Revenue shares across all partners',
            queryType: 'balance',
            addressFilter: 'platform:revenue:partner:',
          },
        ],
      },
      {
        txType: 'CARD_AUTHORIZATION',
        label: 'Customer Uses Card',
        description: 'Customer spends $500 equivalent at merchant using Rain card',
        numscript: `send [USDC/6 500000000] (
  source = @partners:{PARTNER_ID}:customers:{CUSTOMER_ID}:wallet:usdc
  destination = @world
)

set_tx_meta("type", "CARD_AUTHORIZATION")
set_tx_meta("partner_id", "{PARTNER_ID}")
set_tx_meta("customer_id", "{CUSTOMER_ID}")
set_tx_meta("merchant", "Amazon")
set_tx_meta("mcc", "5411")
set_tx_meta("amount", "$500 USD equivalent")
set_tx_meta("card_last_four", "4242")
set_tx_meta("auth_code", "A12345")`,
        queries: [
          {
            title: 'Customer USDC After Spend',
            description: 'Updated wallet balance after card purchase',
            queryType: 'balance',
            addressFilter: 'partners:{PARTNER_ID}:customers:{CUSTOMER_ID}:wallet:usdc',
          },
          {
            title: 'Customer Journey',
            description: 'All transactions for this customer',
            queryType: 'transactions',
            transactionFilter: {
              metadata: { customer_id: '{CUSTOMER_ID}' },
            },
          },
          {
            title: 'All Card Authorizations',
            description: 'All card transactions across platform',
            queryType: 'transactions',
            transactionFilter: {
              metadata: { type: 'CARD_AUTHORIZATION' },
            },
          },
        ],
      },
    ],
    usefulQueries: [
      {
        title: 'All Customer Wallets (Platform)',
        description: 'Total USDC across all customers',
        queryType: 'balance',
        addressFilter: 'partners::customers::wallet:usdc',
      },
      {
        title: 'All Customer Wallets (This Partner)',
        description: 'Total USDC for Acme Wallet customers',
        queryType: 'balance',
        addressFilter: 'partners:{PARTNER_ID}:customers::wallet:usdc',
      },
      {
        title: 'Pending Deposits (Platform)',
        description: 'All pending virtual account deposits',
        queryType: 'balance',
        addressFilter: 'partners::customers::virtual:',
      },
      {
        title: 'Settled USD (Platform)',
        description: 'All settled USD awaiting conversion',
        queryType: 'balance',
        addressFilter: 'partners::customers::bank:usd',
      },
      {
        title: 'Platform Revenue',
        description: 'Total conversion fees collected',
        queryType: 'balance',
        addressFilter: 'platform:revenue:conversion',
      },
      {
        title: 'All Partner Revenue Shares',
        description: 'Revenue allocated to partners',
        queryType: 'balance',
        addressFilter: 'platform:revenue:partner:',
      },
      {
        title: 'All Conversions',
        description: 'FX conversion accounts with metadata',
        queryType: 'accounts',
        accountAddress: 'exchanges:',
      },
      {
        title: 'This Customer - All Accounts',
        description: 'All accounts for this customer',
        queryType: 'accounts',
        accountAddress: 'partners:{PARTNER_ID}:customers:{CUSTOMER_ID}:',
      },
      {
        title: 'This Partner - All Customers',
        description: 'All customer accounts under Acme Wallet',
        queryType: 'accounts',
        accountAddress: 'partners:{PARTNER_ID}:customers:',
      },
      {
        title: 'Track by Partner',
        description: 'All transactions for this partner',
        queryType: 'transactions',
        transactionFilter: {
          metadata: { partner_id: '{PARTNER_ID}' },
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
