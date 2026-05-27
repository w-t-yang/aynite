# Integrations

Aynite integrates with external services to bring your data into the workspace. Data from these services is cached locally under `~/.aynite/` — you own the cached content, not the service provider.

---

## RSS Reader

The RSS reader lets you subscribe to feeds, organize them into groups, bookmark articles, and even summarize them with AI.

### Adding Feeds

1. Open the **RSS** view from a tile
2. Click **+ Feed** in the sidebar
3. Enter the feed URL (e.g., `https://example.com/feed.xml`)
4. The feed is fetched and articles appear in the main view

### Managing Feeds

| Action | How |
|--------|-----|
| Add group | Click **+ Group**, enter a name |
| Organize feeds | Drag feeds into groups |
| Refresh feed | Click the refresh button on a feed |
| Remove feed | Right-click → Remove |

### Reading Articles

- **Article List** — Shows headlines, timestamps, and source badges
- **Today's Articles** — Click **📅 Today** to see articles published today across all feeds
- **Bookmarks** — Click **Saved** to view bookmarked articles
- **Open in Browser** — Links open in your system browser (not in-app)

### AI Summarization

Each article has a **Summary** button that uses your AI provider to generate a concise summary of the article content. Summaries are cached locally so they don't need to be regenerated.

1. Open an article
2. Click **Summary**
3. The AI fetches the article text and generates a summary
4. Toggle between **Original** and **Summary** views

### Search

- **All view** — Shows articles from all feeds, grouped by date
- **Feed view** — Shows articles from a single feed, grouped by date
- **Bookmarks** — Shows all saved articles

---

## Spotify

The Spotify integration lets you browse your library, search for music, and control playback — all from within Aynite.

### Setup

1. Open the **Spotify** view from a tile
2. Click **Connect to Spotify**
3. You'll be redirected to Spotify's authorization page
4. Grant access — Aynite stores your profile, playlists, and recently played tracks locally

### Features

| Feature | What It Does |
|---------|-------------|
| **Browse** | View your playlists, saved tracks, top artists |
| **Search** | Search for artists, albums, tracks |
| **Playback** | Control playback on your active Spotify device |
| **Recently Played** | See your listening history |

### Data Storage

Spotify data is cached in `~/.aynite/spotify/`:
- `profile.json` — Your Spotify profile
- `playlists.json` — Your playlist library
- `saved-tracks.json` — Your saved/liked tracks
- `recently-played.json` — Your listening history
- `top-artists.json` / `top-tracks.json` — Your top charts

---

## Custom Integrations

You can integrate any service that has an API or SDK by creating a **command** or **skill**:

- **Commands** (`>`) — For API calls, data fetching, file processing
- **Skills** (`/`) — For AI-guided workflows that interact with services

See the [Extending Aynite guide](EXTENDING_AYNITE.md) for details.

### The `aynite-resource://` Protocol

Aynite registers a custom protocol (`aynite-resource://`) for serving local files to iframe-based views. This is used internally by dataviews and fileviews to load data and media files, and supports HTTP Range requests for media streaming.
