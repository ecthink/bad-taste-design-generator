# DOM injection regression tests

## DOM/parser suite

This suite executes the app in jsdom, parses its generated HTML, and dispatches
load/error events on any injected handlers. Resource fetching is disabled.
It verifies the security boundary and share/control logic, not browser layout.
It was verified with Node.js 24.22.1 and jsdom 31.0.0. Use Node.js 24.15 or
newer on the 24.x release line:

```sh
npm install --no-save --package-lock=false jsdom@31.0.0
node --test tests/dom-security.test.cjs
```

## Browser suite

These tests run the actual single-page app in headless Chromium using Playwright.
All app responses come from memory and other browser requests are blocked.

Prerequisites: Node.js 20 or newer, Playwright, and Chromium.

From the repository root, if Playwright is not already installed:

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
```

Run the suite:

```sh
node --test tests/dom-injection.test.cjs
```

To use an existing Chromium executable instead of Playwright's bundled browser:

```sh
CHROMIUM_PATH=/usr/bin/chromium node --test tests/dom-injection.test.cjs
```

Coverage includes URL-fragment auto-load/reload, manual generation, all four
text-rendering helpers, HTML/SVG/event-handler payloads, entity and URL-encoded
text, Unicode, sharing, regeneration, Ctrl+Enter, save guidance, empty input,
trimming, and malformed fragments. No runtime dependency is added to the app.
