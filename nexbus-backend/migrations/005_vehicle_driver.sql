-- The driver an operator has assigned to a bus. Trips scheduled on the bus are given to this driver,
-- so the driver's app lists only the schedules of the bus they were assigned to.
ALTER TABLE vehicles ADD COLUMN driver_id text REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX idx_vehicles_driver_id ON vehicles(driver_id);
