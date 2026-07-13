# Trick-or-Treat Map

A static map that plots participating houses from the [registration form](https://rcdnplx5.paperform.co/).
Hosted on GitHub Pages. New pins are added by a GitHub Action, triggered by Stepper.

## How it works

1. Someone submits the Paperform.
2. Stepper sends one request to GitHub's `repository_dispatch` endpoint with the
   submitted fields.
3. A GitHub Action wakes up, geocodes the address with OpenStreetMap (free, no key),
   appends the new pin to `data/locations.json`, and commits it.
4. The map page (`index.html`) reads `data/locations.json` and plots every pin with Leaflet.

Nothing runs on a server you have to maintain — it's all GitHub Pages + GitHub Actions.

## Set up the repo

1. Create a new **public** GitHub repo and push these files to it.
   (Public is required for the free Nominatim geocoding call to work smoothly and for
   GitHub Pages on a free plan; the data being published — house address + a note — is
   exactly what people are opting in to share by registering.)
2. In **Settings → Pages**, set source to "Deploy from a branch," branch `main`, folder `/(root)`.
   Your map will be live at `https://<your-username>.github.io/<repo-name>/`.
3. Open `scripts/add-location.js` and replace `you@example.com` in the `User-Agent` string
   with a real contact address — Nominatim's usage policy requires this.

## Connect Stepper

Stepper needs to send **one HTTP request** per form submission:

```
POST https://api.github.com/repos/<owner>/<repo>/dispatches
Headers:
  Authorization: Bearer <your GitHub token>
  Accept: application/vnd.github+json
  Content-Type: application/json
Body:
{
  "event_type": "new-location",
  "client_payload": {
    "name": "<value of field 9rrvm — Map Location Name>",
    "address": "<value of field home_address — Physical address>",
    "hours": "<value of field 48c0u — Hours of Operation>",
    "treats": "<value of field candy_types — Treats>",
    "allergens": "<value of field 3ag98 — Allergens badges, comma-separated e.g. \"GF, DF\">",
    "description": "<value of field special_notes — Description of location>",
    "photo": "<value of field decoration_photo — Photo of location, as a URL>"
  }
}
```

**Getting a token:** create a GitHub Personal Access Token scoped to just this repo
(fine-grained token → Contents: Read and write, Metadata: Read-only), and paste it into
Stepper's request header yourself. Don't share this token or put it in any file that
gets committed.

**Field mapping cheat sheet** (Paperform field → `client_payload` key):

| Paperform field | Paperform slug | client_payload key |
|---|---|---|
| Map Location Name | `9rrvm` | `name` |
| Physical address | `home_address` | `address` |
| Hours of Operation | `48c0u` | `hours` |
| Treats | `candy_types` | `treats` |
| Allergens badges (GF, DF, NF, EG, SF, YF) | `3ag98` | `allergens` |
| Description of location | `special_notes` | `description` |
| Photo of location | `decoration_photo` | `photo` |

Notes on the trickier fields:

- **Allergens** — if Paperform hands Stepper an array from the checkbox group, join it into
  a comma-separated string before sending (e.g. `"GF, DF"`). `add-location.js` splits on
  commas/semicolons either way and turns each one into a badge.
- **Photo** — built assuming Stepper sends a single image URL (Paperform's hosted file
  link). If it's ever missing or broken, the popup just skips the image rather than
  showing a broken-image icon. If a house can upload more than one photo, tell me and I'll
  extend this to a small gallery instead of one hero image.

## Testing locally

```bash
cd trick-or-treat-map
cp data/locations.sample.json data/locations.json   # temporary, for preview only
python3 -m http.server 8000
# open http://localhost:8000
```

Revert `data/locations.json` back to `[]` before going live so the map starts empty.

You can also trigger the Action manually to test the full pipeline, without touching Stepper:

```bash
curl -X POST \
  -H "Authorization: Bearer <your token>" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/<owner>/<repo>/dispatches \
  -d '{"event_type":"new-location","client_payload":{"name":"Test House","address":"201 Central Coast Hwy, Erina NSW","hours":"6:00 PM - 8:30 PM","treats":"Chocolate bars","allergens":"GF, DF","description":"Testing 1 2 3","photo":""}}'
```

Then check the **Actions** tab for the run, and refresh the map once it's green.

## Files

```
index.html                        map page
style.css                         theme
script.js                         loads data/locations.json, plots pins
data/locations.json               live data (starts empty, committed to by the Action)
data/locations.sample.json        sample pins for local preview only
scripts/add-location.js           geocodes + appends a pin
.github/workflows/add-location.yml   the Action, triggered by Stepper
```
