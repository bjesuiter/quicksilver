# Quicksilver v1 implementation plan

## Goal

Build a static, local-first PWA that accepts an iPhone video, reads its real media properties, lets the user choose a smaller resolution, frame rate, and video bitrate, converts it in the browser, and saves the result on iPhone or desktop. No media leaves the device.

The first release has one job: turn an iPhone HEVC recording into a smaller, broadly playable MP4 without making the export step fragile.

## Product decisions

- Input: one local `.mov` or `.mp4` file with a primary video track. The main target is HEVC video with AAC audio from an iPhone.
- Output: MP4 with H.264/AVC video. Copy compatible AAC audio when possible; let MediaBunny transcode it only when the source cannot be copied into the output.
- Editable video properties: output width and height, frame rate, and target video bitrate.
- Processing: entirely in the browser with MediaBunny and WebCodecs. GitHub Pages only serves static assets.
- Export: create a named `File` after conversion. Offer `navigator.share({ files: [...] })` as "Save or share" when the browser accepts the file, plus an `<a download>` fallback. The share call must begin from the user's tap.
- Browser floor: iOS/iPadOS 17.4 or newer for the supported iPhone path. Safari 17.4 added WebCodecs HEVC support. Other browsers are supported only when runtime checks confirm that they can decode the input and encode the requested H.264 configuration.
- HDR policy: detect HDR during probing and reject it in v1 with a direct explanation. iPhone Dolby Vision cannot safely be treated as ordinary SDR HEVC, and silent color damage is worse than a clear limitation. HDR support can ship after a real-device spike proves either metadata preservation or a deliberate tone-mapping path.
- Memory model: use MediaBunny's `BufferTarget` only when the estimated output is below 100 MB. Write larger outputs to the Origin Private File System through `StreamTarget`, subject to storage quota. If physical iPhone testing shows that sharing the resulting OPFS-backed file still causes an unsafe allocation, enforce a measured maximum instead of attempting the conversion.
- Offline behavior: cache the application shell and bundled dependencies, never selected or generated media.

MediaBunny already exposes the required metadata and conversion controls. It can read displayed dimensions, compute frame-rate metrics and packet statistics, resize frames, adjust frame rate, and pass an exact bitrate through `new Quality({ bitrate })`. Its conversion API also reports progress and cancellation. See [the research note](docs/research/2026-09-20-browser-video-transcoding-feasibility.md) for the source-backed compatibility details.

## Stack and package policy

Use a client-only Vite application. SolidStart and a router add nothing to this single-screen static tool.

- Solid `2.0.0-rc.9` and `@solidjs/web` `2.0.0-rc.9`
- `@solidjs/vite-plugin` `3.0.0-next.44` with Vite 8
- MediaBunny `1.58.1`
- Tailwind CSS 4 with `@tailwindcss/vite`
- `vite-plugin-pwa` in `generateSW` mode
- Vitest for domain and service tests
- Playwright for browser flow tests that do not depend on a particular hardware codec

Pin the Solid RC packages exactly and upgrade them together. RC and `next` package ranges should not float in the lockfile.

## User flow

1. The empty screen explains that processing stays on the device and presents a large native file input using `accept="video/quicktime,video/mp4,.mov,.mp4"`.
2. After selection, the app enters `probing`. It checks the container, locates the primary video and audio tracks, reads metadata, and tests whether the browser can decode that concrete video track.
3. The ready screen shows source resolution, frame rate, average video bitrate, duration, size, codec, and HDR status. If an exact value requires scanning packets, show a short "Analyzing video" state rather than a fake value.
4. Output controls start from conservative defaults derived from the input. The user can edit resolution, frame rate, and bitrate. Every change updates the size estimate and reruns target encoder capability checks after a short debounce.
5. "Compress video" initializes a fresh output and conversion. The screen shows progress, bytes written, a cancel action, and a note to keep the page open.
6. When conversion finishes, the app shows actual output size and two export paths: "Save or share" when file sharing is supported, and "Download MP4" at all times.
7. "Convert another video" revokes the old object URL, disposes the MediaBunny input, clears the output buffer, and returns to the initial state.

