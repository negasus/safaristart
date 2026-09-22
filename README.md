# SafariStart

A start page for Safari: website links organized into folder-like groups.
Groups can be dragged around, colored, resized, collapsed, and separated with line breaks.

## Layout

- `extension/` — Safari Web Extension (Manifest V3), plain HTML/CSS/JS with no build step.
  The new tab page is `newtab.html`; data is stored in `browser.storage.local`.
- `SafariStart/` — Xcode project (the macOS wrapper app). It references the files in `extension/`, so there's no need to copy them.
- `tests/` — data model tests (`node --test`).

## Build and install

```sh
make install   # tests, clean build, app relaunch — also the way to update the extension after changes
```

Or manually:

```sh
xcodebuild -project SafariStart/SafariStart.xcodeproj -scheme SafariStart \
  -configuration Release -derivedDataPath build -allowProvisioningUpdates build
open build/Build/Products/Release/SafariStart.app
```

Or open `SafariStart/SafariStart.xcodeproj` in Xcode and click Run.

Then in Safari:

1. **Settings → Extensions** — enable SafariStart.
2. **Settings → General → New tabs open with** — choose SafariStart
   (and, if you like, the same for new windows).

The app is signed with the development team set in the project. For an unsigned build, enable
**Develop → Allow Unsigned Extensions**; you'll have to turn it on again after every Safari restart.

## Usage

- **Edit** turns on edit mode: you can add groups, links, and breaks, and drag links and groups around. In this mode, clicking a link opens its editor, and clicking its × deletes it.
- Clicking a group's tab collapses or expands it.
- Search: press `/` or just start typing on the page. Arrow keys select a link, Enter opens it, ⌘Enter opens it in a new tab, Esc clears the search.
  When a tab has just opened, focus is in Safari's address bar, so click the page first.
- A break without a label just moves the next group to a new row; a break with a label becomes a section heading.
- The **Separator** button in a group adds a vertical line between links. Drag it like a link, and delete it with its ×.
- Site icons are downloaded once and cached in extension storage. The lookup tries Google's favicon service first,
  then the icons the site declares in its HTML, then `/favicon.ico` (local addresses skip Google). If nothing is found,
  a letter is shown and the lookup is retried after a few days. To download an icon again, open the link's editor
  and click **Refresh icon**. The native app extension does the downloading, because the page can't read
  cross-origin images. When the page is opened outside Safari (`make serve`), icons come straight from Google and aren't cached.

## Development

```sh
make test    # model tests
make serve   # the page in a regular browser at http://localhost:8765/newtab.html (data in localStorage)
```
