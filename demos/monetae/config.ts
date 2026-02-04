/**
 * Monetae Demo Configuration
 *
 * Fiat Custody + Stablecoin Conversion for Wealth Tech
 * Central bank checks 1:1 backing every 5 minutes
 *
 * To use: Add this config to the Formance Console's useDemoMode.ts
 */

export const monetaeConfig = {
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
      name: 'Exchange Account',
      description: 'Tracks FX conversion with rate metadata',
      color: 'purple',
    },
    {
      address: '@platform:revenue',
      name: 'Platform Revenue',
      description: 'Fees collected on conversions and trades',
      color: 'purple',
    },
    {
      address: '@platform:investments',
      name: 'Platform Investments',
      description: 'Investment pool (receives USDC, issues tokenized assets)',
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
};

/**
 * KEY PATTERNS DEMONSTRATED:
 *
 * 1. NO Separate Omnibus Account
 *    - Derive totals from customer accounts: @customers::centralbank
 *    - No double counting!
 *
 * 2. Per-Customer Custody (Both Fiat and Crypto)
 *    - @customers:001:centralbank (fiat at central bank)
 *    - @customers:001:fireblocks:hot (USDC in Fireblocks)
 *    - @customers:001 (tokenized assets)
 *
 * 3. Exchange Pattern (Bidirectional Swap with @world)
 *    - @exchanges:conv:001 with rate metadata
 *    - Swap: exchange sends USD to @world, receives USDC from @world
 *    - Then distributes USDC to customer and fee to platform
 *
 * 4. @world Never Needs "allowing unbounded overdraft"
 *    - It already has unlimited overdraft by default
 *    - Will error if you specify it!
 *
 * 5. Multi-Asset Accounts
 *    - @platform:investments holds USDC and issues TSLA
 *    - One account, multiple assets
 */
