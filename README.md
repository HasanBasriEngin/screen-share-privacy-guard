# Screen Share Privacy Guard

A Chrome extension that automatically blurs sensitive information — credit
card numbers, national ID numbers, phone numbers, IBANs — that might
accidentally show up on screen while streaming or sharing your tab.

## How it works

- Scans the page text and blurs anything matching a known pattern:
  - **Credit card** — validated with the Luhn algorithm (avoids false positives)
  - **National ID number** — validated with the official checksum algorithm
  - **IBAN, phone number, email**
  - **Home address** — catches patterns like "... Street", "... Avenue",
    "No:/Apt:/Floor:". Since fully parsing a free-form address is close to
    impossible, this pattern is **intentionally broad** — missing a few is
    safer than missing too many.
- Autofill-prone fields (card, address, phone) stay blurred by default until
  focused.
- **Panic mode** (`Ctrl+Shift+B` or the red button in the popup): instantly
  darkens the whole page — for emergencies during a live stream.
- Clicking a blurred field reveals it for 2.5 seconds, then it blurs again
  automatically.
- **Per-site whitelist**: use the "Disable on this site" toggle in the popup
  to turn protection off on a site you trust, like your own banking site.
  The whitelist also covers subdomains (adding `example.com` also whitelists
  `www.example.com` and `login.example.com`). Panic mode is never affected by
  the whitelist — it always works.
- **Custom patterns**: add any text from the popup (e.g. your own home
  address) that doesn't match the built-in patterns, and it will be
  automatically blurred on every site.

## Installation (developer mode)

1. Go to `chrome://extensions`.
2. Turn on **Developer mode** in the top right.
3. Click **Load unpacked** and select this folder.
4. Click the extension icon to confirm protection is on.

## Known limitations

- This is a **browser tab** extension: it only protects pages open inside
  Chrome. It does not cover **desktop** sharing done through external tools
  like OBS or Zoom (e.g. a local Excel file, File Explorer) — that would
  require a separate desktop application.
- Blurring works on the DOM (page text + form fields); it cannot detect
  sensitive information embedded *inside* an image or photo (that would
  require real-time image processing/OCR, which is expensive).
- Patterns are tuned for specific formats (Turkish national ID, TR IBAN,
  local phone numbers). New regexes can be added to the `PATTERNS` array in
  `lib/patterns.js` to support other countries/formats.

## Ideas for extension

- A separate video-stream filtering layer for real-time screen sharing
  (when `getDisplayMedia` is used to share "this tab").
- Materials needed to publish on the Chrome Web Store: privacy policy, store
  description, screenshots.

## Developer notes

See `CLAUDE.md` → "Test etme" for unit tests covering the regex/validation
logic (`npm install && npm test`).
