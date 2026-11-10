# Verification

The runtime app has no dependencies. Tests require Node 24.15+ and the pinned development dependencies in package.json.

```
npm install
npm run check
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

To use an existing Chromium: `CHROMIUM_PATH=/usr/bin/chromium npm run test:browser`.

## Executed during implementation

- Syntax checks and static build passed.
- 29 model/jsdom tests passed. `NODE_PATH=/tmp/bad-taste-test-deps/node_modules npm test` used the existing jsdom 31.0.0 installation.
- Interactive Chromium QA: desktop and 390px-wide responsive iframe; actual local PNG photo import, sepia filter, SVG-to-PNG rendering, 1800×1360 PNG byte/dimension checks, saved image visual review, numeric sticker movement/scale, keyboard movement, incremental feedback and undo, photo-sharing warning, no horizontal overflow.
- The standalone Playwright suite is provided for CI/reviewer use; it was not run in this execution environment. Browser testing here used the supported interactive browser surface. Do not confuse jsdom/canvas stubs with real raster verification.
- Native Safari/iOS/Android testing remains for user acceptance. Mobile layout QA is at 390 CSS pixels in desktop Chromium, not a real phone.

## Regression coverage

The model/DOM suites cover the original eight injection payload families through legacy hash, v2 links, manual input, and exported SVG serialization. They also cover strict schema limits, tampered state, full-state URL round trips, feedback isolation/saturation, exact undo, reports, transforms, internal navigation without destructive hash changes, keyboard/focus, generation skipping/Escape, clipboard fallback, photo normalization and privacy, invalid/corrupt/oversized files, asynchronous photo races, same-file reselection, stale decodes, export single-flight, and export/edit races.

The browser suite serves only local source assets from memory and blocks other requests. It adds real Chromium execution, PNG headers/dimensions and narrow viewport assertions.
