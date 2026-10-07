-- A 4-digit boarding code per booking. The passenger sees it on their booking card and reads it out; the driver
-- types it in the driver app, which names the passenger and seats it belongs to (boarded_at records the check).
ALTER TABLE bookings ADD COLUMN boarding_code text;
ALTER TABLE bookings ADD COLUMN boarded_at bigint;

-- Existing bookings: a code that is distinct within their trip (37 is coprime with 10000)
UPDATE bookings b SET boarding_code = lpad(((n.rn * 37 + 1000) % 10000)::text, 4, '0')
FROM (SELECT id, row_number() OVER (PARTITION BY trip_id ORDER BY created_at, id) AS rn FROM bookings) n
WHERE n.id = b.id;

-- Within a trip, a code identifies exactly one live booking
CREATE UNIQUE INDEX idx_bookings_trip_boarding_code ON bookings(trip_id, boarding_code)
  WHERE status IN ('pending_payment', 'confirmed');
