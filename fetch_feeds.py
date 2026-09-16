"""Collect RSS, Atom, and selected public listing pages for the reading desk."""

from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html import unescape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import urllib.request
from urllib.parse import urljoin, urlparse
import xml.etree.ElementTree as ET

MAX_ITEMS = 8
TIMEOUT_SECONDS = 15
USER_AGENT = "personal-reading-desk/2.0 (+https://github.com/Tarun2305/personal-site)"

CATEGORIES = [
    {"id": "news", "name": "News"},
    {"id": "sports", "name": "Chelsea"},
    {"id": "music", "name": "Music"},
    {"id": "film", "name": "Film"},
    {"id": "essays", "name": "Essays"},
]

SOURCES = [
    {"id": "ap", "name": "Associated Press", "category": "news", "url": "https://apnews.com"},
    {"id": "reuters", "name": "Reuters", "category": "news", "url": "https://www.reuters.com"},
    {"id": "bbc", "name": "BBC", "category": "news", "url": "https://www.bbc.co.uk/news", "feed": "https://feeds.bbci.co.uk/news/rss.xml"},
    {"id": "aljazeera", "name": "Al Jazeera", "category": "news", "url": "https://www.aljazeera.com", "feed": "https://www.aljazeera.com/xml/rss/all.xml"},
    {"id": "ft", "name": "Financial Times", "category": "news", "url": "https://www.ft.com"},
    {"id": "bloomberg", "name": "Bloomberg", "category": "news", "url": "https://www.bloomberg.com"},
    {"id": "economist", "name": "The Economist", "category": "news", "url": "https://www.economist.com"},
    {"id": "athletic", "name": "The Athletic", "category": "sports", "url": "https://theathletic.com/football/team/chelsea"},
    {"id": "chelsea", "name": "Chelsea FC Official", "category": "sports", "url": "https://www.chelseafc.com/en/news/latest-news", "scrape": ["/en/news/article/"]},
    {"id": "chelsea_bbc", "name": "BBC Sport Chelsea", "category": "sports", "url": "https://www.bbc.co.uk/sport/football/teams/chelsea", "feed": "https://feeds.bbci.co.uk/sport/football/teams/chelsea/rss.xml"},
    {
        "id": "chelsea_sky",
        "name": "Sky Sports Chelsea",
        "category": "sports",
        "url": "https://www.skysports.com/chelsea",
        "scrape": ["/football/news/", "/watch/video/"],
        "exclude_titles": ["sky sports with no contract", "british south asians in football", "download the sky sports app"],
    },
    {"id": "rym", "name": "RateYourMusic", "category": "music", "url": "https://rateyourmusic.com"},
    {"id": "aoty", "name": "Album of the Year", "category": "music", "url": "https://www.albumoftheyear.org"},
    {"id": "pitchfork", "name": "Pitchfork", "category": "music", "url": "https://pitchfork.com/reviews/albums", "feed": "https://pitchfork.com/feed/feed-album-reviews/rss"},
    {"id": "quietus", "name": "The Quietus", "category": "music", "url": "https://thequietus.com", "feed": "https://thequietus.com/feed"},
    {"id": "residentadvisor", "name": "Resident Advisor", "category": "music", "url": "https://ra.co/reviews"},
    {"id": "aquariumdrunkard", "name": "Aquarium Drunkard", "category": "music", "url": "https://aquariumdrunkard.com", "feed": "https://www.aquariumdrunkard.com/feed/"},
    {"id": "bfi", "name": "BFI", "category": "film", "url": "https://www.bfi.org.uk/features", "scrape": ["/features/", "/sight-and-sound/"]},
    {"id": "criterion", "name": "Criterion Current", "category": "film", "url": "https://www.criterion.com/current", "feed": "https://www.criterion.com/current/rss"},
    {"id": "rogerebert", "name": "Roger Ebert", "category": "film", "url": "https://www.rogerebert.com", "feed": "https://www.rogerebert.com/feed"},
    {"id": "sightandsound", "name": "Sight & Sound", "category": "film", "url": "https://www.bfi.org.uk/sight-and-sound"},
    {"id": "filmcomment", "name": "Film Comment", "category": "film", "url": "https://www.filmcomment.com", "feed": "https://www.filmcomment.com/feed/"},
    {"id": "mubi", "name": "MUBI Notebook", "category": "film", "url": "https://mubi.com/notebook", "feed": "https://mubi.com/notebook/posts.atom"},
    {"id": "reverseshot", "name": "Reverse Shot", "category": "film", "url": "https://reverseshot.org", "feed": "https://reverseshot.org/rss.xml"},
    {"id": "sensesofcinema", "name": "Senses of Cinema", "category": "film", "url": "https://www.sensesofcinema.com", "feed": "https://www.sensesofcinema.com/feed/"},
    {"id": "nyrb", "name": "NYRB", "category": "essays", "url": "https://www.nybooks.com"},
    {"id": "lrb", "name": "LRB", "category": "essays", "url": "https://www.lrb.co.uk"},
    {"id": "larb", "name": "LARB", "category": "essays", "url": "https://lareviewofbooks.org", "feed": "https://lareviewofbooks.org/feed/"},
    {"id": "aeon", "name": "Aeon", "category": "essays", "url": "https://aeon.co", "feed": "https://aeon.co/feed.rss"},
    {"id": "psyche", "name": "Psyche", "category": "essays", "url": "https://psyche.co", "feed": "https://psyche.co/feed.rss"},
    {"id": "newleftreview", "name": "New Left Review", "category": "essays", "url": "https://newleftreview.org"},
    {"id": "thepoint", "name": "The Point", "category": "essays", "url": "https://thepointmag.com", "scrape": ["/"]},
    {"id": "publicdomainreview", "name": "Public Domain Review", "category": "essays", "url": "https://publicdomainreview.org", "feed": "https://publicdomainreview.org/rss.xml"},
    {"id": "quanta", "name": "Quanta Magazine", "category": "essays", "url": "https://www.quantamagazine.org", "feed": "https://api.quantamagazine.org/feed/"},
    {"id": "nautilus", "name": "Nautilus", "category": "essays", "url": "https://nautil.us", "feed": "https://nautil.us/feed/"},
    {"id": "worksinprogress", "name": "Works in Progress", "category": "essays", "url": "https://worksinprogress.co", "scrape": ["/"]},
    {"id": "noema", "name": "Noema Magazine", "category": "essays", "url": "https://www.noemamag.com", "feed": "https://www.noemamag.com/feed/"},
]


