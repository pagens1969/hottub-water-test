# Hot Tub Water Test — PWA setup

This folder contains a phone-installable web app: photograph the test strip,
it estimates pH / Bromine / Alkalinity against your BlueHorizons chart data,
calculates a treatment dose for your tub, and logs the result to your
"Hot Tub Test Log" Google Sheet.

Files:
- `index.html`, `manifest.json`, `sw.js`, `icon-192.png`, `icon-512.png` — the app (static, no build step).
- `AppsScript-Code.gs` — the backend script that goes in the Google Sheet, not deployed to Netlify.

## 1. Deploy the app to Netlify

A Netlify project has already been created under your account:

- Name: `hottub-water-test`
- Site ID: `20e59aed-5d9f-4079-82bf-2a01fa49e61a`
- URL once deployed: https://hottub-water-test.netlify.app

From this folder, run:

```
netlify deploy --dir=. --prod --site 20e59aed-5d9f-4079-82bf-2a01fa49e61a
```

(uses your existing Netlify CLI login — same as your other projects).

## 2. Set up the Google Sheet backend (one-time)

1. Open the "Hot Tub Test Log" sheet → **Extensions → Apps Script**.
2. Delete any placeholder code, paste in the entire contents of `AppsScript-Code.gs`.
3. **Project Settings** (gear icon) → **Script Properties** → add:
   - Property: `HOTTUB_TOKEN`
   - Value: any long random password you make up — this is the shared secret.
4. **Deploy → New deployment**:
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Authorize when prompted (it needs permission to edit this one sheet).
6. Copy the **Web app URL** (ends in `/exec`).

## 3. Connect the app to the sheet

1. Open the deployed app on your phone, add it to your home screen.
2. Go to **Settings** in the app.
3. Paste the Web app URL as the Backend URL, and the token from step 2.3 as the token.
4. Test — it should show your last 5 tests on the home screen.

If you ever edit `AppsScript-Code.gs` again, you must re-deploy via
**Deploy → Manage deployments → edit → New version**, or the live URL keeps
running the old code.
