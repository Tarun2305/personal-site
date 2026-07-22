import urllib.request
import xml.etree.ElementTree as ET
import json
from datetime import datetime
import ssl

# Bypass SSL verification issues occasionally caused by older Python environments
ssl._create_default_https_context = ssl._create_unverified_context

# Only include sources with reliable RSS/Atom feeds
feeds = {
    "bbc": "http://feeds.bbci.co.uk/news/rss.xml",
    "aljazeera": "https://www.aljazeera.com/xml/rss/all.xml",
    
    "chelsea_bbc": "https://feeds.bbci.co.uk/sport/rss/football/teams/chelsea",
    "chelsea_sky": "https://www.skysports.com/rss/12040",
    
    "pitchfork": "https://pitchfork.com/rss/feed",
    "quietus": "https://thequietus.com/feed",
    "aquariumdrunkard": "https://www.aquariumdrunkard.com/feed/",
    
    "bfi": "https://www.bfi.org.uk/rss.xml",
    "criterion": "https://www.criterion.com/current/rss",
    "rogerebert": "https://www.rogerebert.com/feed",
    "filmcomment": "https://www.filmcomment.com/feed/",
    "mubi": "https://mubi.com/notebook/posts.atom",
    "reverseshot": "https://reverseshot.org/rss.xml",
    "sensesofcinema": "https://www.sensesofcinema.com/feed/",
    "indiewire": "https://www.indiewire.com/feed/",
    "variety": "https://variety.com/feed/",
    "hollywoodreporter": "https://www.hollywoodreporter.com/feed/",
    
    "larb": "https://lareviewofbooks.org/feed/",
    "aeon": "https://aeon.co/feed.rss",
    "psyche": "https://psyche.co/feed.rss",
    "publicdomainreview": "https://publicdomainreview.org/rss.xml",
    "quanta": "https://api.quantamagazine.org/feed/",
    "nautilus": "https://nautil.us/feed/",
    "worksinprogress": "https://worksinprogress.co/feed/",
    "noema": "https://www.noemamag.com/feed/"
}

def parse_feed(url):
    items = []
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            xml_data = response.read()
        root = ET.fromstring(xml_data)
        
        # RSS 2.0
        if root.tag == 'rss':
            for item in root.findall('.//item')[:4]:
                title = item.findtext('title')
                link = item.findtext('link')
                if title and link:
                    items.append({"title": title, "link": link})
        # Atom
        elif root.tag.endswith('feed'):
            ns = {'a': 'http://www.w3.org/2005/Atom'}
            for entry in root.findall('.//a:entry', ns)[:4]:
                title = entry.findtext('a:title', default='', namespaces=ns)
                link_el = entry.find('a:link', namespaces=ns)
                link = link_el.get('href') if link_el is not None else ''
                if title and link:
                    items.append({"title": title, "link": link})
    except Exception as e:
        print(f"Failed to parse {url}: {e}")
    return items

data = {
    "last_updated": datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"),
    "feeds": {}
}

for name, url in feeds.items():
    print(f"Fetching {name}...")
    data["feeds"][name] = parse_feed(url)

with open('data.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2)

print("data.json generated successfully.")
