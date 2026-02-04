/**
 * Rain Demo Configuration
 *
 * Money-In: Fiat → Stablecoin On-Ramp
 *
 * Rain enables platforms to convert local currency to stablecoins via virtual accounts.
 * B2B infrastructure - they serve fintechs, neobanks, and enterprises.
 *
 * Flow:
 * 1. Partner allocates virtual account to their customer
 * 2. Customer deposits fiat (USD/EUR/etc.) to virtual account
 * 3. Deposit settles at Rain's bank
 * 4. Rain converts fiat → USDC (exchange pattern)
 * 5. USDC credited to customer's Rain wallet
 * 6. Customer can now use for cards, payouts, etc.
 *
 * Key: Per-customer custody + partner/customer hierarchy
 */

export const rainConfig = {
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
};

/**
 * KEY PATTERNS DEMONSTRATED:
 *
 * 1. Partner/Customer Hierarchy
 *    - @partners:{PARTNER_ID}:customers:{CUSTOMER_ID}:...
 *    - Enables queries at partner level or platform level
 *    - Example: partners::customers::wallet:usdc = all USDC platform-wide
 *    - Example: partners:acmewallet:customers::wallet:usdc = Acme's customers only
 *
 * 2. Virtual Account → Settlement → Conversion Flow
 *    - virtual:usd = pending deposits (not yet at bank)
 *    - bank:usd = settled at Rain's bank
 *    - wallet:usdc = converted and ready to use
 *
 * 3. Exchange Pattern for USD → USDC
 *    - No "allowing unbounded overdraft"
 *    - Bidirectional swap with @world
 *    - Fee captured in exchange account
 *
 * 4. B2B Revenue Model
 *    - Platform takes conversion fee
 *    - Partner gets revenue share
 *    - Tracked separately: @platform:revenue:partner:{PARTNER_ID}
 *
 * 5. Per-Customer Custody
 *    - Always know whose money: @partners:X:customers:Y:wallet:usdc
 *    - Aggregation queries for reconciliation
 */
