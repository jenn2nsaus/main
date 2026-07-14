// Runs inside the GitHub Action. Reads the submitted fields from
// client_payload (a real nested object this time — sent by a Stepper
// "Code" step using fetch() + JSON.stringify(), not the flat HTTP Request
// body editor), geocodes the address with LocationIQ, and appends the new
// pin to data/locations.json.

const fs = require('fs');
const path = require('path');
const https = require('https');

const DATA_PATH = path.join(__dirname, '..', 'data', 'locations.json');

const name = process.env.LOCATION_NAME || 'A neighbor';
const address = process.env.LOCATION_ADDRESS;
const hours = process.env.LOCATION_HOURS || '';
const treats = process.env.LOCATION_TREATS || '';
const allergensRaw = process.env.LOCATION_ALLERGENS || '';
const description = process.env.LOCATION_DESCRIPTION || '';

// Allergens display as individual badges — split on comma/semicolon
// regardless of whether the source was a single code or several joined.
const allergens = allergensRaw
  .split(/[,;]/)
  .map((s) => s.trim())
  .filter(Boolean);

// Roughly covers the Central Coast NSW LGA, Woy Woy up to Budgewoi.
// Format is left,top,right,bottom (lon_min,lat_max,lon_max,lat_min).
const VIEWBOX = '151.15,-33.15,151.50,-33.65';

if (!address) {
  console.error('No address was provided in the dispatch payload. Aborting.');
  process.exit(1);
}

// Nominatim (OpenStreetMap's free geocoder) explicitly prohibits automated/CI
// use, and blocks shared cloud IP ranges like GitHub Actions runners — which
// is why this was failing with "Access denied" regardless of the address.
// LocationIQ's free tier (5,000 requests/day) is built for exactly this kind
// of automated use, and mirrors Nominatim's request/response format closely.
const LOCATIONIQ_KEY = process.env.LOCATIONIQ_KEY;

if (!LOCATIONIQ_KEY) {
  console.error('LOCATIONIQ_KEY is not set. Add it as a repository secret.');
  process.exit(1);
}

function geocode(query) {
  const params = new URLSearchParams({
    key: LOCATIONIQ_KEY,
    q: query,
    format: 'json',
    limit: '1',
    countrycodes: 'au',
    viewbox: VIEWBOX,
  });

  const options = {
    hostname: 'us1.locationiq.com',
    path: `/v1/search?${params.toString()}`,
    headers: {
      'User-Agent': 'trick-or-treat-map (community project; contact: you@example.com)',
    },
  };

  return new Promise((resolve, reject) => {
    https
      .get(options, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            console.error(`Geocoding request failed with status ${res.statusCode}:`, body.slice(0, 300));
            resolve([]);
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (err) {
            console.error('Geocoding response was not valid JSON:', body.slice(0, 300));
            resolve([]);
          }
        });
      })
      .on('error', reject);
  });
}

// Some submissions use a hyphenated street number range (e.g. "51-52 The
// Esplanade") for a duplex or multi-unit property. OSM/Nominatim almost
// always only has individual street numbers indexed, so a range like that
// won't match. If the first lookup comes back empty and the address starts
// with a number range, retry once using just the first number.
function simplifyStreetNumberRange(address) {
  return address.replace(/^(\d+)-\d+(\s)/, '$1$2');
}

async function main() {
  let results = await geocode(address);

  if (!results || results.length === 0) {
    const simplified = simplifyStreetNumberRange(address);
    if (simplified !== address) {
      console.log(`No match for "${address}". Retrying with "${simplified}"...`);
      results = await geocode(simplified);
    }
  }

  if (!results || results.length === 0) {
    console.error(`Could not geocode address: "${address}". Skipping.`);
    process.exit(1);
  }

  const { lat, lon } = results[0];

  const raw = fs.existsSync(DATA_PATH) ? fs.readFileSync(DATA_PATH, 'utf8') : '[]';
  const locations = JSON.parse(raw || '[]');

  locations.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name,
    address,
    hours,
    treats,
    allergens,
    description,
    lat: parseFloat(lat),
    lng: parseFloat(lon),
    submittedAt: new Date().toISOString(),
  });

  fs.writeFileSync(DATA_PATH, JSON.stringify(locations, null, 2) + '\n');
  console.log(`Added "${name}" at ${address} -> (${lat}, ${lon})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
