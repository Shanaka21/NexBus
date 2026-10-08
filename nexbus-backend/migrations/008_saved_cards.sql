-- Cards a passenger has used to top up the wallet. Only what PayHere reports back about the card is kept:
-- brand, the last 4 digits, the holder name and the expiry. The full card number never reaches NexBus.

CREATE TABLE saved_cards (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id),
  brand text NOT NULL,
  last4 text NOT NULL CHECK (last4 ~ '^[0-9]{4}$'),
  holder_name text,
  expiry text, -- MM/YY as reported by PayHere
  source_payment_id text,
  created_at bigint NOT NULL,
  last_used_at bigint NOT NULL
);
CREATE UNIQUE INDEX uq_saved_cards_user_card ON saved_cards(user_id, brand, last4);
