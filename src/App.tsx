import { createSignal, onCleanup, Show } from "solid-js";

import { commit, commitUrl, version } from "./buildInfo";
import { CompressionWorkspace } from "./components/CompressionWorkspace";
import { FilePicker } from "./components/FilePicker";
import { probeMedia, type MediaSession } from "./media/probe";
import { UpdatePrompt } from "./pwa/UpdatePrompt";

export function App() {
  const [session, setSession] = createSignal<MediaSession>();
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string>();

  let activeSession: MediaSession | undefined;

  const reset = () => {
    activeSession?.dispose();
    activeSession = undefined;
    setSession(undefined);
    setError(undefined);
  };

  const selectFile = async (file: File) => {
    reset();
    setBusy(true);
    try {
      const next = await probeMedia(file);
      activeSession = next;
      setSession(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The media could not be inspected.");
    } finally {
      setBusy(false);
    }
  };

  onCleanup(reset);
  const shortCommit = commit.slice(0, 7);

  return (
    <div class="flex min-h-dvh flex-col bg-[#f5f7fa] text-[#18212b]">
      <header class="border-b border-[#d9e0e8]">
        <div class="mx-auto flex h-16 max-w-5xl items-center justify-between px-5 sm:px-8">
          <a class="flex items-center gap-2.5 font-semibold tracking-[-0.02em]" href={import.meta.env.BASE_URL}>
            <span class="grid size-7 place-items-center rounded-[7px] bg-[#1769e0] text-sm text-white" aria-hidden="true">
              Q
            </span>
            Quicksilver
          </a>
          <span class="flex items-center gap-2 text-sm text-[#65717f]">
            <span class="size-1.5 rounded-full bg-[#2f9e67]" aria-hidden="true" />
            Local only
          </span>
        </div>
      </header>

      <main class="mx-auto flex w-full flex-1 items-center px-5 py-12 sm:px-8 sm:py-20">
        <Show when={session()} fallback={<FilePicker busy={busy()} onSelect={selectFile} />} keyed>
          {(value) => <CompressionWorkspace session={value} onReset={reset} />}
        </Show>
        <Show when={error()}>
          {(message) => (
            <div class="fixed right-5 bottom-5 left-5 mx-auto max-w-xl rounded-lg border border-[#f0c8c4] bg-[#fff7f6] p-4 text-sm leading-6 text-[#8a271f] shadow-lg" role="alert">
              {message()}
            </div>
          )}
        </Show>
      </main>
      <footer class="mx-auto w-full max-w-5xl px-5 pb-10 sm:px-8 sm:pb-12">
        <hr class="border-0 border-t border-[#d9e0e8]" />
        <p class="mt-5 text-xs text-[#85909c]">
          v{version} ·{" "}
          <a class="underline decoration-[#c5ccd4] underline-offset-2 hover:text-[#65717f]" href={commitUrl}>
            {shortCommit}
          </a>
        </p>
      </footer>
      <UpdatePrompt />
    </div>
  );
}
