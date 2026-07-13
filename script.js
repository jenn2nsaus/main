// Central Coast, NSW — roughly centered between Gosford and Terrigal
const DEFAULT_CENTER = [-33.43, 151.38];
const DEFAULT_ZOOM = 11;

const map = L.map('map', {
  zoomControl: true,
}).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
}).addTo(map);

const pumpkinIcon = L.divIcon({
  className: '',
  html: '<div class="pumpkin-marker">🎃</div>',
  iconSize: [28, 28],
  iconAnchor: [14, 20],
  popupAnchor: [0, -18],
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function renderLocations(locations) {
  const countEl = document.getElementById('house-count');
  const emptyEl = document.getElementById('empty-state');

  if (!locations || locations.length === 0) {
    countEl.textContent = '0 houses registered';
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');
  countEl.textContent = `${locations.length} house${locations.length === 1 ? '' : 's'} registered`;

  const markers = [];

  locations.forEach((loc) => {
    if (typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return;

    const marker = L.marker([loc.lat, loc.lng], { icon: pumpkinIcon }).addTo(map);

    const name = escapeHtml(loc.name || 'A neighbor');
    const address = escapeHtml(loc.address || '');
    const hours = escapeHtml(loc.hours || '');
    const treats = escapeHtml(loc.treats || '');
    const description = escapeHtml(loc.description || '');
    const photo = loc.photo || '';
    const allergens = Array.isArray(loc.allergens) ? loc.allergens : [];

    const badgesHtml = allergens.length
      ? `<div class="allergen-badges">${allergens
          .map((a) => `<span class="badge">${escapeHtml(a)}</span>`)
          .join('')}</div>`
      : '';

    const photoHtml = photo
      ? `<img class="popup-photo" src="${escapeHtml(photo)}" alt="${name}" loading="lazy" onerror="this.remove()" />`
      : '';

    marker.bindPopup(
      `
      ${photoHtml}
      <h3>${name}</h3>
      ${address ? `<p class="popup-address">${address}</p>` : ''}
      ${hours ? `<p class="popup-hours">🕒 ${hours}</p>` : ''}
      ${treats ? `<p class="popup-treats">🍬 ${treats}</p>` : ''}
      ${description ? `<p class="popup-description">${description}</p>` : ''}
      ${badgesHtml}
    `,
      { maxWidth: 260 }
    );

    markers.push(marker);
  });

  if (markers.length > 0) {
    const group = L.featureGroup(markers);
    map.fitBounds(group.getBounds().pad(0.2), { maxZoom: 14 });
  }
}

fetch('data/locations.json', { cache: 'no-store' })
  .then((res) => {
    if (!res.ok) throw new Error(`Failed to load locations.json (${res.status})`);
    return res.json();
  })
  .then(renderLocations)
  .catch((err) => {
    console.error(err);
    document.getElementById('house-count').textContent = 'Could not load houses';
  });
