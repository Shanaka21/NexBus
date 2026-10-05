-- NexBus initial Postgres schema (replaces Firestore).
-- Timestamps that the app treats as raw epoch-ms numbers (created_at, scheduled_departure, hold_expires_at,
-- last_update_at, etc.) are stored as BIGINT, matching the existing Date.now()-based arithmetic exactly.
-- service_date stays TEXT ('YYYY-MM-DD', Asia/Colombo) since the app only ever does equality/IN comparisons on it.

CREATE TABLE operators (
  id text PRIMARY KEY,
  name text NOT NULL,
  registration_no text NOT NULL UNIQUE,
  contact_phone text,
  email text,
  status text NOT NULL DEFAULT 'active',
  created_at bigint NOT NULL
);

CREATE TABLE users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text,
  full_name text,
  phone text,
  role text NOT NULL,
  operator_id text REFERENCES operators(id),
  status text NOT NULL DEFAULT 'active',
  preferred_language text NOT NULL DEFAULT 'en',
  region text,
  push_token text,
  google_sub text,
  token_version integer NOT NULL DEFAULT 0,
  created_at bigint NOT NULL,
  updated_at bigint
);
CREATE INDEX idx_users_operator_id ON users(operator_id);
CREATE INDEX idx_users_role ON users(role);

CREATE TABLE password_resets (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id),
  token_hash text NOT NULL UNIQUE,
  created_at bigint NOT NULL,
  expires_at bigint NOT NULL,
  used_at bigint
);

CREATE TABLE refresh_tokens (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id),
  token_hash text NOT NULL UNIQUE,
  created_at bigint NOT NULL,
  expires_at bigint NOT NULL,
  revoked_at bigint
);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);

CREATE TABLE bus_stops (
  id text PRIMARY KEY,
  name text NOT NULL,
  name_si text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  created_at bigint NOT NULL
);

CREATE TABLE routes (
  id text PRIMARY KEY,
  route_number text NOT NULL,
  route_name text,
  start_point text,
  end_point text,
  via text,
  service_type text NOT NULL DEFAULT 'normal',
  base_fare_lkr numeric NOT NULL,
  distance_km numeric,
  estimated_duration_min integer,
  status text NOT NULL DEFAULT 'active',
  created_at bigint NOT NULL
);

CREATE TABLE route_stops (
  route_id text NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  stop_id text NOT NULL REFERENCES bus_stops(id),
  sequence_no integer NOT NULL,
  distance_from_origin_km numeric NOT NULL,
  PRIMARY KEY (route_id, stop_id)
);
CREATE INDEX idx_route_stops_route_id ON route_stops(route_id, sequence_no);

CREATE TABLE vehicles (
  id text PRIMARY KEY, -- registration number
  operator_id text REFERENCES operators(id),
  route_id text REFERENCES routes(id),
  seat_capacity integer NOT NULL,
  reservable_seats integer NOT NULL DEFAULT 0,
  booked_seats integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  current_trip_id text,
  delay_minutes integer NOT NULL DEFAULT 0,
  last_latitude double precision,
  last_longitude double precision,
  last_speed_kmh double precision,
  last_update_at bigint,
  created_at bigint NOT NULL
);
CREATE INDEX idx_vehicles_operator_id ON vehicles(operator_id);

CREATE TABLE trips (
  id text PRIMARY KEY,
  route_id text REFERENCES routes(id),
  vehicle_id text REFERENCES vehicles(id),
  operator_id text REFERENCES operators(id),
  driver_id text REFERENCES users(id),
  scheduled_departure bigint NOT NULL,
  service_date text NOT NULL,
  actual_departure bigint,
  direction text NOT NULL DEFAULT 'outbound',
  status text NOT NULL DEFAULT 'scheduled',
  delay_minutes integer NOT NULL DEFAULT 0,
  reservable_seats integer NOT NULL DEFAULT 0,
  available_seats integer NOT NULL DEFAULT 0,
  last_latitude double precision,
  last_longitude double precision,
  last_update_at bigint,
  recent_fixes jsonb NOT NULL DEFAULT '[]',
  created_at bigint NOT NULL
);
CREATE INDEX idx_trips_route_status_dep ON trips(route_id, status, scheduled_departure);
CREATE INDEX idx_trips_service_date_status ON trips(service_date, status);
CREATE INDEX idx_trips_operator_id ON trips(operator_id);
CREATE INDEX idx_trips_driver_id ON trips(driver_id);

CREATE TABLE bookings (
  id text PRIMARY KEY,
  booking_reference text,
  user_id text NOT NULL REFERENCES users(id),
  trip_id text REFERENCES trips(id),
  route_id text,
  route_number text,
  vehicle_id text,
  operator_id text,
  boarding_stop_id text REFERENCES bus_stops(id),
  alighting_stop_id text REFERENCES bus_stops(id),
  from_name text,
  to_name text,
  seat_count integer NOT NULL DEFAULT 1,
  fare_amount_lkr numeric,
  status text NOT NULL,
  payment_status text NOT NULL DEFAULT 'unpaid',
  hold_expires_at bigint,
  scheduled_departure bigint,
  created_at bigint NOT NULL,
  cancelled_at bigint,
  refund_required boolean NOT NULL DEFAULT false
);
CREATE INDEX idx_bookings_user_created ON bookings(user_id, created_at DESC);
CREATE INDEX idx_bookings_trip_status ON bookings(trip_id, status);
CREATE INDEX idx_bookings_status_hold ON bookings(status, hold_expires_at);
CREATE INDEX idx_bookings_operator_created ON bookings(operator_id, created_at);

CREATE TABLE payments (
  id text PRIMARY KEY, -- PayHere order_id
  booking_id text REFERENCES bookings(id),
  user_id text REFERENCES users(id),
  operator_id text,
  amount_lkr numeric NOT NULL,
  currency text NOT NULL DEFAULT 'LKR',
  payment_status text NOT NULL DEFAULT 'pending',
  status_code integer,
  gateway_payment_id text,
  method text,
  created_at bigint NOT NULL,
  updated_at bigint,
  needs_review boolean NOT NULL DEFAULT false
);
CREATE INDEX idx_payments_booking_id ON payments(booking_id);
CREATE INDEX idx_payments_operator_created ON payments(operator_id, created_at);

CREATE TABLE notifications (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id),
  type text,
  title text,
  message text,
  related_trip_id text,
  related_booking_id text,
  is_read boolean NOT NULL DEFAULT false,
  created_at bigint NOT NULL
);
CREATE INDEX idx_notifications_user_id ON notifications(user_id, created_at DESC);

CREATE TABLE location_logs (
  id bigserial PRIMARY KEY,
  vehicle_id text,
  trip_id text,
  latitude double precision,
  longitude double precision,
  speed_kmh double precision,
  heading double precision,
  accuracy_m double precision,
  recorded_at bigint NOT NULL
);
CREATE INDEX idx_location_logs_recorded_at ON location_logs(recorded_at);

CREATE TABLE system_logs (
  id bigserial PRIMARY KEY,
  user_id text,
  action text NOT NULL,
  entity text,
  entity_id text,
  details jsonb,
  severity text NOT NULL DEFAULT 'info',
  created_at bigint NOT NULL
);
CREATE INDEX idx_system_logs_created_at ON system_logs(created_at DESC);
