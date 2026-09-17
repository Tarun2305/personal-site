const STORAGE_KEY = "reading-desk:v1";

const elements = {
    sidebar: document.getElementById("sidebar"),
    scrim: document.getElementById("scrim"),
    menuButton: document.getElementById("menu-button"),
    sidebarClose: document.getElementById("sidebar-close"),
    categoryNav: document.getElementById("category-nav"),
    title: document.getElementById("view-title"),
    eyebrow: document.getElementById("view-eyebrow"),
    moduleLabel: document.getElementById("module-label"),
    moduleCount: document.getElementById("module-count"),
    sources: document.getElementById("source-directory"),
    directoryView: document.getElementById("directory-view"),
    storyList: document.getElementById("story-list"),
    loadMore: document.getElementById("load-more"),
    empty: document.getElementById("empty-state"),
    emptyTitle: document.getElementById("empty-title"),
    emptyDescription: document.getElementById("empty-description"),
    archiveView: document.getElementById("archive-view"),
    archiveForm: document.getElementById("archive-form"),
    archiveInput: document.getElementById("archive-input"),
    archiveResult: document.getElementById("archive-result"),
    storyTemplate: document.getElementById("story-template"),
    todayCount: document.getElementById("today-count"),
    savedCount: document.getElementById("saved-count"),
    historyCount: document.getElementById("history-count"),
    toast: document.getElementById("toast"),
};

const defaultState = { saved: {}, read: {}, dismissed: {}, lastVisit: null };
let userState = loadState();
const previousVisit = userState.lastVisit ? Date.parse(userState.lastVisit) : null;
const sessionStarted = new Date().toISOString();
let data = { categories: [], sources: [], feeds: {} };
let sourcesById = new Map();
let stories = [];
let currentView = "today";
let toastTimer = null;
let visibleLimit = 24;

function loadState() {
    try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
        return {
            ...defaultState,
            ...stored,
            saved: stored?.saved ?? {},
            read: stored?.read ?? {},
            dismissed: stored?.dismissed ?? {},
        };
    } catch {
        return { ...defaultState };
    }
}

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userState));
    updateCounts();
}

function storyId(link) {
    let hash = 2166136261;
    for (let index = 0; index < link.length; index += 1) {
        hash ^= link.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return `story-${(hash >>> 0).toString(36)}`;
}

function normalizeData(payload) {
    data = payload;
    sourcesById = new Map(data.sources.map(source => [source.id, source]));
    stories = [];

    for (const [sourceId, items] of Object.entries(data.feeds)) {
        const source = sourcesById.get(sourceId);
        if (!source || source.has_feed === false || !Array.isArray(items)) continue;
        items.forEach((item, sourceIndex) => {
            if (!item?.title || !item?.link) return;
            const publishedTime = item.published ? Date.parse(item.published) : 0;
            const discoveredTime = item.discovered ? Date.parse(item.discovered) : 0;
            stories.push({
                ...item,
                id: storyId(item.link),
                source,
                sourceIndex,
                publishedTime: Number.isFinite(publishedTime) ? publishedTime : 0,
                discoveredTime: Number.isFinite(discoveredTime) ? discoveredTime : 0,
            });
        });
    }

}

function buildNavigation() {
    const fragment = document.createDocumentFragment();
    data.categories.forEach(category => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "nav-item";
        button.dataset.view = category.id;

        const label = document.createElement("span");
        label.textContent = category.name;
        const count = document.createElement("span");
        count.className = "nav-count";
        count.dataset.categoryCount = category.id;
        button.append(label, count);
        fragment.appendChild(button);
    });
    elements.categoryNav.replaceChildren(fragment);
}

function validView(value) {
    return ["today", "saved", "history", "archive", "directory", ...data.categories.map(category => category.id)].includes(value);
}

