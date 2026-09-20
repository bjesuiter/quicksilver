import { createMemo, createSignal } from "solid-js";

import { formatBitrate, formatBytes, formatDuration, formatFrameRate } from "../domain/format";
import type { OutputSettings } from "../domain/media";
import { defaultOutputSettings, estimateOutputBytes, isValidOutput, linkedHeight, linkedWidth } from "../domain/settings";
import type { MediaSession } from "../media/probe";

type CompressionWorkspaceProps = {
  session: MediaSession;
  onReset: () => void;
};

export function CompressionWorkspace(props: CompressionWorkspaceProps) {
  const source = () => props.session.source;
  const [settings, setSettings] = createSignal(defaultOutputSettings(source()));
  const estimate = createMemo(() => estimateOutputBytes(source(), settings()));
  const valid = createMemo(() => isValidOutput(settings()));

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

  return (
    <section class="w-full" aria-labelledby="file-name">
      <div class="flex flex-wrap items-start justify-between gap-5">
        <div class="min-w-0">
          <p class="mb-2 font-mono text-xs font-medium tracking-[0.12em] text-[#1769e0] uppercase">Ready to compress</p>
          <h1 id="file-name" class="max-w-3xl truncate text-3xl font-semibold tracking-[-0.045em] sm:text-5xl" title={source().fileName}>
            {source().fileName}
          </h1>
          <p class="mt-3 text-sm text-[#65717f]">
            {formatBytes(source().fileSize)} · {formatDuration(source().duration)} · {source().codec.toUpperCase()}
          </p>
        </div>
        <button type="button" class="min-h-11 rounded-lg border border-[#cbd4de] bg-white px-4 text-sm font-medium hover:border-[#98a6b5] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#1769e0]" onClick={props.onReset}>
          Choose another
        </button>
      </div>

      {source().hasHighDynamicRange && (
        <div class="mt-8 rounded-lg border border-[#f0c8c4] bg-[#fff7f6] p-4 text-sm leading-6 text-[#8a271f]" role="alert">
          This recording uses HDR. Quicksilver 0.1 blocks HDR conversion because it cannot preserve the color safely yet.
        </div>
      )}

      {!source().canDecode && (
        <div class="mt-8 rounded-lg border border-[#f0c8c4] bg-[#fff7f6] p-4 text-sm leading-6 text-[#8a271f]" role="alert">
          This browser cannot decode the video's {source().codec.toUpperCase()} profile. Try Safari 17.4 or newer on the iPhone that recorded it.
        </div>
      )}

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

      <div class="mt-6 flex flex-col gap-5 rounded-xl bg-[#18212b] p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p class="text-sm text-[#aeb8c4]">Estimated size</p>
          <p class="mt-1 font-mono text-2xl tracking-[-0.04em]">~{formatBytes(estimate())}</p>
        </div>
        <button
          type="button"
          class="min-h-12 rounded-lg bg-[#2d7ff0] px-6 font-semibold text-white hover:bg-[#438cf2] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-45"
          disabled={!valid() || source().hasHighDynamicRange || !source().canDecode}
        >
          Compress video
        </button>
      </div>
      {!valid() && <p class="mt-3 text-sm text-[#b42318]">Enter valid dimensions, a frame rate from 1 to 120, and a bitrate from 0.1 to 100 Mbps.</p>}
    </section>
  );
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