Failures stay in the same screen and tell the user what to do. Distinguish an unreadable file, missing video track, unsupported HEVC decode, unsupported H.264 encode settings, conversion failure, cancellation, and failed export.

## Media pipeline

### Probe the input

Create an `Input` from `BlobSource(file)` and restrict formats to the MP4/MOV parser instead of shipping every MediaBunny format parser. Resolve the following data:

- `input.canRead()` and `input.getMimeType()`
- primary video and audio tracks
- displayed width and height, which account for aspect ratio and rotation
- `videoTrack.computeFrameRateMetrics().bestGuessFrameRate`
- video bitrate from `computePacketStats().averageBitrate`, with a visible analyzing state while packets are scanned
- duration, codec, HDR flag, and audio average bitrate
- `videoTrack.canDecode()` using the file's actual decoder configuration

Keep the `Input` alive through conversion and dispose it whenever the selected file changes or the user resets the app.

### Normalize output settings

Resolution presets should display dimensions computed for the selected video's orientation, for example `1920 x 1080` for landscape and `1080 x 1920` for portrait. Offer Original, 1080p, 720p, 480p, and Custom. Preserve aspect ratio by default, never upscale from a preset, and round encoded dimensions to even integers. Custom mode exposes both dimensions with a linked-aspect toggle.

Frame-rate choices are Original, 60, 30, 24, and Custom. Accept a finite value from 1 to 120 fps. Warn when the requested rate exceeds the source because duplicated frames increase work without adding motion detail.

Bitrate is a decimal Mbps input backed by an integer number of bits per second. Derive a starting value from the source bitrate and selected pixel/frame ratio, then clamp it to a documented safe range. The user remains free to change it. Label it "Target bitrate" because WebCodecs rate control does not promise an exact final average.

All validation lives in pure functions. UI components receive parsed values or field errors, never half-valid numbers.

### Estimate output size

Use this as a display estimate, not a quota or promise:

```text
estimated bytes = duration seconds
                * (target video bits/second + audio bits/second)
                / 8
                * container overhead factor
```

Use the source audio average bitrate when audio can be copied. Fall back to a clearly documented 192 kbps estimate if it is unknown. A small MP4 overhead factor such as 1.02 is enough, but display the result with `~` and explanatory copy because encoder rate control can miss the target. After conversion begins, replace the estimate beside progress with the actual bytes written so far.

### Validate capability and convert

Before enabling conversion:

- confirm the concrete input track can decode;
- call MediaBunny's H.264 encodability check with the requested width, height, frame rate, and `Quality({ bitrate })`;
- initialize `Conversion` and inspect `isValid` plus `discardedTracks` before executing it.

The conversion uses a fresh `Output`, `Mp4OutputFormat`, and an output target chosen by the estimated size:

```ts
video: {
  codec: "avc",
  width,
  height,
  fit: "contain",
  frameRate,
  quality: new Quality({ bitrate }),
  hardwareAcceleration: "prefer-hardware",
  forceTranscode: true,
}
```

Select only the primary tracks in v1. Keep compatible audio on MediaBunny's copy path. Connect `conversion.onProgress`, the target's `write` event, and `conversion.cancel()` to the application state. Do not interpret progress `1` as completion; only the resolved `execute()` promise finishes the job.

For small results, `BufferTarget` returns the final contiguous buffer. For larger results, create a temporary OPFS file and connect its writable stream to `StreamTarget`, preserving each chunk's requested byte position. Check `navigator.storage.estimate()` before starting. Delete abandoned temporary files on cancellation, failure, reset, and startup cleanup. Do not set MP4 `fastStart: "in-memory"` on the streaming path because that would put the media payload back in memory.

Start on the main thread for the first vertical spike. WebCodecs work is asynchronous and often hardware-backed. Keep the media service free of DOM dependencies so it can move into a dedicated worker if iPhone testing finds visible UI stalls.

### Export and clean up

Turn the final buffer or OPFS blob into a `File` with MIME type `video/mp4` and a stable name such as `original-quicksilver.mp4`. Then:

1. Compute `canShare = typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })`.
2. On a direct button tap, call `navigator.share({ files: [file], title: file.name })`. On iPhone this opens the native share sheet, where "Save to Files" is available.
3. Also create an object URL and render a real anchor with `download=file.name`. This is the desktop path and the fallback if sharing is unavailable or dismissed.
4. Revoke the object URL on reset, replacement, or component cleanup. Release references to the buffer and `File` at the same time.

