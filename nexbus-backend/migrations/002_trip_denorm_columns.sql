-- trips denormalizes a few fields from routes/vehicles/drivers (matches the original Firestore trip
-- document shape) so hot read paths (live map, arrivals) don't need extra joins.
ALTER TABLE trips ADD COLUMN route_number text;
ALTER TABLE trips ADD COLUMN registration_no text;
ALTER TABLE trips ADD COLUMN driver_name text;
