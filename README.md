# tenderfern iPad check

Static pages for finding out what an embedded player does on an iPad when Screen Time allows only listed websites. There is no build step and no dependency. The pages load nothing from any host but this site and the embed hosts the player page asks for. An account selector on every page records the kind of account only, and every log line carries that kind together with whether the page is a browser tab or a home-screen web app.

Version **2026-10-04.1**. The same string is in `docs/config.js`, in each page header, and on the CSS and JavaScript links, so a published update is not served from cache.

The published site is [https://tenderfern.github.io/ipad-check/](https://tenderfern.github.io/ipad-check/). The allowlist entry for it is exactly `tenderfern.github.io`, never `github.io`.

## Run locally

The site is the `docs/` directory. From this directory:

```bash
python -m http.server 8000 -d docs
```

Open `http://localhost:8000/`. The check itself is run on the iPad, against the published site, because Screen Time is the thing under test.

## Pages

These files are in `docs/`.

| Page | What it is for |
|---|---|
| `index.html` | What this is, links, and what the device reports (touch, standalone, viewport, user agent, time). iPadOS Safari reports a Mac user agent, so the iPadOS version is typed here. |
| `procedure.html` | The run order: baseline, allowlist, ads, pairing, and sign-in. Screen Time controls are named by what they do. |
| `player.html` | Three embed modes, the video set, a start time, `rel=0`, and the guard. Every API event, script load, guard poll, and plain-mode message is logged on screen. Sign-in prompt seen marks a sign-in or bot-check message. |
| `storage.html` | A token in localStorage, IndexedDB, and a script-written cookie, plus `persist()` and `persisted()`. A Safari tab and a home-screen web app keep separate storage. |
| `results.html` | A field for each run and each question. Drafts stay in localStorage. Export Markdown, with the log attached, and save it as `results/<date>-<device>.md`. |
| `har.html` | Desktop only. Reads a HAR file in the page and lists hosts. Nothing is uploaded. |

`docs/har-sample.json` is a made-up HAR for checking the hosts page. It is not a capture. Do not commit a real HAR: a HAR can hold cookies and headers. Commit the host list inside the results note.

Copy, Share, and Download on the log are the three ways a result leaves the iPad.

## Publish

From a public repository `tenderfern/ipad-check`, GitHub Pages, deploy from the `main` branch, folder `/docs`. The site is then served at `https://tenderfern.github.io/ipad-check/`.

## Not affiliated with YouTube

tenderfern is an independent project. "YouTube" is a trademark of Google LLC; tenderfern is
not endorsed by or affiliated with YouTube or Google.
