-- Passenger wallet: balance is topped up through PayHere and spent on bookings.
-- Every balance change writes a wallet_transactions row; the unique (type, reference) index makes
-- a repeated PayHere notification or a second cancel unable to credit/refund twice.

ALTER TABLE users ADD COLUMN wallet_balance_lkr numeric(12,2) NOT NULL DEFAULT 0 CHECK (wallet_balance_lkr >= 0);

-- 'booking' = pays for a booking (booking_id set); 'wallet_topup' = adds money to the wallet (booking_id null)
ALTER TABLE payments ADD COLUMN purpose text NOT NULL DEFAULT 'booking';

CREATE TABLE wallet_transactions (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id),
  type text NOT NULL, -- topup | booking_payment | refund
  amount_lkr numeric(12,2) NOT NULL, -- signed: positive adds to the balance, negative spends it
  balance_after numeric(12,2) NOT NULL,
  reference text NOT NULL, -- payments.id for topup, bookings.id for booking_payment / refund
  note text,
  created_at bigint NOT NULL
);
CREATE INDEX idx_wallet_tx_user_created ON wallet_transactions(user_id, created_at DESC);
CREATE UNIQUE INDEX uq_wallet_tx_type_reference ON wallet_transactions(type, reference);
