# Common Flow Patterns

Reusable transaction patterns for common financial operations.

---

## Deposits & Top-ups

### Simple Deposit (Instant Credit)
```numscript
vars {
  monetary $amount
  account $user
}

send $amount (
  source = @world
  destination = $user
)
```

### Deposit with Processing Fee
```numscript
vars {
  monetary $amount
  account $user
}

send $amount (
  source = @world
  destination = {
    2.5% to @platform:fees:processing
    remaining to $user
  }
)
```

### PSP Authorization (Credit Before Settlement)
```numscript
vars {
  monetary $amount
  account $user
  account $psp
}

// Credit user immediately from PSP authorization
send $amount (
  source = $psp allowing unbounded overdraft
  destination = $user
)
```

---

## Withdrawals & Payouts

### Simple Withdrawal
```numscript
vars {
  monetary $amount
  account $user
}

send $amount (
  source = $user
  destination = @world
)
```

### Full Balance Withdrawal
```numscript
vars {
  account $user
}

send [USD/2 *] (
  source = $user
  destination = @banks:main:withdrawal
)
```

### Withdrawal with Pending State
```numscript
vars {
  monetary $amount
  account $user
  string $reference
}

// Step 1: Move to pending
send $amount (
  source = $user
  destination = @users:pending:$reference
)

// Step 2 (separate transaction after bank confirms): Release
send [USD/2 *] (
  source = @users:pending:$reference
  destination = @world
)
```

---

## Fees & Revenue

### Flat Fee
```numscript
vars {
  account $user
}

send [USD/2 100] (
  source = $user
  destination = @platform:fees
)
```

### Percentage Fee on Transaction
```numscript
vars {
  monetary $amount
  account $from
  account $to
}

send $amount (
  source = $from
  destination = {
    2% to @platform:fees
    remaining to $to
  }
)
```

### Tiered Fees (Cap + Percentage)
```numscript
vars {
  monetary $amount
  account $from
  account $to
}

send $amount (
  source = $from
  destination = {
    max [USD/2 500] to @platform:fees  // Cap at $5
    remaining to $to
  }
)
```

---

## Marketplace / Multi-Party

### Buyer to Seller with Platform Commission
```numscript
vars {
  monetary $amount
  account $buyer
  account $seller
}

send $amount (
  source = $buyer
  destination = {
    10% to @platform:commission
    remaining to $seller
  }
)
```

### Escrow Flow

**Step 1: Buyer funds escrow**
```numscript
vars {
  monetary $amount
  account $buyer
  string $order_id
}

send $amount (
  source = $buyer
  destination = @escrow:$order_id
)
```

**Step 2: Release to seller**
```numscript
vars {
  account $seller
  string $order_id
}

send [USD/2 *] (
  source = @escrow:$order_id
  destination = {
    10% to @platform:commission
    remaining to $seller
  }
)
```

**Alternative: Refund to buyer**
```numscript
vars {
  account $buyer
  string $order_id
}

send [USD/2 *] (
  source = @escrow:$order_id
  destination = $buyer
)
```

---

## Holds & Two-Phase Commits

### Create Hold
```numscript
vars {
  monetary $amount
  account $user
  string $hold_id
}

send $amount (
  source = $user
  destination = @holds:$hold_id
)
```

### Confirm Hold (Capture)
```numscript
vars {
  string $hold_id
  account $merchant
}

send [USD/2 *] (
  source = @holds:$hold_id
  destination = $merchant
)
```

### Void Hold (Release)
```numscript
vars {
  string $hold_id
  account $user
}

send [USD/2 *] (
  source = @holds:$hold_id
  destination = $user
)
```

### Partial Capture
```numscript
vars {
  monetary $capture_amount
  string $hold_id
  account $merchant
  account $user
}

// Capture partial
send $capture_amount (
  source = @holds:$hold_id
  destination = $merchant
)

// Return remainder
send [USD/2 *] (
  source = @holds:$hold_id
  destination = $user
)
```

---

## Settlements & Reconciliation

### PSP Settlement (Net)
```numscript
vars {
  monetary $gross_amount
  monetary $psp_fees
  account $psp
}

// Bank receives net, platform absorbs fees
send $gross_amount (
  source = @banks:main
  destination = {
    $psp_fees to @platform:fees:interchange
    remaining to $psp
  }
)
```

### Bank Statement Reconciliation Entry
```numscript
vars {
  monetary $amount
  string $statement_ref
}

send $amount (
  source = @world
  destination = @banks:chase:main
)

set_tx_meta("statement_reference", $statement_ref)
set_tx_meta("reconciliation_type", "bank_statement")
```

---

## Refunds & Reversals

### Full Refund
```numscript
vars {
  account $user
  account $merchant
  monetary $amount
}

send $amount (
  source = $merchant
  destination = $user
)
```

### Refund via PSP (Chargeback)
```numscript
vars {
  account $user
  account $psp
  monetary $amount
  monetary $chargeback_fee
}

// Debit user
send $amount (
  source = $user allowing overdraft up to $amount
  destination = $psp
)

// Platform absorbs chargeback fee
send $chargeback_fee (
  source = @platform:expenses:chargebacks
  destination = $psp
)
```

---

## Multi-Currency

### Currency Conversion
```numscript
vars {
  monetary $source_amount    // e.g., [EUR/2 1000]
  monetary $dest_amount      // e.g., [USD/2 1100]
  account $user
}

// Debit EUR
send $source_amount (
  source = $user
  destination = @platform:fx:eur
)

// Credit USD
send $dest_amount (
  source = @platform:fx:usd
  destination = $user
)
```

---

## Stablecoin Operations

### Mint (Fiat → Stablecoin)
```numscript
vars {
  monetary $fiat_amount      // [USD/2 10000]
  monetary $token_amount     // [USDC/6 10000000000]
  account $user
}

// Fiat to reserves
send $fiat_amount (
  source = @psp:stripe allowing unbounded overdraft
  destination = @banks:reserve:main
)

// Mint tokens to user
send $token_amount (
  source = @blockchain:eth:mint
  destination = $user
)
```

### Burn (Stablecoin → Fiat)
```numscript
vars {
  monetary $token_amount
  monetary $fiat_amount
  account $user
}

// Burn tokens
send $token_amount (
  source = $user
  destination = @blockchain:eth:burn
)

// Release fiat
send $fiat_amount (
  source = @banks:reserve:main
  destination = @banks:withdrawal:$user
)
```

---

## Related
- [[Numscript Quick Reference]]
- [[Demo - Payment Acceptance]]
- [[Demo - Stablecoin Operations]]
- [[Demo - Omnibus Accounts]]
