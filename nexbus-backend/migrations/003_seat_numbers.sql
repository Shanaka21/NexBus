-- Bookings now record exactly which seats were picked (1..trip.reservable_seats), not just a count.
-- seat_count stays as a column (reports/stats already read it) but is now derived from seat_numbers'
-- length server-side rather than taken from client input.
ALTER TABLE bookings ADD COLUMN seat_numbers integer[] NOT NULL DEFAULT '{}';
