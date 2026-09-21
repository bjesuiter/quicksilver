import type { OutputTarget, SourceFile } from "../domain/media";
import { formatBytes, formatDuration, formatFrameRate } from "../domain/format";
import { outputTargetsFor } from "../domain/outputTarget";

type OutputTargetPickerProps = {
  source: SourceFile;
  onSelect: (target: OutputTarget) => void;
  onReset: () => void;
};

export function OutputTargetPicker(props: OutputTargetPickerProps) {
  const targets = () => outputTargetsFor(props.source);

  return (
    <section class="mx-auto w-full max-w-3xl" aria-labelledby="target-format-title">
      <div>
        <div>
          <p class="font-mono text-xs font-medium tracking-[0.12em] text-[#1769e0] uppercase">Step 2 of 3</p>
          <h1 id="target-format-title" class="mt-3 text-3xl font-semibold tracking-[-0.045em] sm:text-5xl">Choose an output format</h1>
          <p class="mt-4 max-w-2xl text-base leading-7 text-[#65717f] sm:text-lg">
            {props.source.mediaType === "video"
              ? "Keep video, switch codecs, or extract the audio."
              : props.source.mediaType === "audio"
                ? "Choose the format for your audio export."
                : "Choose the file type for your image export."}
          </p>
        </div>
      </div>

      <SourceFileCard source={props.source} onChooseAnother={props.onReset} />

      <div class="mt-8 grid gap-3" role="list" aria-label="Output formats">
        {targets().map((target) => {
          const unavailable = target.mediaType === "audio" && props.source.mediaType === "video" && !props.source.hasAudio;
          return (
            <button
              type="button"
              class={`group flex min-h-24 w-full items-center justify-between gap-5 rounded-xl border border-[#d9e0e8] bg-white p-5 text-left transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#1769e0] sm:p-6 ${unavailable ? "cursor-not-allowed opacity-55" : "hover:border-[#1769e0]"}`}
              disabled={unavailable}
              onClick={() => props.onSelect(target.id)}
            >
              <span>
                <span class="flex flex-wrap items-center gap-2 text-lg font-semibold tracking-[-0.025em]">
                  {target.title}
                  {target.beta && <span class="rounded-full bg-[#fef0c7] px-2 py-0.5 font-mono text-[0.65rem] font-semibold tracking-[0.08em] text-[#7a4c00] uppercase">Beta</span>}
                </span>
                <span class="mt-1 block text-sm text-[#65717f]">{target.detail}</span>
                {unavailable && <span class="mt-2 block text-sm text-[#7a8592]">Audio of source is silent</span>}
              </span>
              <span class={`grid size-9 shrink-0 place-items-center rounded-full border border-[#d9e0e8] font-mono text-lg transition-transform ${unavailable ? "text-[#89939e]" : "text-[#1769e0] group-hover:translate-x-0.5"}`} aria-hidden="true">→</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SourceFileCard(props: { source: SourceFile; onChooseAnother: () => void }) {
  const format = () => props.source.mediaType === "image"
    ? props.source.file.type.replace("image/", "").toUpperCase()
    : props.source.codec.toUpperCase();
  const dimensions = () => props.source.mediaType !== "audio"
    ? `${props.source.width} × ${props.source.height}`
    : "Audio only";
  const metadata = () => {
    const source = props.source;
    if (source.mediaType === "image") return formatBytes(source.file.size);

    const details = [formatBytes(source.fileSize), formatDuration(source.duration)];
    if (source.mediaType === "video") details.push(`${formatFrameRate(source.frameRate)} fps`);
    if (source.mediaType === "audio") details.push(`${source.audioNumberOfChannels} ${source.audioNumberOfChannels === 1 ? "channel" : "channels"} · ${Math.round(source.audioSampleRate / 1_000)} kHz`);
    return details.join(" · ");
  };
  const fileName = () => props.source.mediaType === "image" ? props.source.file.name : props.source.fileName;

  return (
    <aside class="mt-8 overflow-hidden rounded-xl border border-[#cbd9ea] bg-white" aria-labelledby="source-file-title">
      <div class="p-5 sm:p-6">
        <p id="source-file-title" class="font-mono text-xs font-medium tracking-[0.12em] text-[#65717f] uppercase">Source file</p>
        <p class="mt-2 truncate text-lg font-semibold tracking-[-0.025em] text-[#18212b]" title={fileName()}>{fileName()}</p>
        <dl class="mt-5 grid gap-5 border-t border-[#e5eaf0] pt-5 sm:grid-cols-3 sm:gap-6">
          <SourceDetail label="Format" value={format()} />
          <SourceDetail label="Dimensions" value={dimensions()} />
          <SourceDetail label="Metadata" value={metadata()} />
        </dl>
      </div>
      <div class="border-t border-[#e5eaf0] bg-[#f8fafc] px-5 py-3 sm:px-6">
        <button type="button" class="text-sm font-medium text-[#1769e0] underline decoration-[#a9c9f7] underline-offset-4 hover:text-[#0f5dcf] focus-visible:rounded-sm focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#1769e0]" onClick={props.onChooseAnother}>
          Choose another source
        </button>
      </div>
    </aside>
  );
}

function SourceDetail(props: { label: string; value: string }) {
  return (
    <div>
      <dt class="text-sm text-[#65717f]">{props.label}</dt>
      <dd class="mt-1 font-mono text-sm font-medium leading-6 text-[#18212b]">{props.value}</dd>
    </div>
  );
}
