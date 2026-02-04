# Numscript Quick Reference

Quick reference for Numscript syntax when building demos.

---

## Program Structure

```numscript
// 1. Variables (optional)
vars {
  monetary $amount
  account $user
  string $reference
}

// 2. Send statements
send [USD/2 100] (
  source = @world
  destination = @users:123
)

// 3. Metadata statements (optional)
set_tx_meta("reference", $reference)
```

---

## Send Statement

### Basic Syntax
```numscript
send [ASSET AMOUNT] (
  source = @source_account
  destination = @destination_account
)
```

### Asset Notation
```numscript
[USD/2 1000]    // $10.00 (1000 cents, 2 decimal places)
[EUR/2 500]     // €5.00
[BTC/8 100000000]  // 1 BTC (8 decimal places)
[COIN 100]      // 100 units (no decimals)
```

### Transfer Entire Balance
```numscript
send [USD/2 *] (
  source = @order:123
  destination = @merchant:456
)
```

---

## Sources

### Single Source
```numscript
source = @users:123
```

### @world (Unbounded Overdraft)
Use for money entering the system:
```numscript
source = @world
```

### Ordered Sources (Sequential)
Draw from accounts in order until amount is satisfied:
```numscript
source = {
  @users:123:bonus
  @users:123:main
}
```

### With Max Limits
```numscript
source = {
  max [USD/2 500] from @users:123:bonus
  @users:123:main
}
```

### Portioned Sources
Split withdrawal across accounts:
```numscript
source = {
  50% from @account_a
  50% from @account_b
}
```

---

## Destinations

### Single Destination
```numscript
destination = @merchants:456
```

### Portioned (Splits)
```numscript
destination = {
  2.5% to @platform:fees
  remaining to @merchants:456
}
```

### With Fractions
```numscript
destination = {
  1/10 to @platform:fees
  9/10 to @merchants:456
}
```

### Ordered with Caps
```numscript
destination = {
  max [USD/2 1000] to @escrow:123
  remaining to @users:456
}
```

### Kept (Stay in Source)
```numscript
destination = {
  10% to @platform:fees
  remaining kept
}
```

---

## Overdraft

### Unbounded (No Limit)
```numscript
send [USD/2 100] (
  source = @psp:stripe allowing unbounded overdraft
  destination = @users:123
)
```

### Bounded (With Limit)
```numscript
send [USD/2 100] (
  source = @users:123 allowing overdraft up to [USD/2 50]
  destination = @merchants:456
)
```

---

## Variables

### Declaration
```numscript
vars {
  monetary $amount         // e.g., [USD/2 1000]
  account $user            // e.g., @users:123
  account $merchant        // e.g., @merchants:456
  asset $currency          // e.g., USD/2
  portion $fee_rate        // e.g., 2.5% or 25/1000
  number $order_id         // e.g., 12345
  string $reference        // e.g., "ORD-123"
}
```

### Usage
```numscript
vars {
  monetary $amount
  account $from
  account $to
}

send $amount (
  source = $from
  destination = $to
)
```

### Passed at Execution
```json
{
  "script": {
    "plain": "...",
    "vars": {
      "amount": {"amount": 1000, "asset": "USD/2"},
      "from": "@users:123",
      "to": "@merchants:456"
    }
  }
}
```

---

## Metadata

### Read Account Metadata
```numscript
vars {
  account $coupon
}

monetary $value = meta($coupon, "coupon_value")
```

Metadata format on account:
```json
{
  "coupon_value": {
    "type": "monetary",
    "value": {"amount": 1000, "asset": "USD/2"}
  }
}
```

### Set Transaction Metadata
```numscript
set_tx_meta("order_id", $order_id)
set_tx_meta("fee_amount", [USD/2 25])
set_tx_meta("reference", "ORD-123")
```

### Set Account Metadata
```numscript
set_account_meta($user, "last_transaction", $reference)
set_account_meta(@platform:fees, "total_collected", [USD/2 5000])
```

---

## Complete Examples

### Simple Transfer
```numscript
send [USD/2 1000] (
  source = @users:alice
  destination = @users:bob
)
```

### Deposit with Fee
```numscript
vars {
  monetary $amount
  account $user
}

send $amount (
  source = @world
  destination = {
    2.5% to @platform:fees
    remaining to $user
  }
)
```

### Withdrawal to Bank
```numscript
vars {
  account $user
  string $reference
}

send [USD/2 *] (
  source = $user
  destination = @banks:chase:withdrawal
)

set_tx_meta("bank_reference", $reference)
```

### Multi-Party Split (Marketplace)
```numscript
vars {
  monetary $amount
  account $seller
}

send $amount (
  source = @world
  destination = {
    3% to @platform:commission
    remaining to $seller
  }
)
```

### Ordered Source (Use Bonus First)
```numscript
vars {
  monetary $amount
  account $user_bonus
  account $user_main
  account $merchant
}

send $amount (
  source = {
    $user_bonus
    $user_main
  }
  destination = $merchant
)
```

---

## Common Patterns

| Pattern | Code |
|---------|------|
| External deposit | `source = @world` |
| External withdrawal | `destination = @world` |
| Full balance transfer | `send [ASSET *]` |
| Percentage fee | `2.5% to @platform:fees` |
| Remaining after fees | `remaining to @merchant` |
| PSP authorization | `source = @psp:stripe allowing unbounded overdraft` |
| Sequential deduction | `source = { @bonus @main }` |

---

## Related
- [[Demo Building Overview]]
- [[Account Naming Conventions]]
- [[Common Flow Patterns]]
