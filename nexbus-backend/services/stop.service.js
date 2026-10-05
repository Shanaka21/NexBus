const crypto = require('crypto');
const { pool } = require('../config/db');
const { AppError } = require('../utils/errors');
const eta = require('./eta.service');

let stopCache = { at: 0, map: new Map() };
const CACHE_MS = 60 * 1000;

async function allStops() {
  if (Date.now() - stopCache.at < CACHE_MS) return stopCache.map;
  const { rows } = await pool.query('SELECT * FROM bus_stops');
  stopCache = {
    at: Date.now(),
    map: new Map(rows.map((r) => [r.id, { id: r.id, name: r.name, name_si: r.name_si, latitude: r.latitude, longitude: r.longitude, created_at: Number(r.created_at) }]))
  };
  return stopCache.map;
}

const invalidateStops = () => { stopCache = { at: 0, map: new Map() }; };

// Joins the stop ids on a route with the stop master data.
async function routeStops(route) {
  const stops = await allStops();
  return (route.stops || [])
    .slice()
    .sort((a, b) => a.sequence_no - b.sequence_no)
    .map(s => {
      const stop = stops.get(s.stop_id) || {};
      return {
        stopId: s.stop_id,
        name: stop.name || s.stop_id,
        nameSi: stop.name_si || '',
        lat: stop.latitude,
        lng: stop.longitude,
        sequenceNo: s.sequence_no,
        distanceFromOriginKm: s.distance_from_origin_km
      };
    });
}

async function listStops({ near, limit } = {}) {
  const stops = [...(await allStops()).values()];
  if (!near) return stops.sort((a, b) => a.name.localeCompare(b.name));
  const [lat, lng] = near;
  return stops
    .map(s => ({ ...s, distance_km: Number(eta.haversine({ lat, lng }, { lat: s.latitude, lng: s.longitude }).toFixed(2)) }))
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, limit || 5);
}

async function createStop({ name, name_si, latitude, longitude }) {
  const id = crypto.randomUUID();
  const now = Date.now();
  await pool.query(
    'INSERT INTO bus_stops (id, name, name_si, latitude, longitude, created_at) VALUES ($1,$2,$3,$4,$5,$6)',
    [id, name, name_si || '', latitude, longitude, now]
  );
  invalidateStops();
  return { id, name, name_si: name_si || '', latitude, longitude, created_at: now };
}

async function getStop(id) {
  const stop = (await allStops()).get(id);
  if (!stop) throw new AppError(404, 'STOP_NOT_FOUND', 'Stop not found');
  return stop;
}

module.exports = { allStops, routeStops, listStops, createStop, getStop, invalidateStops };