function navigate(view, { updateHash = true } = {}) {
    currentView = validView(view) ? view : "today";
    visibleLimit = 24;
    if (updateHash) history.replaceState(null, "", `#${currentView}`);
    closeSidebar();
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function viewDetails() {
    if (currentView === "today") return { title: "Today", eyebrow: "Your reading desk" };
    if (currentView === "saved") return { title: "Saved", eyebrow: "For later" };
    if (currentView === "history") return { title: "History", eyebrow: "Previously read" };
    if (currentView === "archive") return { title: "Archive lookup", eyebrow: "Utility" };
    if (currentView === "directory") return { title: "Site Directory", eyebrow: "Publications" };
    const category = data.categories.find(item => item.id === currentView);
    return { title: category?.name ?? "Today", eyebrow: "Section" };
}

function selectedStories() {
    let selection = stories.filter(story => !userState.dismissed[story.id]);
    if (currentView === "saved") selection = selection.filter(story => userState.saved[story.id]);
    else if (currentView === "history") selection = selection.filter(story => userState.read[story.id]);
    else if (currentView !== "today") selection = selection.filter(story => story.source.category === currentView);

    return selection.sort((left, right) => {
        return right.publishedTime - left.publishedTime || left.sourceIndex - right.sourceIndex;
    });
}

function render() {
    const details = viewDetails();
    elements.title.textContent = details.title;
    elements.eyebrow.textContent = details.eyebrow;
    elements.moduleLabel.textContent = details.title;
    document.title = `${details.title} · Reading desk`;
    elements.title.classList.toggle("is-long-title", ["directory", "archive"].includes(currentView));

    document.querySelectorAll("[data-view]").forEach(button => {
        button.classList.toggle("is-active", button.dataset.view === currentView);
    });

    const isArchive = currentView === "archive";
    const isDirectory = currentView === "directory";
    elements.sources.hidden = true;
    elements.storyList.hidden = isArchive || isDirectory;
    elements.loadMore.hidden = isArchive || isDirectory;
    elements.archiveView.hidden = !isArchive;
    elements.directoryView.hidden = !isDirectory;
    elements.empty.hidden = true;

    if (isArchive) {
        elements.moduleCount.textContent = "Utility module";
        return;
    }
    if (isDirectory) {
        elements.moduleCount.textContent = `${String(data.sources.length).padStart(3, "0")} sites`;
        renderDirectory();
        return;
    }

    const selection = selectedStories();
    elements.moduleCount.textContent = `${String(selection.length).padStart(3, "0")} entries`;
    renderStories(selection);
    updateCounts();
}

function renderDirectory() {
    const fragment = document.createDocumentFragment();
    data.categories.forEach((category, index) => {
        const section = document.createElement("section");
        section.className = "directory-section";
        const heading = document.createElement("h2");
        heading.textContent = `${String(index + 1).padStart(2, "0")} / ${category.name}`;
        const grid = document.createElement("div");
        grid.className = "directory-grid";
        data.sources.filter(source => source.category === category.id).forEach(source => {
            const link = document.createElement("a");
            link.className = "directory-link";
            link.href = source.url;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            const name = document.createElement("span");
            name.textContent = source.name;
            const status = document.createElement("span");
            status.className = "directory-status";
            status.textContent = `${source.has_feed ? "RSS / Atom" : "Website"} ↗`;
            link.append(name, status);
            grid.appendChild(link);
        });
        section.append(heading, grid);
        fragment.appendChild(section);
    });
    elements.directoryView.replaceChildren(fragment);
}

function renderStories(selection) {
    const fragment = document.createDocumentFragment();
    selection.slice(0, visibleLimit).forEach(story => fragment.appendChild(createStoryCard(story)));
    elements.storyList.replaceChildren(fragment);
    elements.storyList.setAttribute("aria-busy", "false");
    const remaining = Math.max(0, selection.length - visibleLimit);
    elements.loadMore.hidden = remaining === 0;
    elements.loadMore.textContent = `Load ${Math.min(24, remaining)} more`;

    if (selection.length === 0) {
        elements.empty.hidden = false;
        elements.emptyTitle.textContent = currentView === "saved" ? "Nothing saved yet" : currentView === "history" ? "No reading history yet" : "No stories available";
        elements.emptyDescription.textContent = currentView === "saved" ? "Save anything interesting and it will wait here." : "Try another section or come back after the next feed update.";
    }
}

function createStoryCard(story) {
    const card = elements.storyTemplate.content.firstElementChild.cloneNode(true);
    card.dataset.storyId = story.id;
    card.classList.toggle("is-read", Boolean(userState.read[story.id]));
    card.classList.toggle("is-saved", Boolean(userState.saved[story.id]));

    card.querySelector(".story-source").textContent = story.source.feed_name || story.source.name;
    const time = card.querySelector(".story-time");
    time.textContent = story.publishedTime ? relativeDate(story.publishedTime) : "Recently collected";
    if (story.publishedTime) time.dateTime = story.published;

    const isNew = previousVisit && (story.publishedTime || story.discoveredTime) > previousVisit && !userState.read[story.id];
    card.querySelector(".new-badge").hidden = !isNew;
    const title = card.querySelector(".story-title");
    title.textContent = story.title;
    title.href = story.link;
    title.addEventListener("click", event => {
        if (card.dataset.swiped === "true") return event.preventDefault();
        userState.read[story.id] = new Date().toISOString();
        card.classList.add("is-read");
        card.querySelector(".read-button").textContent = "Unread";
        saveState();
    });
    card.querySelector(".story-excerpt").textContent = (story.description ?? "").trim();

    const saveButton = card.querySelector(".save-button");
    saveButton.textContent = userState.saved[story.id] ? "Saved" : "Save";
    saveButton.addEventListener("click", () => toggleSaved(story.id));

    const readButton = card.querySelector(".read-button");
    readButton.textContent = userState.read[story.id] ? "Unread" : "Mark read";
    readButton.addEventListener("click", () => toggleRead(story.id));
    card.querySelector(".dismiss-button").addEventListener("click", () => dismissStory(story.id));
    addSwipeGestures(card, story.id);
    return card;
}

function relativeDate(timestamp) {
    const difference = Date.now() - timestamp;
    if (difference < 0) return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(timestamp);
    const minutes = Math.floor(difference / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(timestamp);
}

function toggleSaved(id, force) {
    const shouldSave = force ?? !userState.saved[id];
    if (shouldSave) userState.saved[id] = new Date().toISOString();
    else delete userState.saved[id];
    saveState();
    render();
    showToast(shouldSave ? "Saved for later" : "Removed from saved");
}

function toggleRead(id, force) {
    const shouldRead = force ?? !userState.read[id];
    if (shouldRead) userState.read[id] = new Date().toISOString();
    else delete userState.read[id];
    saveState();
    render();
}

function dismissStory(id) {
    const dismissedAt = new Date().toISOString();
    userState.dismissed[id] = dismissedAt;
    delete userState.saved[id];
    saveState();
    render();
    showToast("Story dismissed", "Undo", () => {
        delete userState.dismissed[id];
        saveState();
        render();
    });
}

function addSwipeGestures(card, id) {
    let startX = 0;
    let startY = 0;
    let deltaX = 0;
    let trackingPointer = null;
    let swiping = false;
    const inner = card.querySelector(".story-card-inner");

    card.addEventListener("pointerdown", event => {
        if (event.pointerType === "mouse" || event.target.closest("button")) return;
        startX = event.clientX;
        startY = event.clientY;
        deltaX = 0;
        trackingPointer = event.pointerId;
        swiping = false;
    });

    card.addEventListener("pointermove", event => {
        if (trackingPointer !== event.pointerId) return;
        const horizontal = event.clientX - startX;
        const vertical = event.clientY - startY;
        if (!swiping && Math.abs(vertical) > 10 && Math.abs(vertical) > Math.abs(horizontal)) {
            trackingPointer = null;
            return;
        }
        if (!swiping && (Math.abs(horizontal) < 14 || Math.abs(vertical) > Math.abs(horizontal))) return;
        if (!swiping) {
            swiping = true;
            card.setPointerCapture(event.pointerId);
        }
        deltaX = Math.max(-120, Math.min(120, horizontal));
        card.classList.toggle("is-swiping-save", deltaX > 0);
        card.classList.toggle("is-swiping-dismiss", deltaX < 0);
        inner.style.transform = `translateX(${deltaX}px)`;
    });

    card.addEventListener("pointerup", event => {
        if (trackingPointer !== event.pointerId) return;
        trackingPointer = null;
        if (card.hasPointerCapture(event.pointerId)) card.releasePointerCapture(event.pointerId);
        inner.style.transform = "";
        card.classList.remove("is-swiping-save", "is-swiping-dismiss");
        if (!swiping) return;
        card.dataset.swiped = "true";
        if (deltaX > 72) toggleSaved(id, true);
        else if (deltaX < -72) dismissStory(id);
        window.setTimeout(() => { card.dataset.swiped = "false"; }, 250);
    });
    card.addEventListener("pointercancel", () => {
        trackingPointer = null;
        swiping = false;
        inner.style.transform = "";
        card.classList.remove("is-swiping-save", "is-swiping-dismiss");
    });
}

function updateCounts() {
    const visible = stories.filter(story => !userState.dismissed[story.id]);
    elements.todayCount.textContent = String(visible.filter(story => !userState.read[story.id]).length);
    elements.savedCount.textContent = String(Object.keys(userState.saved).length);
    elements.historyCount.textContent = String(Object.keys(userState.read).length);
    document.querySelectorAll("[data-category-count]").forEach(count => {
        const category = count.dataset.categoryCount;
        count.textContent = String(visible.filter(story => story.source.category === category && !userState.read[story.id]).length);
    });
}

function showToast(message, actionLabel, action) {
    window.clearTimeout(toastTimer);
    const text = document.createElement("span");
    text.textContent = message;
    elements.toast.replaceChildren(text);
    if (actionLabel && action) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = actionLabel;
        button.addEventListener("click", () => {
            action();
            elements.toast.classList.remove("is-visible");
        });
        elements.toast.appendChild(button);
    }
    elements.toast.classList.add("is-visible");
    toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 4200);
}