class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)


class LinkExtractor(HTMLParser):
    """Collect candidate editorial links from a public listing page."""

    def __init__(self):
        super().__init__()
        self.links = []
        self.current_href = None
        self.current_text = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() == "a":
            self.current_href = dict(attrs).get("href")
            self.current_text = []

    def handle_data(self, data):
        if self.current_href is not None:
            self.current_text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self.current_href is not None:
            self.links.append((clean_text(" ".join(self.current_text)), self.current_href))
            self.current_href = None
            self.current_text = []


def clean_text(value, limit=None):
    if not value:
        return ""
    parser = TextExtractor()
    try:
        parser.feed(unescape(value))
        text = " ".join(parser.parts)
    except Exception:
        text = value
    text = re.sub(r"\s+", " ", unescape(text)).strip()
    text = re.sub(r"(?:^|\s+)The post .+? (?:first appeared|appeared first|appeared) on .+?\.?$", "", text, flags=re.IGNORECASE)
    if limit and len(text) > limit:
        return text[: limit - 1].rsplit(" ", 1)[0] + "…"
    return text


def local_name(tag):
    return tag.rsplit("}", 1)[-1].lower()


def child_value(element, names):
    for child in element:
        if local_name(child.tag) in names:
            value = "".join(child.itertext()).strip()
            if value:
                return value
    return ""


def normalize_date(value):
    if not value:
        return None
    try:
        parsed = parsedate_to_datetime(value)
    except (TypeError, ValueError, OverflowError):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def request_bytes(url):
    request = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "application/rss+xml, application/atom+xml, text/html;q=0.9, */*;q=0.5"},
    )
    with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
        return response.read()


