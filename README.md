# Bad Taste Design Generator v2

A GeoCities personal homepage meets a Hong Kong forum signature editor. Static HTML, CSS and JavaScript. No backend, cloud storage, analytics, remote fonts or runtime dependencies.

## Try it without deployment

Unzip the review package and open `index.html` in a modern browser. Text editing, stickers, local photos and PNG downloads work locally. Share links require an HTTP(S) website: a `file://` link would not work on someone else's computer, so offline copies explain this rather than copy a broken link.

For a local HTTP preview, run `python3 -m http.server 8000` from this directory and visit `http://localhost:8000`. This is local testing, not a public deployment.

## Features

- Five incremental client-feedback controls. Each changes one effect, with explicit limits and undo for the last 20 changes.
- Skippable taste-removal sequence; Escape completes it. Reduced-motion preference skips it, and decorative motion defaults off.
- Deterministic, versioned links preserve the complete editable text/built-in-asset document: seed, text, effects, sticker order/position/scale/rotation, background and pattern transforms. Legacy text-only fragments still load, with a deterministic new layout.
- Six original vector stickers and four backgrounds. Pointer drag, keyboard arrows (Shift for larger steps), numeric position, scale and rotation; background scale/offset controls.
- Local PNG/JPEG/WebP photo import up to 10 MiB and 32 megapixels. Images are decoded, reduced to at most 1200 px on the longest edge and re-encoded as PNG in memory. No upload, persistent storage or original metadata.
- Photo movement, scaling, rotation, grayscale and sepia. Replacing/removing photos is undoable within the session.
- One render model for preview and real 1800×1360 PNG export, with a persistent download fallback link. Selection outlines never enter the image.
- Photo-containing designs cannot be shared as links. The UI says to download PNG, removes stale design fragments, and never silently drops a photo from a shared design.
- Humorous report derives from actual effects, stickers and photo presence.

## Privacy and practical limits

Photos live only in browser memory for the current page session, including recent undo history. They are lost on reload/close. The UI warns before leaving an unsaved photo session when the browser supports that warning. Download before leaving; it is a static image, not an editable project backup.

Text and layout are encoded in URL fragments, not encrypted. Anyone given a design link can read its contents. A local HTTP address is not publicly shareable. Fonts may vary slightly between devices; PNG preserves the exact raster rendered by the exporting browser. Legacy links never stored an exact old random layout, so they retain their text and receive the v2 layout.

Text is limited to 500 Unicode code points, and there are at most 16 stickers. Long text shrinks to fit; more than 12 explicit lines are reflowed. PNG output is a static frame. Mobile browsers may show an image preview instead of downloading directly; use long-press Save Image. Original browser support should be confirmed on Safari/iOS during acceptance testing.

## Development / security

`engine.js` is a pure versioned model and strict link validator. `app.js` renders user text only through DOM `textContent` and SVG text nodes, with no dynamic HTML. Shared schemas accept only allowlisted assets and bounded numeric values, and never accept external image URLs or photo data. CSP blocks outbound connections, object embedding and form submission. All assets are built in.

See `tests/README.md` for test commands and the precise verification record. Build with `npm run build`; `dist/` contains the four static runtime files. `.openai/hosting.json` only configures the local preview; no Site ID, backend or storage binding exists. This branch is for review and is not merged or deployed.
