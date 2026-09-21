import { createMemo, createSignal, onCleanup, Show } from "solid-js";

import { formatBytes } from "../domain/format";
import type { ImageTarget, SourceImage } from "../domain/media";
import { outputTarget } from "../domain/outputTarget";
import { convertImage, type ImageConversionSettings, type ImageFormat } from "../image/convert";

type ImageWorkspaceProps = {
  source: SourceImage;
  target: ImageTarget;
  onChangeTarget: () => void;
  onReset: () => void;
};

const formatNames: Record<ImageFormat, string> = {
  "image/avif": "AVIF",
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "image/webp": "WebP"
};

const qualityLevels = [
  { value: 60, label: "Smaller file" },
  { value: 80, label: "Balanced" },
  { value: 95, label: "Best quality" }
] as const;

export function ImageWorkspace(props: ImageWorkspaceProps) {
  const target = () => outputTarget(props.target);
  const format = () => target().mimeType as ImageFormat;
  const initialDimensions = format() === "image/avif" ? fitAvifDimensions(props.source.width, props.source.height) : props.source;
  const [settings, setSettings] = createSignal<ImageConversionSettings>({
    format: format(),
    width: initialDimensions.width,
    height: initialDimensions.height,
    quality: 80
  });
  const [converting, setConverting] = createSignal(false);
  const [result, setResult] = createSignal<{ file: File; url: string }>();
  const [error, setError] = createSignal<string>();
  const [aspectRatioLocked, setAspectRatioLocked] = createSignal(true);
  const maxWidth = () => format() === "image/avif" ? 4096 : 8192;
  const maxHeight = () => format() === "image/avif" ? 2304 : 8192;
  const valid = createMemo(() => Number.isInteger(settings().width) && Number.isInteger(settings().height) && settings().width >= 1 && settings().height >= 1 && settings().width <= maxWidth() && settings().height <= maxHeight());
  let disposed = false;

  const clearResult = () => {
    const current = result();
    if (current) URL.revokeObjectURL(current.url);
    setResult(undefined);
  };

  onCleanup(() => {
    disposed = true;
    clearResult();
  });

  const updateDimension = (key: "width" | "height", value: string) => {
    const dimension = Math.round(Number(value));
    if (!aspectRatioLocked()) {
      setSettings((current) => ({ ...current, [key]: dimension }));
      return;
    }

    const counterpart = key === "width"
      ? Math.round((dimension * props.source.height) / props.source.width)
      : Math.round((dimension * props.source.width) / props.source.height);
    setSettings((current) => key === "width"
      ? { ...current, width: dimension, height: counterpart }
      : { ...current, height: dimension, width: counterpart });
  };

  const convert = async () => {
    if (!valid()) return;
    clearResult();
    setError(undefined);
    setConverting(true);
    try {
      const file = await convertImage(props.source, settings());
      if (disposed) return;
      setResult({ file, url: URL.createObjectURL(file) });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The image could not be converted.");
    } finally {
      setConverting(false);
    }
  };

  const shareResult = async () => {
    const current = result();
    if (!current || !navigator.canShare?.({ files: [current.file] })) return;
    try {
      await navigator.share({ files: [current.file], title: current.file.name });
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) setError("The share sheet could not be opened. Use the download instead.");
    }
  };

  return (
    <section class="w-full" aria-labelledby="image-name">
      <div class="flex flex-wrap items-start justify-between gap-5">
        <div class="min-w-0">
          <p class="mb-2 font-mono text-xs font-medium tracking-[0.12em] text-[#1769e0] uppercase">Ready to convert</p>
          <h1 id="image-name" class="max-w-3xl truncate text-3xl font-semibold tracking-[-0.045em] sm:text-5xl" title={props.source.file.name}>{props.source.file.name}</h1>
          <p class="mt-3 text-sm text-[#65717f]">{formatBytes(props.source.file.size)} · {props.source.width} × {props.source.height} · {props.source.file.type.replace("image/", "").toUpperCase()}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="min-h-11 rounded-lg border border-[#cbd4de] bg-white px-4 text-sm font-medium hover:border-[#98a6b5] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#1769e0]" onClick={props.onChangeTarget}>Change output format</button>
          <button type="button" class="min-h-11 rounded-lg border border-[#cbd4de] bg-white px-4 text-sm font-medium hover:border-[#98a6b5] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#1769e0]" onClick={props.onReset}>Choose another source</button>
        </div>
      </div>

      <Show when={result()} fallback={
        <div class="mt-10 grid overflow-hidden rounded-xl border border-[#d9e0e8] bg-white lg:grid-cols-2">
          <div class="p-6 sm:p-8">
            <p class="font-mono text-xs font-medium tracking-[0.12em] text-[#65717f] uppercase">Source</p>
            <dl class="mt-7 grid gap-7"><Metric label="Dimensions" value={`${props.source.width} × ${props.source.height}`} /><Metric label="File type" value={props.source.file.type.replace("image/", "").toUpperCase()} /></dl>
          </div>
          <div class="border-t border-[#d9e0e8] p-6 sm:border-t-0 sm:border-l sm:p-8">
            <p class="font-mono text-xs font-medium tracking-[0.12em] text-[#1769e0] uppercase">Output</p>
            <div class="mt-7 grid gap-5">
              <div><p class="text-sm text-[#65717f]">Output format</p><p class="mt-2 min-h-11 rounded-lg border border-[#cbd4de] bg-[#fbfcfd] px-3 py-2 font-mono text-base">{target().title} · {target().detail}</p></div>
              <div class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-3">
                <NumberInput label="Output width" value={settings().width} max={maxWidth()} onInput={(value) => updateDimension("width", value)} />
                <button
                  type="button"
                  class="mb-0 flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-[#cbd4de] bg-[#fbfcfd] text-[#65717f] hover:border-[#98a6b5] hover:text-[#18212b] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#1769e0]"
                  aria-label="Keep aspect ratio"
                  aria-pressed={aspectRatioLocked() ? "true" : "false"}
                  title={aspectRatioLocked() ? "Aspect ratio locked" : "Aspect ratio unlocked"}
                  onClick={() => { setAspectRatioLocked((locked) => !locked); }}
                >
                  <ChainIcon />
                </button>
                <NumberInput label="Output height" value={settings().height} max={maxHeight()} onInput={(value) => updateDimension("height", value)} />
              </div>
              <Show when={format() !== "image/png"}>
                <label class="block">
                  <span class="text-sm text-[#65717f]">Output quality</span>
                  <select
                    class="mt-2 min-h-11 w-full rounded-lg border border-[#cbd4de] bg-[#fbfcfd] px-3 font-mono text-base"
                    aria-label="Output quality"
                    value={String(settings().quality)}
                    onChange={(event) => setSettings((current) => ({ ...current, quality: Number(event.currentTarget.value) }))}
                  >
                    {qualityLevels.map((level) => <option value={String(level.value)} selected={level.value === settings().quality}>{level.label}</option>)}
                  </select>
                </label>
              </Show>
            </div>
          </div>
        </div>
      }>
        {(current) => <div class="mt-10 overflow-hidden rounded-xl border border-[#d9e0e8] bg-white p-6 sm:p-10"><p class="font-mono text-xs font-medium tracking-[0.12em] text-[#18794e] uppercase">Conversion complete</p><h2 class="mt-2 text-3xl font-semibold tracking-[-0.045em] sm:text-5xl">Image ready</h2><p class="mt-4 text-[#65717f]">{formatBytes(current().file.size)} · {formatNames[format()]}</p><div class="mt-8 flex flex-col gap-3 sm:flex-row"><Show when={navigator.canShare?.({ files: [current().file] })}><button type="button" class="min-h-12 rounded-lg bg-[#1769e0] px-6 font-semibold text-white hover:bg-[#0f5dcf]" onClick={shareResult}>Save or share</button></Show><a class="flex min-h-12 items-center justify-center rounded-lg border border-[#cbd4de] px-6 font-semibold hover:border-[#98a6b5]" href={current().url} download={current().file.name}>Download image</a><button type="button" class="min-h-12 rounded-lg border border-[#cbd4de] px-6 font-semibold hover:border-[#98a6b5]" onClick={clearResult}>Convert again</button></div></div>}
      </Show>

      <Show when={!result()}><div class="mt-6 flex items-center justify-between gap-5 rounded-xl bg-[#18212b] p-5 text-white sm:p-6"><div><p class="text-sm text-[#aeb8c4]">{converting() ? "Converting image" : "Output settings"}</p><p class="mt-1 font-mono text-2xl tracking-[-0.04em]">{formatNames[format()]}</p></div><button type="button" class="min-h-12 rounded-lg bg-[#2d7ff0] px-6 font-semibold text-white hover:bg-[#438cf2] disabled:cursor-not-allowed disabled:opacity-45" disabled={!valid() || converting()} onClick={convert}>{converting() ? "Converting…" : "Convert image"}</button></div></Show>
      <Show when={!valid()}><p class="mt-3 text-sm text-[#b42318]">Enter dimensions from 1 to {maxWidth()} × {maxHeight()} pixels.</p></Show>
      <Show when={error()}>{(message) => <p class="mt-4 rounded-lg border border-[#f0c8c4] bg-[#fff7f6] p-4 text-sm leading-6 text-[#8a271f]" role="alert">{message()}</p>}</Show>
    </section>
  );
}

function Metric(props: { label: string; value: string }) {
  return <div><dt class="text-sm text-[#65717f]">{props.label}</dt><dd class="mt-1 font-mono text-xl tracking-[-0.035em]">{props.value}</dd></div>;
}

function NumberInput(props: { label: string; value: number; min?: number; max?: number; onInput: (value: string) => void }) {
  return <label class="block"><span class="text-sm text-[#65717f]">{props.label}</span><input class="mt-2 min-h-11 w-full rounded-lg border border-[#cbd4de] bg-[#fbfcfd] px-3 font-mono text-base" type="number" aria-label={props.label} value={props.value} min={props.min ?? 1} max={props.max ?? 8192} onInput={(event) => props.onInput(event.currentTarget.value)} /></label>;
}

function ChainIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.07.07l2-2a5 5 0 0 0-7.07-7.07l-1.15 1.15" /><path d="M14 11a5 5 0 0 0-7.07-.07l-2 2A5 5 0 0 0 12 20l1.15-1.15" /></svg>;
}

function fitAvifDimensions(width: number, height: number) {
  const scale = Math.min(1, 4096 / width, 2304 / height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
