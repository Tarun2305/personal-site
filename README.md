# Reading desk

A personal newspaper for keeping up with a hand-picked set of publications without turning every interesting headline into another browser tab. It combines live RSS/Atom feeds, selected public listing pages, and direct publication links across news, Chelsea, music, film, and long-form writing.

The application is static and designed for GitHub Pages. GitHub Actions refreshes [`data.json`](data.json) every three hours; reading state remains private in the browser.

## Features

- A chronological **Today** stream plus dedicated category views
- Desktop sidebar, mobile navigation, and swipe gestures
- Same-tab article links that mark stories read without creating tab clutter
- Save, read/unread, dismiss, history, and undo controls
- New-since-last-visit indicators
- Search and newest, oldest, or source sorting
- Direct publication links for sources without usable headlines
- Archive.today lookup
- Installable PWA shell with offline access after the first visit
- Minimal, responsive light theme with keyboard and reduced-motion support

Saved, read, and dismissed states are stored in `localStorage`. They are specific to the current browser and are not sent anywhere.

## How it works

```text
RSS / Atom feeds ─┐
Public listings ──┼─→ fetch_feeds.py → data.json
Direct sources ───┘                         ↓
                                    Static GitHub Pages app
                                             ↓
                                  Local reading state + cache
```

[`fetch_feeds.py`](fetch_feeds.py) contains the single source and category configuration. It collects up to eight items per supported source, including publication dates and feed descriptions when available. A source failure keeps the previous successful items instead of clearing them.

[`app.js`](app.js) turns the generated data into the interactive reading desk. [`service-worker.js`](service-worker.js) caches the app shell and the most recently retrieved feed data for offline use.

## Run locally

Python 3 is the only runtime requirement.

```bash
python fetch_feeds.py
python -m http.server 8000
```

Open <http://localhost:8000>. Opening `index.html` directly will not work because browsers block its request for `data.json` under the `file://` protocol.

## Add or change a source

Edit the `SOURCES` list in [`fetch_feeds.py`](fetch_feeds.py):

```python
{
    "id": "example",
    "name": "Example",
    "category": "essays",
    "url": "https://example.com",
    "feed": "https://example.com/feed.xml",
}
```

- Omit `feed` for a direct publication link.
- Use `scrape` with one or more allowed URL-path prefixes for a selected public listing page.
- Add new navigation sections to `CATEGORIES` and use the same category ID on their sources.

Run `python fetch_feeds.py` afterward and inspect the generated `data.json`.

## Deployment

In GitHub, select **Settings → Pages → Deploy from a branch**, then choose `main` and `/ (root)`. Pushing to `main` updates the site. The scheduled workflow has narrowly scoped repository write permission so it can commit changed feed data.

## Limitations

- Feed descriptions are short summaries only; full articles always open on the publisher's site.
- Public listing extraction is intentionally conservative and may need adjustment when a publisher redesigns its site.
- Local reading state does not currently sync between devices.
- The page uses `noindex` because it is a personal utility rather than a public publication.

Headlines, descriptions, and links remain the property of their respective publishers.
