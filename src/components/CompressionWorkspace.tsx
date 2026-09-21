import { createMemo, createSignal, onCleanup, Show } from "solid-js";

import { formatBitrate, formatBytes, formatDuration, formatFrameRate } from "../domain/format";
import type { OutputSettings, OutputTarget, SourceMedia } from "../domain/media";
import { outputTarget } from "../domain/outputTarget";
import { defaultOutputSettings, estimateOutputBytes, isValidOutput, linkedHeight, linkedWidth } from "../domain/settings";
import { readExportHistory, rememberExport, type ExportRecord } from "../history/exportHistory";
import type { MediaSession } from "../media/probe";
import { createConversionJob, type ConversionJob } from "../media/transcode";

type CompressionWorkspaceProps = {
  session: MediaSession;
  target: OutputTarget;
  onChangeTarget: () => void;
  onReset: () => void;
};

export function CompressionWorkspace(props: CompressionWorkspaceProps) {
  const source = () => props.session.source;
  const [settings, setSettings] = createSignal({ ...defaultOutputSettings(source()), target: props.target });
  const [status, setStatus] = createSignal<"ready" | "converting" | "complete">("ready");
  const [progress, setProgress] = createSignal(0);
  const [bytesWritten, setBytesWritten] = createSignal(0);
  const [result, setResult] = createSignal<{ file: File; url: string }>();
  const [error, setError] = createSignal<string>();
  const [history, setHistory] = createSignal(readExportHistory(source().identity));
  const estimate = createMemo(() => estimateOutputBytes(source(), settings()));
  const target = createMemo(() => outputTarget(settings().target));
  const isAudioOutput = createMemo(() => target().mediaType === "audio");
  const valid = createMemo(() => isAudioOutput() || isValidOutput(settings()));

  let job: ConversionJob | undefined;
  let runId = 0;

  const cleanupResult = () => {
    const current = result();
    if (current) URL.revokeObjectURL(current.url);
    setResult(undefined);
  };

  onCleanup(() => {
    runId += 1;
    cleanupResult();
    if (status() === "converting") void job?.cancel();
  });

  const updateNumber = (key: keyof OutputSettings, value: string) => {
    const number = Number(value);
    setSettings((current) => ({ ...current, [key]: number }));
  };

  const updateWidth = (value: string) => {
    const width = Math.round(Number(value));
    setSettings((current) => ({ ...current, width, height: linkedHeight(source(), width) }));
  };

  const updateHeight = (value: string) => {
    const height = Math.round(Number(value));
    setSettings((current) => ({ ...current, height, width: linkedWidth(source(), height) }));
  };

  const startConversion = async () => {
    const currentRun = ++runId;
    setError(undefined);
    cleanupResult();
    setProgress(0);
    setBytesWritten(0);
    setStatus("converting");

    try {
      const nextJob = await createConversionJob(props.session, settings(), (next) => {
        setProgress(next.fraction);
        setBytesWritten(next.bytesWritten);
      });
      if (currentRun !== runId || status() !== "converting") {
        await nextJob.cancel();
        return;
      }
      job = nextJob;
      const file = await job.execute();
      if (currentRun !== runId) return;
      setHistory(rememberExport(source().identity, {
        settings: { ...settings() },
        outputSize: file.size
      }));
      setResult({ file, url: URL.createObjectURL(file) });
      setStatus("complete");
    } catch (cause) {
      if (currentRun === runId && status() === "converting") {
        setError(cause instanceof Error ? cause.message : "The media could not be converted.");
        setStatus("ready");
      }
    } finally {
      if (currentRun === runId) job = undefined;
    }
  };

  const cancelConversion = async () => {
    runId += 1;
    setStatus("ready");
    await job?.cancel();
    job = undefined;
  };

  const canShare = createMemo(() => {
    const current = result();
    return Boolean(current && navigator.canShare?.({ files: [current.file] }));
  });

  const shareResult = async () => {
    const current = result();
    if (!current || !canShare()) return;
    try {
      await navigator.share({ files: [current.file], title: current.file.name });
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError("The share sheet could not be opened. Use the download instead.");
    }
  };

  const resetWorkspace = () => {
    cleanupResult();
    props.onReset();
  };

  const convertAgain = () => {
    cleanupResult();
    setError(undefined);
    setStatus("ready");
  };

  const sizeDifference = createMemo(() => {
    const current = result();
    if (!current) return "";
    const difference = Math.round(Math.abs(1 - current.file.size / source().fileSize) * 100);
    return `${difference}% ${current.file.size <= source().fileSize ? "smaller" : "larger"} than the source`;
  });

  return (
    <section class="w-full" aria-labelledby="file-name">
      <div class="flex flex-wrap items-start justify-between gap-5">
        <div class="min-w-0">
          <p class="mb-2 font-mono text-xs font-medium tracking-[0.12em] text-[#1769e0] uppercase">Ready to convert</p>
          <h1 id="file-name" class="max-w-3xl truncate text-3xl font-semibold tracking-[-0.045em] sm:text-5xl" title={source().fileName}>
            {source().fileName}
          </h1>
          <p class="mt-3 text-sm text-[#65717f]">
            {formatBytes(source().fileSize)} · {formatDuration(source().duration)} · {source().codec.toUpperCase()}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="min-h-11 rounded-lg border border-[#cbd4de] bg-white px-4 text-sm font-medium hover:border-[#98a6b5] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#1769e0]" onClick={props.onChangeTarget}>
            Change output format
          </button>
          <button type="button" class="min-h-11 rounded-lg border border-[#cbd4de] bg-white px-4 text-sm font-medium hover:border-[#98a6b5] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#1769e0]" onClick={resetWorkspace}>
            Choose another source
          </button>
        </div>
      </div>

      {source().hasHighDynamicRange && (
        <div class="mt-8 rounded-lg border border-[#f0c8c4] bg-[#fff7f6] p-4 text-sm leading-6 text-[#8a271f]" role="alert">
          This video uses HDR. Quicksilver blocks HDR conversion because it cannot preserve the color safely yet.
        </div>
      )}

      {!source().canDecode && (
        <div class="mt-8 rounded-lg border border-[#f0c8c4] bg-[#fff7f6] p-4 text-sm leading-6 text-[#8a271f]" role="alert">
          This browser cannot decode this {source().codec.toUpperCase()} {source().mediaType} format. Try a browser with WebCodecs support for this media.
        </div>
      )}

      <Show when={status() !== "complete"} fallback={<CompletedResult result={result()!} sizeDifference={sizeDifference()} canShare={canShare()} onShare={shareResult} onConvertAgain={convertAgain} onReset={resetWorkspace} />}>
      <Show when={history().length > 0}>
        <ExportHistory fileName={source().fileName} records={history()} />
      </Show>
      <div class="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#cbd9ea] bg-[#f5f8fc] px-4 py-3 text-sm">
        <span class="text-[#52606e]">Output format</span>
        <span class="font-mono font-medium text-[#18212b]">{target().title} · {target().detail}</span>
      </div>
      <Show when={source().mediaType === "video" && !isAudioOutput()} fallback={<AudioSourceSummary source={source()} extracted={source().mediaType === "video"} />}>
      <div class="mt-10 grid overflow-hidden rounded-xl border border-[#d9e0e8] bg-white lg:grid-cols-[1fr_auto_1fr]">
        <div class="p-6 sm:p-8">
          <p class="font-mono text-xs font-medium tracking-[0.12em] text-[#65717f] uppercase">Source</p>
          <dl class="mt-7 grid gap-7">
            <Metric label="Resolution" value={`${source().width} × ${source().height}`} testId="source-resolution" />
            <Metric label="Frame rate" value={`${formatFrameRate(source().frameRate)} fps`} testId="source-frame-rate" />
            <Metric label="Video bitrate" value={formatBitrate(source().videoBitrate)} testId="source-bitrate" />
          </dl>
        </div>

        <div class="relative border-t border-[#d9e0e8] lg:border-t-0 lg:border-l">
          <span class="absolute top-1/2 left-1/2 grid size-9 -translate-1/2 place-items-center rounded-full border border-[#d9e0e8] bg-[#f5f7fa] font-mono text-sm text-[#1769e0]" aria-hidden="true">
            →
          </span>
        </div>

        <div class="p-6 sm:p-8">
          <p class="font-mono text-xs font-medium tracking-[0.12em] text-[#1769e0] uppercase">Output</p>
          <div class="mt-7 grid gap-5">
            <fieldset>
              <legend class="text-sm text-[#65717f]">Resolution</legend>
              <div class="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <NumberInput label="Output width" value={settings().width} min={2} max={8192} onInput={updateWidth} />
                <span class="font-mono text-sm text-[#89939e]">×</span>
                <NumberInput label="Output height" value={settings().height} min={2} max={8192} onInput={updateHeight} />
              </div>
            </fieldset>
            <NumberInput label="Output frame rate" visibleLabel="Frame rate" value={settings().frameRate} min={1} max={120} step="0.01" suffix="fps" onInput={(value) => updateNumber("frameRate", value)} />
            <NumberInput label="Target bitrate" visibleLabel="Target bitrate" value={settings().videoBitrate / 1_000_000} min={0.1} max={100} step="0.1" suffix="Mbps" onInput={(value) => updateNumber("videoBitrate", String(Number(value) * 1_000_000))} />
          </div>
        </div>
      </div>
      </Show>

      <div class="mt-6 flex flex-col gap-5 rounded-xl bg-[#18212b] p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p class="text-sm text-[#aeb8c4]">{status() === "converting" ? "Converting media" : "Estimated size"}</p>
          <Show when={status() === "converting"} fallback={<p class="mt-1 font-mono text-2xl tracking-[-0.04em]">~{formatBytes(estimate())}</p>}>
            <p class="mt-1 font-mono text-2xl tracking-[-0.04em]">{Math.round(progress() * 100)}%</p>
            <p class="mt-1 text-xs text-[#aeb8c4]">{formatBytes(bytesWritten())} written</p>
          </Show>
        </div>
        <Show
          when={status() === "converting"}
          fallback={
            <button
              type="button"
              class="min-h-12 rounded-lg bg-[#2d7ff0] px-6 font-semibold text-white hover:bg-[#438cf2] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-45"
              disabled={!valid() || source().hasHighDynamicRange || !source().canDecode}
              onClick={startConversion}
            >
              {isAudioOutput() ? "Convert audio" : `Convert ${target().title}`}
            </button>
          }
        >
          <button type="button" class="min-h-12 rounded-lg border border-[#66717e] px-6 font-semibold text-white hover:border-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white" onClick={cancelConversion}>
            Cancel
          </button>
        </Show>
      </div>
      {!valid() && <p class="mt-3 text-sm text-[#b42318]">Enter valid dimensions, a frame rate from 1 to 120, and a bitrate from 0.1 to 100 Mbps.</p>}
      </Show>
      <Show when={error()}>
        {(message) => <p class="mt-4 rounded-lg border border-[#f0c8c4] bg-[#fff7f6] p-4 text-sm leading-6 text-[#8a271f]" role="alert">{message()}</p>}
      </Show>
    </section>
  );
}

function CompletedResult(props: {
  result: { file: File; url: string };
  sizeDifference: string;
  canShare: boolean;
  onShare: () => void;
  onConvertAgain: () => void;
  onReset: () => void;
}) {
  return (
    <div class="mt-10 overflow-hidden rounded-xl border border-[#d9e0e8] bg-white">
      <div class="p-6 sm:p-10">
        <div class="grid size-11 place-items-center rounded-full bg-[#e8f5ee] text-xl text-[#18794e]" aria-hidden="true">✓</div>
        <p class="mt-8 font-mono text-xs font-medium tracking-[0.12em] text-[#18794e] uppercase">Conversion complete</p>
        <h2 class="mt-2 text-3xl font-semibold tracking-[-0.045em] sm:text-5xl">Media ready</h2>
        <p class="mt-4 text-[#65717f]">{formatBytes(props.result.file.size)} · {props.sizeDifference}</p>
        <div class="mt-8 flex flex-col gap-3 sm:flex-row">
          <Show when={props.canShare}>
            <button type="button" class="min-h-12 rounded-lg bg-[#1769e0] px-6 font-semibold text-white hover:bg-[#0f5dcf] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#1769e0]" onClick={props.onShare}>
              Save or share
            </button>
          </Show>
          <a class="flex min-h-12 items-center justify-center rounded-lg border border-[#cbd4de] px-6 font-semibold hover:border-[#98a6b5] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#1769e0]" href={props.result.url} download={props.result.file.name}>
            Download file
          </a>
          <button type="button" class="min-h-12 rounded-lg border border-[#cbd4de] px-6 font-semibold hover:border-[#98a6b5] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#1769e0]" onClick={props.onConvertAgain}>
            Convert again with different settings
          </button>
          <button type="button" class="min-h-12 px-4 text-sm font-medium text-[#65717f] hover:text-[#18212b]" onClick={props.onReset}>
            Convert another
          </button>
        </div>
      </div>
    </div>
  );
}

function AudioSourceSummary(props: { source: SourceMedia; extracted: boolean }) {
  return (
    <div class="mt-10 rounded-xl border border-[#d9e0e8] bg-white p-6 sm:p-8">
      <p class="font-mono text-xs font-medium tracking-[0.12em] text-[#65717f] uppercase">{props.extracted ? "Audio export" : "Source audio"}</p>
      <dl class="mt-7 grid gap-7 sm:grid-cols-3">
        <Metric label="Duration" value={formatDuration(props.source.duration)} testId="source-duration" />
        <Metric label="Audio codec" value={props.source.codec.toUpperCase()} testId="source-codec" />
        <Metric label="Audio bitrate" value={formatBitrate(props.source.audioBitrate)} testId="source-bitrate" />
      </dl>
      <p class="mt-7 text-sm leading-6 text-[#65717f]">{props.extracted ? "The video track is removed. Audio is converted to AAC in an M4A file at 192 kbps." : "Audio is converted to AAC in an M4A file at 192 kbps for broad compatibility."}</p>
    </div>
  );
}

function ExportHistory(props: { fileName: string; records: ExportRecord[] }) {
  return (
    <aside class="mt-8 rounded-xl border border-[#cbd9ea] bg-[#f5f8fc] p-5" aria-labelledby="export-history-title">
      <p id="export-history-title" class="text-sm font-semibold text-[#26384d]">Already exported for {props.fileName}</p>
      <ul class="mt-3 grid gap-2">
        {props.records.map((record) => (
          <li class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
            <span class="font-mono text-[#18212b]">
              {record.settings.target === "aac-m4a" ? "AAC audio · M4A" : `${record.settings.target === "vp9-webm" ? "VP9" : record.settings.target === "av1-webm" ? "AV1" : "H.264"} · ${record.settings.width} × ${record.settings.height} · ${formatFrameRate(record.settings.frameRate)} fps · ${formatMegabits(record.settings.videoBitrate)} Mbps`}
            </span>
            <span class="text-xs text-[#65717f]">{formatBytes(record.outputSize)}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function formatMegabits(bitsPerSecond: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(bitsPerSecond / 1_000_000);
}

function Metric(props: { label: string; value: string; testId: string }) {
  return (
    <div>
      <dt class="text-sm text-[#65717f]">{props.label}</dt>
      <dd class="mt-1 font-mono text-xl tracking-[-0.035em]" data-testid={props.testId}>
        {props.value}
      </dd>
    </div>
  );
}

function NumberInput(props: {
  label: string;
  visibleLabel?: string;
  value: number;
  min: number;
  max: number;
  step?: string;
  suffix?: string;
  onInput: (value: string) => void;
}) {
  return (
    <label class="block">
      {props.visibleLabel && <span class="text-sm text-[#65717f]">{props.visibleLabel}</span>}
      <span class={`${props.visibleLabel ? "mt-2" : "mt-0"} flex min-h-11 items-center rounded-lg border border-[#cbd4de] bg-[#fbfcfd] px-3 focus-within:border-[#1769e0] focus-within:ring-3 focus-within:ring-[#1769e0]/15`}>
        <input
          class="min-w-0 flex-1 bg-transparent font-mono text-base outline-none"
          type="number"
          aria-label={props.label}
          value={props.value}
          min={props.min}
          max={props.max}
          step={props.step ?? "1"}
          onInput={(event) => props.onInput(event.currentTarget.value)}
        />
        {props.suffix && <span class="ml-2 text-xs text-[#7a8592]">{props.suffix}</span>}
      </span>
    </label>
  );
}