Do not auto-trigger either export path when conversion finishes. Mobile browsers require transient user activation for the share sheet.

## Application shape

Keep the media code outside components so browser APIs are testable behind small interfaces.

```text
src/
  app.tsx
  styles.css
  components/
    FilePicker.tsx
    SourceSummary.tsx
    OutputControls.tsx
    ConversionProgress.tsx
    ExportActions.tsx
    InlineNotice.tsx
  media/
    probe.ts
    capability.ts
    transcode.ts
    targets.ts
    export.ts
  domain/
    media.ts
    output-settings.ts
    estimate-size.ts
    format.ts
  pwa/
    UpdatePrompt.tsx
  test/
    fixtures/
public/
  icons/
```

Model the screen as a discriminated union instead of several unrelated booleans:

```ts
type AppState =
  | { status: "empty" }
  | { status: "probing"; file: File }
  | { status: "ready"; source: SourceMedia; settings: OutputSettings }
  | { status: "converting"; source: SourceMedia; settings: OutputSettings; progress: number }
  | { status: "complete"; source: SourceMedia; result: ConversionResult }
  | { status: "error"; recoverTo: "empty" | "ready"; error: AppError };
```

One owner component holds the state and resource cleanup. Components stay presentational except for their local form fields.

## UI direction

This should look like a dependable utility, not a landing page. Use a single centered work surface, generous spacing, thin dividers, and almost no decoration.

The signature element is a source-to-output comparison. On wide screens the read-only source metrics sit beside editable output values. On iPhone they stack in the same order. This makes the effect of compression legible without adding charts or cards inside cards.

```text
Quicksilver                              Local only

+--------------------------------------------------+
| Choose an iPhone video                          |
+--------------------------------------------------+

Source                         Output
4032 x 2268                    [ 1920 x 1080  v ]
59.94 fps                      [ 30 fps        v ]
42.8 Mbps                      [ 8.0 Mbps        ]
HEVC · HDR · 286 MB            Estimated: ~57 MB

[ Compress video ]
```

Use system UI text for controls and a system monospace stack for media values. This avoids a network font in an offline tool and makes numeric comparisons stable. Suggested tokens:

- canvas: `#F6F7F8`
- surface: `#FFFFFF`
- text: `#17202A`
- muted: `#66717E`
- border: `#D8DEE5`
- action: `#1769E0`
- danger: `#B42318`

Use an 8 px radius, 44 px minimum tap targets, visible focus rings, and no ornamental motion. Respect reduced motion. Keep source and output labels in sentence case and use plain action names: "Choose video", "Compress video", "Cancel", "Save or share", and "Download MP4".

## PWA and GitHub Pages

Set Vite's production base to `/quicksilver/` and derive the web manifest `start_url`, `scope`, icon paths, and service-worker registration from that base. A wrong root-relative path will install a PWA that opens to a GitHub Pages 404.

Use `vite-plugin-pwa` with generated service-worker precaching for `index.html`, hashed JS/CSS, MediaBunny chunks, and local icons. Do not add runtime caching for user files or blob URLs. Show a small update prompt after a new service worker is waiting rather than replacing the running app during a conversion.

Add `.github/workflows/pages.yml` with two jobs:

1. On pull requests and pushes, install with the lockfile, type-check, run unit tests, build, and run a production smoke test.
2. On `main` only, upload `dist/` using `actions/upload-pages-artifact` and deploy it with `actions/deploy-pages` to the `github-pages` environment. Grant only `contents: read`, `pages: write`, and `id-token: write`.

Also run the workflow manually with `workflow_dispatch`. Configure the repository's Pages source as GitHub Actions.

## Delivery phases

### 1. Risk-first vertical spike

- Scaffold the pinned Solid 2, Vite, MediaBunny, and Tailwind project.
- Add one unstyled file input and hard-coded HEVC-to-H.264 MP4 conversion.
- Test short portrait SDR and HDR iPhone HEVC files on a physical iPhone in Safari. The SDR file must convert. The HDR file must be detected and blocked without beginning conversion.
- Verify that the result has audio, correct orientation, expected duration, and opens from the Files app.
- Verify both the native share sheet and download fallback before building the full UI.

