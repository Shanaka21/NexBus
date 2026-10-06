// Turns a place name that is not one of our bus stops ("Jaffna", "Katunayake airport") into coordinates.
// Google's Geocoding API is used when GOOGLE_MAPS_API_KEY works (it needs billing enabled on the Google Cloud
// project); otherwise OpenStreetMap's free Nominatim service answers. Both are limited to Sri Lanka.

async function google(place, timeoutMs) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.search = new URLSearchParams({ address: place, components: 'country:LK', key }).toString();
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  const data = await res.json();
  const hit = data.status === 'OK' ? data.results[0] : null; // REQUEST_DENIED etc. -> try the next provider
  return hit ? { lat: hit.geometry.location.lat, lng: hit.geometry.location.lng, label: hit.formatted_address, source: 'google' } : null;
}

async function nominatim(place, timeoutMs) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.search = new URLSearchParams({ q: place, format: 'jsonv2', limit: '1', countrycodes: 'lk' }).toString();
  const res = await fetch(url, {
    headers: { 'User-Agent': 'NexBus/1.0 (bus planning student project)' }, // required by Nominatim's usage policy
    signal: AbortSignal.timeout(timeoutMs)
  });
  const hit = (await res.json())[0];
  return hit ? { lat: Number(hit.lat), lng: Number(hit.lon), label: hit.display_name, source: 'openstreetmap' } : null;
}

// Returns { lat, lng, label, source } or null when the place cannot be found
async function geocode(place, timeoutMs = 2000) {
  for (const provider of [google, nominatim]) {
    try {
      const found = await provider(place, timeoutMs);
      if (found) return found;
    } catch {
      /* provider down or timed out: try the next one */
    }
  }
  return null;
}

module.exports = { geocode };
