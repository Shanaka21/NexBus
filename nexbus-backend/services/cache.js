// Tiny in-memory cache with in-flight de-duplication.
// Many clients poll the same live data; one database read serves all of them for a few seconds.
// Kept close to the driver's GPS interval so the live map does not lag far behind the bus.
const store = new Map();

const TTL_MS = Number(process.env.LIVE_CACHE_TTL_MS || 1000);

async function cached(key, fn, ttlMs = TTL_MS) {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.promise;
  const promise = fn();
  store.set(key, { at: Date.now(), promise });
  try {
    return await promise;
  } catch (err) {
    store.delete(key); // never cache a failure
    throw err;
  }
}

// Called after rare, important changes (trip started/finished/created, booking seats) so they show up immediately
function invalidate(prefix = '') {
  for (const key of store.keys()) if (key.startsWith(prefix)) store.delete(key);
}

module.exports = { cached, invalidate, TTL_MS };
