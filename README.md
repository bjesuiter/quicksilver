# Quicksilver

A local-first media transcoding PWA.

## Why

Browser-based media tools can be useful, but the workflow breaks down when a video converts successfully and cannot be exported on iOS. I want a small tool I can trust for recurring media conversions—without uploading personal media to a server.

## What I want to build

- Convert video and audio locally in the browser.
- Make common conversion workflows quick on iPhone and desktop.
- Export reliably on iOS, especially through **Save to Files** and the share sheet.
- Keep the interface focused: choose a file, choose an output, convert, export.
- Use MediaBunny as a likely building block.

## Status

Version 0.1 converts supported SDR video and audio locally. It reads MP4, MOV, WebM, MKV, MP3, WAV, AAC, Ogg, FLAC, and MPEG-TS media, then writes H.264 MP4 video or AAC M4A audio. The browser verifies the selected media's decode and output encode capabilities before conversion.

HDR and Dolby Vision inputs are detected and blocked because version 0.1 does not have a verified color-preservation or tone-mapping path.

## Development

```sh
npm install
npm run dev
```

The app runs at `http://localhost:5173/quicksilver/`. Before pushing a change, run:

```sh
npm run typecheck
npm run build
npm run test:e2e -- --project=chromium
```

The full GitHub Actions suite also runs the mobile Chromium and mobile WebKit projects before deploying `dist/` to GitHub Pages.

## Releases

Production changes get a Changeset. Run `npm run changeset`, select the semver bump, and describe the user-facing change. After the pull request merges, the release workflow collects pending Changesets into a version pull request. Merging that pull request updates `package.json` and `CHANGELOG.md`, then deploys the new version to GitHub Pages.

For changes that do not need a release, use `npm run changeset -- --empty`.

Repository administrators must enable **Allow GitHub Actions to create and approve pull requests** in GitHub Actions settings so the release workflow can open its version pull request.

## Planning

- [Quicksilver v1 implementation plan](PLAN.md)
- [Browser transcoding feasibility research](docs/research/2026-09-20-browser-video-transcoding-feasibility.md)

---
Agent disclosure: Submitted by Igris 🔥 (AI agent) on JB's behalf · Initiative: JB-directed
