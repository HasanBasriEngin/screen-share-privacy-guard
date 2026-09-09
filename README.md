# Screen Share Privacy Guard

A Chrome extension that automatically blurs sensitive information — credit
card numbers, national ID numbers, phone numbers, IBANs, addresses, names,
and developer secrets — that might accidentally show up on screen while
streaming or sharing your tab.

## How it works

- Scans the page text and blurs anything matching a known pattern:
  - **Credit card** — validated with the Luhn algorithm (avoids false positives)
  - **National ID number** — validated with the official checksum algorithm
  - **IBAN, phone number, email**
  - **Home address** — catches patterns like "... Street", "... Avenue",
    "No:/Apt:/Floor:", including abbreviations glued to a number (e.g.
    "519.Sok"). Since fully parsing a free-form address is close to
    impossible, this pattern is **intentionally broad** — missing a few is
    safer than missing too many.
  - **Person names** (best-effort) — names right after a label like "Ad
    Soyad:"/"Alıcı:" are caught with high confidence; a common Turkish first
    name followed by a capitalized word is also flagged as a likely full
    name (broader, some false positives possible — see Known limitations).
  - **Developer secrets** — AWS/GCP/Azure keys, GitHub/Slack tokens, OpenAI/
    Anthropic API keys, JWTs.
- **Blurs while you type, too** — known sensitive fields (card, phone,
  address, national ID) stay blurred the whole time, whether the value came
  from autofill or you're actively typing it. Other fields (plain text
  inputs, textareas, contenteditable boxes) blur live as soon as what you
  type matches a sensitive pattern. Double-click a blurred field to peek for
  2.5 seconds.
- **Panic mode** (`Ctrl+Shift+B` or the red button in the popup): instantly
  darkens the whole page — for emergencies during a live stream.
- Clicking a blurred piece of text reveals it for 2.5 seconds, then it blurs
  again automatically.
- **Per-site whitelist**: use the "Disable on this site" toggle in the popup
  to turn protection off on a site you trust, like your own banking site.
  The whitelist also covers subdomains (adding `example.com` also whitelists
  `www.example.com` and `login.example.com`). Panic mode is never affected by
  the whitelist — it always works.
- **Custom patterns**: add any text from the popup (e.g. your own full name
  or home address) that doesn't match the built-in patterns, and it will be
  automatically blurred on every site.
- **Manual blur**: for anything the automatic patterns miss (an image, an
  unusual layout), click "Pick element(s) to hide" in the popup, then click
  as many elements on the page as you want (press `Esc` when done) — each
  one gets blurred and stays blurred on that page across reloads. You can
  also skip the popup entirely: `Alt`+click any element to toggle its blur
  on or off, one after another. (`Ctrl`+click is intentionally not used for
  this — it would break "open link in new tab".)
- **Share-start detection**: when a web app you're on (e.g. a video-call site)
  starts sharing your screen/tab via `getDisplayMedia`, a small banner
  confirms protection is active — or warns you loudly if it's off on that
  site, with a one-click button to turn it back on.

## Installation (developer mode)

1. Go to `chrome://extensions` (or `brave://extensions` in Brave).
2. Turn on **Developer mode** in the top right.
3. Click **Load unpacked** and select this folder.
4. Click the extension icon to confirm protection is on.

## Known limitations

- This is a **browser tab** extension: it only protects pages open inside
  Chrome/Brave. It does not cover **desktop** sharing done through external
  tools like OBS or the Zoom/Teams desktop app (e.g. a local Excel file,
  File Explorer) — that would require a separate desktop application. The
  share-start banner only fires for shares a **web page itself** starts
  (e.g. Google Meet, Discord web) — it can't see anything outside the browser.
- Blurring works on the DOM (page text + form fields); it cannot detect
  sensitive information embedded *inside* an image or photo (that would
  require real-time image processing/OCR, which is expensive).
- Patterns are tuned for specific formats (Turkish national ID, TR IBAN,
  local phone numbers). New regexes can be added to the `PATTERNS` array in
  `lib/patterns.js` to support other countries/formats.
- **Person name detection is best-effort, not exhaustive.** There's no
  reliable way to spot an arbitrary name with a regex without producing
  false positives. The built-in patterns catch labeled names ("Ad Soyad: ...")
  and "common first name + capitalized word" — a name that isn't in the
  common-names list and isn't labeled won't be caught. Add it as a **custom
  pattern** to be sure.
- The address pattern needs a keyword (Mahalle/Sokak/Cadde/Bulvar, abbreviated
  or not) to trigger. A bare place name with no such keyword (e.g. just a
  district/city name on its own line) won't be caught — add it as a custom
  pattern if it keeps showing up.
- **Manual blur persistence is best-effort.** It remembers an element by a
  CSS selector path; on a very dynamic page (e.g. a React app that rebuilds
  its DOM structure differently each visit) it may stop matching after a
  layout change and need re-picking.

## Ideas for extension

- Chrome Web Store publishing materials: privacy policy, store description,
  screenshots.
- A proper NER (named-entity recognition) model for name detection, running
  locally in the browser — the current regex-based approach is an
  intentionally cheap first pass.

## Developer notes

See `CLAUDE.md` → "Test etme" for unit tests covering the regex/validation
logic (`npm install && npm test`).
