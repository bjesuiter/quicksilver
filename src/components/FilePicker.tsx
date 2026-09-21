type FilePickerProps = {
  busy: boolean;
  onSelect: (file: File) => void;
};

export function FilePicker(props: FilePickerProps) {
  const selectFile = (event: Event & { currentTarget: HTMLInputElement }) => {
    const file = event.currentTarget.files?.[0];
    if (file) props.onSelect(file);
  };

  return (
    <section class="w-full" aria-labelledby="page-title">
      <div class="max-w-2xl">
        <h1 id="page-title" class="text-[clamp(2.35rem,7vw,4.75rem)] leading-[0.96] font-semibold tracking-[-0.055em] text-balance">
          Convert media on your device
        </h1>
        <p class="mt-6 max-w-xl text-base leading-7 text-[#65717f] sm:text-lg">
          Convert supported video, audio, or images locally. Your files never leave this device.
        </p>
      </div>

      <label class="group relative mt-10 flex min-h-44 cursor-pointer flex-col justify-between rounded-xl border border-[#cbd4de] bg-white p-6 transition-colors hover:border-[#1769e0] focus-within:ring-3 focus-within:ring-[#1769e0]/20 sm:min-h-48 sm:p-8">
        <input
          class="absolute inset-0 cursor-pointer opacity-0"
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm,video/x-matroska,video/mp2t,audio/mpeg,audio/wav,audio/x-wav,audio/aac,audio/ogg,audio/flac,.jpg,.jpeg,.png,.webp,.mp4,.m4v,.mov,.webm,.mkv,.ts,.mp3,.wav,.aac,.ogg,.oga,.flac"
          aria-label="Choose media"
          disabled={props.busy}
          onChange={selectFile}
        />
        <div class="flex items-start justify-between gap-6">
          <span class="text-xl font-medium tracking-[-0.025em] sm:text-2xl">{props.busy ? "Inspecting file…" : "Choose a file"}</span>
          <span class="grid size-10 shrink-0 place-items-center rounded-full border border-[#d9e0e8] text-xl text-[#1769e0] transition-transform group-hover:translate-x-0.5" aria-hidden="true">
            {props.busy ? "·" : "+"}
          </span>
        </div>
        <div class="mt-8 flex flex-wrap items-end justify-between gap-3 text-sm text-[#65717f]">
          <span>Your media stays on this device.</span>
          <span class="font-mono text-xs tracking-[0.08em] uppercase">Video, audio, or image</span>
        </div>
      </label>

      <p class="mt-4 text-sm leading-6 text-[#7a8592]">Images: JPEG, PNG, WebP. Media: MP4, MOV, WebM, MKV, MP3, WAV, AAC, Ogg, FLAC, and MPEG-TS. Compatibility is checked before conversion.</p>
    </section>
  );
}