def decode_html(payload):
    try:
        return payload.decode("utf-8")
    except UnicodeDecodeError:
        return payload.decode("windows-1252", errors="replace")


def parse_feed(url):
    root = ET.fromstring(request_bytes(url))
    entries = [element for element in root.iter() if local_name(element.tag) in {"item", "entry"}]
    items = []
    for entry in entries[:MAX_ITEMS]:
        title = clean_text(child_value(entry, {"title"}))
        link = child_value(entry, {"link"})
        if not link:
            for child in entry:
                if local_name(child.tag) == "link" and child.get("href") and child.get("rel", "alternate") == "alternate":
                    link = child.get("href", "").strip()
                    break
        if not title or not link:
            continue
        items.append({
            "title": title,
            "link": link,
            "published": normalize_date(child_value(entry, {"pubdate", "published", "updated", "date"})),
            "description": clean_text(child_value(entry, {"description", "summary", "content", "encoded"}), 700),
        })
    return items


def scrape_listing(source):
    parser = LinkExtractor()
    parser.feed(decode_html(request_bytes(source["url"])))
    origin = urlparse(source["url"])
    prefixes = tuple(source.get("scrape", []))
    seen = set()
    items = []
    for title, href in parser.links:
        absolute = urljoin(source["url"], href)
        parsed = urlparse(absolute)
        path = parsed.path.rstrip("/") or "/"
        matches_path = any(path.startswith(prefix.rstrip("/") or "/") for prefix in prefixes)
        if parsed.netloc != origin.netloc or not matches_path or path == "/" or absolute in seen:
            continue
        if len(title) < 18 or len(title) > 180:
            continue
        lowered_title = title.lower()
        if any(label in lowered_title for label in ("subscribe", "sign up", "read more", "view all", "privacy", "cookie")):
            continue
        if any(label in lowered_title for label in source.get("exclude_titles", [])):
            continue
        seen.add(absolute)
        items.append({"title": title, "link": absolute, "published": None, "description": ""})
        if len(items) == MAX_ITEMS:
            break
    return items


def collect_source(source):
    try:
        if source.get("feed"):
            return parse_feed(source["feed"])
        if source.get("scrape"):
            return scrape_listing(source)
    except Exception as error:
        print(f"Failed {source['id']}: {error}")
        return None
    return []


output_path = Path("data.json")
try:
    previous_data = json.loads(output_path.read_text(encoding="utf-8"))
except (FileNotFoundError, json.JSONDecodeError):
    previous_data = {"feeds": {}}

collectable = [source for source in SOURCES if source.get("feed") or source.get("scrape")]
results = {}
collected_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
with ThreadPoolExecutor(max_workers=8) as executor:
    futures = {executor.submit(collect_source, source): source for source in collectable}
    for future in as_completed(futures):
        source = futures[future]
        source_id = source["id"]
        fresh_items = future.result()
        if fresh_items is None:
            results[source_id] = previous_data.get("feeds", {}).get(source_id, [])
            print(f"Kept previous {source_id}: {len(results[source_id])} item(s)")
        else:
            previous_items = {
                item.get("link"): item
                for item in previous_data.get("feeds", {}).get(source_id, [])
                if item.get("link")
            }
            for item in fresh_items:
                if not item.get("published"):
                    previous_item = previous_items.get(item["link"], {})
                    previous_discovery = previous_item.get("discovered")
                    if not previous_discovery and source.get("scrape"):
                        previous_discovery = previous_item.get("published")
                    item["discovered"] = previous_discovery or collected_at
            results[source_id] = fresh_items
            print(f"Fetched {source_id}: {len(fresh_items)} item(s)")

data = {
    "categories": CATEGORIES,
    "sources": [{key: value for key, value in source.items() if key not in {"feed", "scrape", "exclude_titles"}} for source in SOURCES],
    "feeds": {source["id"]: results.get(source["id"], []) for source in SOURCES},
}

with output_path.open("w", encoding="utf-8") as file:
    json.dump(data, file, indent=2, ensure_ascii=False)
    file.write("\n")

print("data.json generated successfully.")
