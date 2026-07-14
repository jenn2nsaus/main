// Runs inside the GitHub Action. Reads the submitted fields from
// client_payload (a real nested object — sent by a Stepper "Code" step
// using fetch() + JSON.stringify()) and appends the new pin to
// data/locations.json. Coordinates now come directly from Paperform's
// Google Address autocomplete field (already resolved at submission time),
// so there's no geocoding step here anymore.

const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'locations.json');

const name = process.env.LOCATION_NAME || 'A neighbor';
const address = process.env.LOCATION_ADDRESS;
const hours = process.env.LOCATION_HOURS || '';
const treats = process.env.LOCATION_TREATS || '';
const allergensRaw = process.env.LOCATION_ALLERGENS || '';
const description = process.env.LOCATION_DESCRIPTION || '';
const lat = parseFloat(process.env.LOCATION_LAT);
const lng = parseFloat(process.env.LOCATION_LNG);

// Allergens display as individual badges — split on comma/semicolon
// regardless of whether the source was a single code or several joined.
const allergens = allergensRaw
  .split(/[,;]/)
  .map((s) => s.trim())
  .filter(Boolean);

if (!address) {
  console.error('No address was provided in the dispatch payload. Aborting.');
  process.exit(1);
}

if (Number.isNaN(lat) || Number.isNaN(lng)) {
  console.error(`No valid coordinates were provided (got lat=${process.env.LOCATION_LAT}, lng=${process.env.LOCATION_LNG}). Aborting.`);
  process.exit(1);
}

function main() {
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
    lat,
    lng,
    submittedAt: new Date().toISOString(),
  });

  fs.writeFileSync(DATA_PATH, JSON.stringify(locations, null, 2) + '\n');
  console.log(`Added "${name}" at ${address} -> (${lat}, ${lng})`);
}

main();