function openSidebar() {
    elements.sidebar.classList.add("is-open");
    elements.scrim.hidden = false;
    elements.menuButton.setAttribute("aria-expanded", "true");
    elements.menuButton.setAttribute("aria-label", "Close menu");
}

function closeSidebar() {
    elements.sidebar.classList.remove("is-open");
    elements.scrim.hidden = true;
    elements.menuButton.setAttribute("aria-expanded", "false");
    elements.menuButton.setAttribute("aria-label", "Open menu");
}

document.addEventListener("click", event => {
    const navButton = event.target.closest("[data-view]");
    if (navButton) navigate(navButton.dataset.view);
});

elements.menuButton.addEventListener("click", () => {
    if (elements.sidebar.classList.contains("is-open")) closeSidebar();
    else openSidebar();
});
elements.sidebarClose.addEventListener("click", closeSidebar);
elements.scrim.addEventListener("click", closeSidebar);
elements.loadMore.addEventListener("click", () => { visibleLimit += 24; render(); });

elements.archiveForm.addEventListener("submit", event => {
    event.preventDefault();
    elements.archiveResult.replaceChildren();
    elements.archiveResult.className = "";
    let value = elements.archiveInput.value.trim();
    if (!value) {
        elements.archiveResult.textContent = "Paste a URL first.";
        elements.archiveResult.className = "is-error";
        return;
    }
    if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
    try {
        const url = new URL(value);
        if (!["http:", "https:"].includes(url.protocol)) throw new Error("Unsupported protocol");
        const link = document.createElement("a");
        link.href = `https://archive.ph/newest/${url.href}`;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Open latest archive snapshot ↗";
        elements.archiveResult.appendChild(link);
    } catch {
        elements.archiveResult.textContent = "Enter a valid web address.";
        elements.archiveResult.className = "is-error";
    }
});

window.addEventListener("hashchange", () => navigate(location.hash.slice(1), { updateHash: false }));

async function initialize() {
    try {
        const response = await fetch("data.json", { cache: "no-cache" });
        if (!response.ok) throw new Error(`Feed request failed: ${response.status}`);
        normalizeData(await response.json());
        buildNavigation();
        navigate(location.hash.slice(1) || "today", { updateHash: false });
        userState.lastVisit = sessionStarted;
        saveState();
    } catch (error) {
        console.error(error);
        elements.storyList.setAttribute("aria-busy", "false");
        elements.empty.hidden = false;
        elements.emptyTitle.textContent = "The reading desk could not load";
        elements.emptyDescription.textContent = location.protocol === "file:" ? "Open this folder through a local web server instead of opening index.html directly." : "The cached publication links may still be available offline after your first successful visit.";
    }

    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
        navigator.serviceWorker.register("service-worker.js", { updateViaCache: "none" }).catch(error => console.warn("Offline mode unavailable", error));
    }
}

initialize();
