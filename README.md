# Reading desk

A personal newspaper for keeping up with a hand-picked set of publications without turning every interesting headline into another browser tab. It brings news, Chelsea coverage, music, film, and long-form writing into one calm reading queue.

## Features

- A chronological **Today** stream plus dedicated category views
- Desktop sidebar, mobile navigation, and swipe gestures
- Same-tab article links that mark stories read without creating tab clutter
- Save, read/unread, dismiss, history, and undo controls
- New-since-last-visit indicators
- Newest, oldest, or source sorting
- Direct publication links for sources without usable headlines
- Archive.today lookup
- Installable app with offline access after the first visit
- Minimal, responsive light theme with keyboard and reduced-motion support

Saved, read, and dismissed states are stored in `localStorage`. They are specific to the current browser and are not sent anywhere.

## The idea

Reading desk is meant for idle moments when you want something worthwhile to read without visiting every publication individually. **Today** mixes the newest available stories into one chronological stream, while the section views provide a more focused browse.

Opening a headline takes you directly to the original publication in the same tab and marks it as read. Save keeps something for later, Mark read adds it to History, and Dismiss removes it from the stream. On mobile, stories can also be swiped right to save or left to dismiss.

Sorting works within the current view. Archive lookup finds the newest available Archive.today copy of a URL.

## Sources and privacy

Headlines come from RSS and Atom feeds where available, with a small number collected from public publication pages. Sources without usable feeds remain available as direct links. The collection refreshes automatically throughout the day.

Saved, read, and dismissed states remain in the current browser. Nothing is attached to an account or sent to a separate reading-profile service, which also means those states do not sync between devices.

## Behind the page

```text
RSS / Atom feeds ─┐
Public listings ──┼─→ fetch_feeds.py → data.json
Direct sources ───┘                         ↓
                                    Static GitHub Pages app
                                             ↓
                                  Local reading state + cache
```

The site is a static application. An automated collector assembles recent headlines and summaries into a data file, the browser organizes that data into the reading views, and a service worker keeps the interface and most recently retrieved feed data available offline.

Feed descriptions are only short summaries. Full articles always remain on—and open on—the publisher's site.

Headlines, descriptions, and links remain the property of their respective publishers.
