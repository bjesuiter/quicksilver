# Browser video transcoding feasibility

Date: 2026-09-20

## Short answer

The proposed first version is feasible as a static, client-only PWA on recent iPhones. Solid renders the interface, while Mediabunny reads the container, manages the conversion pipeline, and writes the result. The browser still does the actual HEVC decoding and video encoding through WebCodecs.

That last boundary matters. Mediabunny can request a new resolution, frame rate, and target bitrate, but it does not ship an HEVC or H.264 codec in its browser package. A conversion works only when the current browser and device can decode the source configuration and encode the requested output configuration. The WebCodecs specification deliberately permits a browser to support any codec set, including none, so version checks alone are not enough. The app must test the selected file and output settings at runtime ([WebCodecs specification](https://www.w3.org/TR/webcodecs/), [Mediabunny codec capability API](https://mediabunny.dev/guide/supported-formats-and-codecs)).

For v1, use iOS/Safari 17.4 as the practical minimum for iPhone HEVC input. Safari first shipped video WebCodecs in 16.4, and Safari 17.4 added HEVC support ([WebKit Safari 17.4 notes](https://webkit.org/blog/15063/webkit-features-in-safari-17-4/), [Apple Safari 17.4 release notes](https://developer.apple.com/documentation/safari-release-notes/safari-17_4-release-notes)). Show a clear unsupported-device message instead of trying a conversion that will fail.

## Stack and setup

Use a plain Solid Vite SPA, not SolidStart. The project has one screen and no server routes, and GitHub Pages only serves static files.

Solid 2.0 is currently a release candidate. The latest official release is `solid-js@2.0.0-rc.9`, released on 2026-09-18. Pin the exact RC versions for reproducible builds instead of using a floating prerelease range ([Solid releases](https://github.com/solidjs/solid/releases)). The Solid 2.0 announcement recommends the Solid v2 templates from `npm create solid@latest`; its new `@solidjs/vite-plugin` uses the new compiler by default ([Solid 2.0 RC announcement](https://github.com/solidjs/solid/discussions/2995)).

Suggested dependencies:

```text
solid-js@2.0.0-rc.9
@solidjs/web@2.0.0-rc.9
@solidjs/vite-plugin             # pin the template's compatible version
mediabunny                       # pin the version selected during implementation
vite
typescript
tailwindcss
@tailwindcss/vite
vite-plugin-pwa
workbox-window
```

Tailwind 4's official Vite integration is `@tailwindcss/vite`, with `@import "tailwindcss"` in the main stylesheet ([Tailwind Vite setup](https://tailwindcss.com/docs/upgrade-guide#using-vite)). `vite-plugin-pwa` supplies a Solid-specific service-worker registration module at `virtual:pwa-register/solid` and requires `workbox-window` when that module is used ([Vite PWA Solid integration](https://vite-pwa-org.netlify.app/frameworks/solidjs)).

Solid 2.0 is still prerelease software. Keep framework-specific code small, commit the lockfile, and treat RC upgrades as deliberate work.

## Input and metadata

Construct a Mediabunny `Input` from the selected browser `File`:

```ts
const input = new Input({
  source: new BlobSource(file),
  formats: ALL_FORMATS,
});
```

Mediabunny reads MP4 and MOV, the usual containers for iPhone HEVC footage ([Mediabunny README](https://github.com/Vanilagy/mediabunny/blob/main/README.md)). Validate `await input.canRead()`, then retrieve `await input.getPrimaryVideoTrack()`. Reject files with no video track.

Read the requested fields as follows:

| UI value | Mediabunny call | Notes |
| --- | --- | --- |
| Resolution | `getDisplayWidth()` and `getDisplayHeight()` | Use display dimensions, which include pixel-aspect and rotation adjustments. Coded width and height can be misleading for portrait iPhone video. |
| Frame rate | `computeFrameRateMetrics()` | Mediabunny derives this from frame timestamps because container metadata is unreliable. The result can reveal variable-frame-rate input. |
| Video bitrate | `computePacketStats().averageBitrate` | This scans encoded packets and reports actual average bits per second. `getAverageBitrate()` is faster but reads metadata that may not match the media data. |
| Duration | `computeDuration()` | Needed for the size estimate and progress display. |
| Codec | `getCodec()` and `getCodecParameterString()` | Show HEVC plus the codec string when useful for diagnostics. |

These methods are documented on [`InputVideoTrack`](https://mediabunny.dev/api/InputVideoTrack). Packet statistics expose `averagePacketRate` and `averageBitrate` as well ([`PacketStats`](https://mediabunny.dev/api/PacketStats)). Metadata extraction may scan much of a large file, so show a separate "Inspecting video" state and allow the file to be replaced.

Label bitrate precisely. The video track bitrate is not the same as the whole-file bitrate because the file also contains audio and container overhead.

Before enabling conversion, run `await videoTrack.canDecode()` and test the exact output combination with `canEncodeVideo(codec, { width, height, frameRate, quality })`. Do the same for audio if it must be transcoded. Capability can vary by device, codec profile, dimensions, and rate, even on the same Safari version ([Mediabunny `canEncodeVideo`](https://mediabunny.dev/api/canEncodeVideo)).

## Changing resolution, frame rate, and bitrate

Mediabunny's high-level `Conversion` API directly supports all three requested controls:

```ts
const output = new Output({
  format: new Mp4OutputFormat(),
  target,
});

const conversion = await Conversion.init({
  input,
  output,
  tracks: 'primary',
  video: {
    width: targetWidth,
    height: targetHeight,
    fit: 'contain',
    frameRate: targetFps,
    codec: outputCodec,
    quality: new Quality({ bitrate: targetVideoBitrate }),
    forceTranscode: true,
  },
  audio: {
    codec: 'aac',
    quality: new Quality({ bitrate: targetAudioBitrate }),
  },
});
```

`width`, `height`, `fit`, `frameRate`, `codec`, and `quality` are part of `ConversionVideoOptions` ([API reference](https://mediabunny.dev/api/ConversionVideoOptions), [conversion guide](https://mediabunny.dev/guide/converting-media-files)). Use `Quality({ bitrate })`; Mediabunny has deprecated the older top-level `bitrate` option in favor of the `quality` field ([Mediabunny quality API](https://mediabunny.dev/blog/quantizer-support)).

The bitrate is a target, not a byte-for-byte output guarantee. VBR is the default, and the WebCodecs specification leaves the exact fluctuation in both variable and constant modes to the implementation ([WebCodecs rate-control note](https://www.w3.org/TR/webcodecs/#dom-videoencoderconfig-bitratemode)). Resolution and frame-rate reduction still save decode, transform, and encode work, but when the user fixes a bitrate they do not by themselves define the output size.

Call `Conversion.init()` before starting and inspect `conversion.isValid` and `conversion.discardedTracks`. Do not silently publish a file after Mediabunny discarded its only video or audio track. Set `conversion.onProgress` before `execute()`, show percent and processed time, and expose a cancel button that calls `conversion.cancel()` ([`Conversion` API](https://mediabunny.dev/api/Conversion)).

Leave MP4 `fastStart` at its target-aware default unless testing shows a reason to override it. Mediabunny defaults to `'in-memory'` with `BufferTarget`, but defaults to metadata-at-end mode with other targets. Explicit `'in-memory'` fast start would hold all media chunks in memory and defeat the large-file streaming path ([MP4 output options](https://mediabunny.dev/guide/output-formats#mp4)).

### Output choice

Mediabunny can write MP4, MOV, WebM, MKV, HLS, WAVE, MP3, Ogg, FLAC, ADTS, MPEG-TS, and CMAF, subject to each container's supported codecs ([output-format API](https://mediabunny.dev/api/OutputFormat), [format guide](https://mediabunny.dev/guide/output-formats)). That breadth is useful later, but v1 should produce one `.mp4` file.

Recommended v1 policies:

- Keep AAC audio and write MP4.
- Prefer HEVC output on iPhone when the exact requested configuration passes `canEncodeVideo('hevc', ...)`. This keeps the compression benefit of the source codec.
- Offer H.264/AVC MP4 as a compatibility mode when `canEncodeVideo('avc', ...)` passes. AVC output is more portable outside Apple devices but may need more bits for similar visual quality.
- Do not choose WebM as the only output merely because Safari now supports it. MP4 fits the iPhone save, share, and Photos workflow better.

Current WebKit accepts both `hev1.*` and `hvc1.*` WebCodecs encoder configurations when HEVC is enabled ([WebKit encoder source](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/Modules/webcodecs/WebCodecsVideoEncoder.cpp)). Still probe every requested configuration. HEVC support does not imply that every profile, bit depth, frame size, or frame rate will encode.

### HDR is a release decision

Recent iPhones can record Dolby Vision as 10-bit HEVC ([Apple HDR video guide](https://developer.apple.com/av-foundation/Incorporating-HDR-video-with-Dolby-Vision-into-your-apps.pdf)). V1 should either preserve supported HDR input and test it explicitly, or reject HDR/Dolby Vision with a plain explanation. Quietly converting HDR through an SDR canvas risks washed-out or shifted color. A robust HDR-to-SDR tone-mapping feature is separate work and should not be implied by "take iPhone HEVC."

## Estimated output size

Show an estimate, not a promise:

```text
estimated bytes = duration seconds × (target video bps + target audio bps) / 8
```

Add a small allowance for container overhead, or present a range such as plus or minus 10 percent until measurements justify a narrower range. If audio is copied, use its measured average bitrate. If audio is re-encoded, use the chosen audio target. Update the estimate as the user edits settings.

During conversion, the target's `write` event gives the actual high-water byte offset, so the UI can show bytes produced so far ([Mediabunny conversion guide](https://mediabunny.dev/guide/converting-media-files)).

## Memory and long-video constraints

`BufferTarget` builds one contiguous `ArrayBuffer`. Mediabunny recommends it only for small-ish files below roughly 100 MB and warns that large outputs can crash the page from memory exhaustion. `StreamTarget` supports backpressure and disk or network sinks ([writing guide](https://mediabunny.dev/guide/writing-media-files)). This is a hard product constraint for phone-shot 4K video.

For the first version:

1. Use `BufferTarget` only below a conservative input or estimated-output threshold. Make the threshold configurable after physical-device testing.
2. For larger jobs, spool output to the Origin Private File System with a `StreamTarget`, then obtain a `File` or `Blob` for export. WebKit added OPFS on iOS 15.2; the files are origin-private rather than directly visible in Files ([WebKit OPFS announcement](https://webkit.org/blog/12257/the-file-system-access-api-with-origin-private-file-system/)).
3. Query `navigator.storage.estimate()` first and handle quota and eviction errors. Safari storage limits and eviction policy remain browser-controlled ([WebKit storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/)).
4. Keep decoding and encoding bounded, respect Mediabunny's backpressure, and release samples as soon as the pipeline finishes with them. WebCodecs warns that codec CPU, GPU, and hardware resources can be exhausted and must be released promptly ([WebCodecs resource model](https://www.w3.org/TR/webcodecs/#codec-processing-model)).
5. Warn users to keep the app foregrounded, and persist no selected video in service-worker caches.

There is no trustworthy universal iPhone file-size ceiling. Test 1080p, 4K, long-duration, variable-frame-rate, portrait, and HDR clips on physical low-memory and current devices.

## Save, share, and download on iPhone

Do not attempt to open the share sheet automatically when conversion finishes. Render a fresh "Save or share" button after the file is ready. Its tap should synchronously enter this path:

```ts
const file = new File([resultBlob], outputName, { type: 'video/mp4' });

if (navigator.canShare?.({ files: [file] })) {
  await navigator.share({ files: [file] });
} else {
  // expose a normal <a href={objectUrl} download={outputName}>Download</a>
}
```

Safari 15 added sharing of files through the Web Share API ([WebKit Safari 15 notes](https://webkit.org/blog/11989/new-webkit-features-in-safari-15/)). The W3C specification requires `navigator.share()` to run with transient user activation and documents `navigator.canShare({ files })` as the capability check ([Web Share specification](https://www.w3.org/TR/web-share/)). WebKit notes that activation can expire while awaiting a slow operation, so conversion must finish before the user taps the share button ([WebKit user activation guide](https://webkit.org/blog/13862/the-user-activation-api/)).

Pass the file alone in the share payload for the most reliable iOS behavior. Keep an `<a download>` backed by an object URL as the visible fallback. Create the object URL once the output is finalized, keep it alive through the user's interaction, then revoke it when the result is replaced or the component is disposed. WebKit documents blob-backed download links, although older iOS releases have had filename and preview quirks ([WebKit download attribute notes](https://webkit.org/blog/7477/new-web-features-in-safari-10-1/)).

This export design needs the final file to exist as a `Blob` or `File`. OPFS keeps peak processing memory down, but creating a shareable in-memory `File` may still require a large allocation. Physical-device testing will decide whether v1 needs a maximum export size or a second, platform-specific save route.

## PWA and GitHub Pages deployment

WebCodecs requires a secure context. GitHub Pages serves `github.io` sites over HTTPS, which satisfies that requirement ([WebCodecs interfaces](https://www.w3.org/TR/webcodecs/), [GitHub Pages HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)). Video bytes stay on the device; Pages serves only the app.

For a project site at `https://<username>.github.io/quicksilver/`, set Vite's base to `/quicksilver/`. Use `/` only for a user-site repository or custom domain. Vite rewrites imported assets for the configured base, while dynamically built paths should use `import.meta.env.BASE_URL` ([Vite GitHub Pages guide](https://vite.dev/guide/static-deploy#github-pages), [Vite public base path](https://vite.dev/guide/build#public-base-path)).

Configure the manifest `start_url`, manifest `scope`, icons, service-worker registration, and precache URLs under the same base. Cache the hashed app shell and Mediabunny bundle. Do not cache user-selected or generated videos.

Use the official Pages Actions flow:

1. Check out the repository and set up Node.
2. Run the locked install, type check, tests, and production build.
3. Run `actions/configure-pages`.
4. Upload `dist` with `actions/upload-pages-artifact`.
5. Deploy with `actions/deploy-pages` in the `github-pages` environment.

The workflow needs `contents: read`, `pages: write`, and `id-token: write` permissions ([GitHub custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)).

## Suggested implementation sequence

1. Scaffold the pinned Solid 2 Vite app, Tailwind, and a base-aware PWA shell.
2. Build the file picker and metadata inspection path. Test actual iPhone `.mov` and `.mp4` HEVC files before building the settings form.
3. Add capability checks and a single MP4 conversion preset. Start with AVC/AAC for compatibility, then add HEVC output when device tests pass.
4. Add editable width and height with locked aspect ratio by default, FPS presets bounded by the source rate, and a video bitrate control expressed in Mbps.
5. Add the approximate size calculation, validation, conversion progress, cancel, and clear error states.
6. Add `BufferTarget` for bounded files and OPFS streaming for larger files. Test cancellation and cleanup for both paths.
7. Add the user-triggered Share API route and persistent download-link fallback.
8. Exercise the production build under `/quicksilver/`, install it to an iPhone home screen, run an offline conversion, and verify share/save after relaunch.
9. Add GitHub Actions deployment only after the production-base and PWA smoke tests pass.

## Acceptance checks for v1

- A supported iPhone HEVC MOV/MP4 can be selected without uploading it.
- The UI reports display resolution, timestamp-derived FPS, and measured average video bitrate.
- The user can change output resolution, FPS, and target video bitrate, with aspect ratio preserved by default.
- Unsupported decode or encode configurations fail before conversion with a useful message.
- MP4 output retains the primary audio track, reports progress, can be canceled, and produces a playable file.
- The size estimate is labeled approximate and includes audio.
- A new button tap opens the iOS share sheet with the completed MP4; a persistent download link remains available.
- The app works at the GitHub Pages project path, installs as a PWA, launches offline, and can process a local file selected while offline.
- Large-file behavior has a tested limit or uses OPFS rather than relying on an unbounded `BufferTarget`.
- HDR input is either verified end to end or rejected explicitly. No silent color conversion ships.
