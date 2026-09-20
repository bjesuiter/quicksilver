import type { OutputTarget, SourceFile } from "../domain/media";
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
      <div class="flex flex-wrap items-start justify-between gap-5">
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
        <button type="button" class="min-h-11 rounded-lg border border-[#cbd4de] bg-white px-4 text-sm font-medium hover:border-[#98a6b5] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#1769e0]" onClick={props.onReset}>
          Choose another source
        </button>
      </div>

      <div class="mt-10 grid gap-3" role="list" aria-label="Output formats">
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
                <span class="block text-lg font-semibold tracking-[-0.025em]">{target.title}</span>
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
