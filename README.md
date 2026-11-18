# A web app

Started from the Software Factory's `web-app` Domain Pack.

```bash
npm ci
npm start   # serves on $HOST:$PORT, 127.0.0.1:3000 by default
npm test
```

`GET /health` answers when the app can serve.

## Real-browser check

`npm test` runs in Node with fakes. `npm run test:browser` loads `/` in headless Chromium with the real
Content-Security-Policy header and a stubbed data service (map tiles are answered locally, so it needs no
internet). It fails on any CSP violation, console error or uncaught error, and checks the ISS marker has a
size, the readout is filled, tiles render, and the Track ISS button is disabled until the first position
and toggles between "Track ISS" and "Tracking ISS".

It needs a Chromium on the machine, which isn't installed by `npm ci`. Either point at one:

```bash
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
```

or have Playwright download one first: `npx playwright-core install chromium`.