This phase is a release gate. If HEVC decoding, H.264 encoding, or file sharing fails on the supported iPhone, stop and revise the architecture before polishing anything.

### 2. Metadata and settings

- Implement probing, typed source metadata, and capability errors.
- Add the source-to-output screen and all three controls.
- Add aspect-ratio handling, validation, defaults, and the live size estimate.
- Unit-test resolution math, even-dimension rounding, bitrate parsing, estimate math, and output naming.

### 3. Production conversion lifecycle

- Add conversion progress, bytes written, cancel, retry, and resource disposal.
- Add the bounded `BufferTarget` path plus OPFS-backed `StreamTarget` for larger projected outputs.
- Add output capability checks and useful mappings for MediaBunny errors.
- Add the completed state with actual before/after sizes.
- Test repeated conversions in one session to catch stale object URLs and retained buffers.

### 4. PWA and deployment

- Add manifest, local icons, service worker, install metadata, and update prompt.
- Configure the `/quicksilver/` base path and GitHub Pages Actions workflow.
- Test first load, offline reload after one online visit, and an app update while idle and while converting.

### 5. Real-device hardening

- Run a small fixture matrix: portrait and landscape, 30 and 60 fps, SDR and HDR HEVC, AAC audio, silent video, and a long file. HDR should take the explicit unsupported path in v1.
- Test Safari tab and installed-PWA modes on the oldest supported iPhone plus one current iPhone.
- Record peak practical input/output sizes and convert them into warnings or enforced limits based on evidence.
- Check orientation, audio sync, duration, target dimensions, measured output frame rate, measured bitrate, cancellation, backgrounding, and Save to Files.

## Acceptance criteria

- A supported iPhone HEVC `.mov` can be selected without upload or network requests for media.
- HDR input is detected before conversion and gets a clear unsupported message in v1.
- The app shows displayed resolution, best-guess frame rate, and average or clearly labeled estimated video bitrate.
- The user can set output dimensions, frame rate, and target bitrate, with field-level validation.
- The screen shows an approximate output size before conversion.
- The output is an MP4 with H.264 video, preserved orientation, synchronized audio, and the chosen dimensions and frame rate within codec tolerances.
- Progress moves during conversion, cancellation returns to a usable ready state, and a second conversion works without reloading.
- On supported iPhone Safari, tapping "Save or share" opens the native share sheet with the generated MP4 and allows Save to Files.
- A separate download link works in supporting browsers and remains available after a canceled share sheet.
- The app reloads offline after one successful online visit.
- The deployed GitHub Pages build works under `https://bjesuiter.github.io/quicksilver/`, including its manifest, icons, and service worker.
- Outputs projected above the in-memory threshold either use OPFS streaming successfully or stop before conversion with a storage or device-limit message.

## Deliberately deferred

- Multiple input files and batch conversion
- Timeline trimming, cropping, filters, subtitles, and audio controls
- HEVC output selection and codec tuning beyond target bitrate
- Server fallback for unsupported browsers
- Resumable conversions after the browser kills or reloads the page
- HDR/Dolby Vision preservation and tone mapping
- Guaranteed conversion beyond the measured OPFS and iPhone export limits
- Background conversion while the PWA is suspended

These are useful later, but each makes the first iPhone export path harder to prove.

## Primary references

- [MediaBunny reading guide](https://mediabunny.dev/guide/reading-media-files)
- [MediaBunny conversion guide](https://mediabunny.dev/guide/converting-media-files)
- [MediaBunny writing guide](https://mediabunny.dev/guide/writing-media-files)
- [MediaBunny supported codecs](https://mediabunny.dev/guide/supported-formats-and-codecs)
- [Safari 17.4 HEVC WebCodecs release notes](https://developer.apple.com/documentation/safari-release-notes/safari-17_4-release-notes)
- [Solid 2 release candidates](https://github.com/solidjs/solid/releases)
- [Tailwind CSS with Vite](https://tailwindcss.com/docs/installation/using-vite)
- [Vite PWA Solid example](https://vite-pwa-org.netlify.app/examples/solidjs.html)
- [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
