# Reading desk

A personal newspaper for keeping up with a hand-picked set of publications. It brings news, football, music, film, and long-form writing into one calm reading queue, with a separate directory for visiting the publications themselves.

## Features

- A chronological **Today** stream plus dedicated category views
- Desktop sidebar, mobile navigation, and swipe gestures
- Article links open in a new tab and immediately turn grey when read
- Save, read/unread, dismiss, history, and undo controls
- New-since-last-visit indicators
- A category-grouped Site Directory with publication links, including sites without feeds
- Archive.today lookup
- Installable app with offline access after the first visit
- Bauhaus-inspired responsive visual system with keyboard and reduced-motion support

Saved, read, and dismissed states are stored in `localStorage`. They are specific to the current browser and are not sent anywhere.

## The idea

Reading desk is meant for idle moments when you want something worthwhile to read without visiting every publication individually. **Today** mixes the newest available stories into one chronological stream, while the section views provide a more focused browse.

Opening a headline takes you directly to the original publication in a new tab and marks it as read. Read stories use grey text, while their controls remain available. Save keeps something for later, Mark read adds it to History, and Dismiss removes it from the stream. On mobile, stories can also be swiped right to save or left to dismiss.

The section views contain feed articles only. Site Directory, below Archive lookup in the navigation, groups all publications into Bauhaus-style link tiles. Each tile opens the publication in a new tab and indicates whether it has a configured RSS/Atom feed or is a website-only link.

Archive lookup finds the newest available Archive.today copy of a URL.

## Sources and privacy

Headlines come exclusively from publisher-provided RSS and Atom feeds. The collector does not crawl or scrape publication pages. Sources without usable feeds remain available in Site Directory. The collection refreshes automatically throughout the day; if a feed temporarily fails, its last successfully collected headlines are retained.

Feeds include reporting from BBC, Al Jazeera, Financial Times, Rest of World, and ProPublica; football writing from Guardian Football, BBC Chelsea, Spielverlagerung, Swiss Ramble, and We Ain’t Got No History; music from Pitchfork, The Quietus, Aquarium Drunkard, Bandcamp Daily, and Tone Glow; and film and essay publications including The Film Stage, Cinephilia & Beyond, n+1, The Baffler, Longreads, and The Paris Review Daily.

LRB supplies its blog feed and The Paris Review supplies its Daily feed, rather than the complete print magazines. Feed availability does not remove a publisher’s paywall or subscription requirements.

Saved, read, and dismissed states remain in the current browser. Nothing is attached to an account or sent to a separate reading-profile service, which also means those states do not sync between devices.

## Behind the page

```text
Publisher RSS / Atom → feed collector → article sections
Publication links ──────────────────→ Site Directory
                                              ↓
                                  Local reading state + cache
```

The site is a static application. An automated collector assembles recent headlines and summaries into a data file, the browser organizes that data into the reading views, and a service worker keeps the interface and most recently retrieved feed data available offline.

Feed descriptions are only short summaries. Full articles always remain on—and open on—the publisher's site.

Headlines, descriptions, and links remain the property of their respective publishers.
