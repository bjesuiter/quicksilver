import { createSignal, onCleanup, Show } from "solid-js";

import { commit, commitUrl, version } from "./buildInfo";
import { CompressionWorkspace } from "./components/CompressionWorkspace";
import { FilePicker } from "./components/FilePicker";
import { ImageWorkspace } from "./components/ImageWorkspace";
import { OutputTargetPicker } from "./components/OutputTargetPicker";
import type { OutputTarget, SourceImage } from "./domain/media";
import { isImageTarget } from "./domain/outputTarget";
import { probeImage } from "./image/image";
import { probeMedia, type MediaSession } from "./media/probe";
import { UpdatePrompt } from "./pwa/UpdatePrompt";

export function App() {
  const [session, setSession] = createSignal<MediaSession>();
  const [image, setImage] = createSignal<SourceImage>();
  const [target, setTarget] = createSignal<OutputTarget>();
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string>();
  const [page, setPage] = createSignal<Page>(readPage());

  let activeSession: MediaSession | undefined;

  const reset = () => {
    activeSession?.dispose();
    activeSession = undefined;
    setSession(undefined);
    setImage(undefined);
    setTarget(undefined);
    setError(undefined);
  };

  const selectFile = async (file: File) => {
    reset();
    setBusy(true);
    try {
      if (file.type.toLowerCase().startsWith("image/")) {
        setImage(await probeImage(file));
      } else {
        const next = await probeMedia(file);
        activeSession = next;
        setSession(next);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The media could not be inspected.");
    } finally {
      setBusy(false);
    }
  };

  const syncPage = () => setPage(readPage());
  const warnBeforeUnload = (event: BeforeUnloadEvent) => {
    if (!session()) return;
    event.preventDefault();
    event.returnValue = "";
  };
  window.addEventListener("popstate", syncPage);
  window.addEventListener("beforeunload", warnBeforeUnload);
  onCleanup(() => {
    reset();
    window.removeEventListener("popstate", syncPage);
    window.removeEventListener("beforeunload", warnBeforeUnload);
  });
  const shortCommit = commit.slice(0, 7);

  const navigate = (nextPage: Page, event: MouseEvent) => {
    event.preventDefault();
    if (page() === nextPage) return;
    window.history.pushState({}, "", pageHref(nextPage));
    setPage(nextPage);
  };

  return (
    <div class="flex min-h-dvh flex-col bg-[#f5f7fa] text-[#18212b]">
      <header class="border-b border-[#d9e0e8]">
        <div class="mx-auto flex min-h-16 max-w-5xl flex-wrap items-center justify-between gap-y-2 px-5 py-2 sm:h-16 sm:flex-nowrap sm:px-8 sm:py-0">
          <a class="flex items-center gap-2 font-semibold tracking-[-0.02em]" href={import.meta.env.BASE_URL}>
            <span class="grid size-7 place-items-center rounded-[7px] bg-[#1769e0] text-sm text-white" aria-hidden="true">
              Q
            </span>
            Quicksilver
            <span class="shrink-0 whitespace-nowrap text-xs font-normal tracking-normal text-[#65717f]">Local Media Converter</span>
          </a>
          <span class="hidden items-center gap-2 text-sm text-[#65717f] sm:flex">
            <span class="size-1.5 rounded-full bg-[#2f9e67]" aria-hidden="true" />
            Local only
          </span>
        </div>
      </header>

      <nav aria-label="Primary" class="border-b border-[#d9e0e8] bg-white">
        <div class="mx-auto w-full max-w-5xl px-5 py-3 sm:px-8 sm:py-4">
          <div class="grid w-full grid-cols-2 rounded-xl border border-[#d9e0e8] bg-[#f5f7fa] p-1.5 text-sm sm:text-base">
            <a
              class={navClass(page() === "direct")}
              href={pageHref("direct")}
              aria-current={page() === "direct" ? "page" : undefined}
              onClick={(event) => navigate("direct", event)}
            >
              Direct conversion
            </a>
            <a
              class={navClass(page() === "templates")}
              href={pageHref("templates")}
              aria-current={page() === "templates" ? "page" : undefined}
              onClick={(event) => navigate("templates", event)}
            >
              Templates
            </a>
          </div>
        </div>
      </nav>

      <main class="mx-auto flex w-full flex-1 px-5 py-12 sm:px-8 sm:py-20">
        <div class={page() === "direct" ? "flex w-full items-center" : "hidden"} aria-hidden={page() !== "direct" ? "true" : "false"}>
          <Show when={image()} fallback={<Show when={session()} fallback={<FilePicker busy={busy()} onSelect={selectFile} />} keyed>{(value) => (
            <Show when={target()} fallback={<OutputTargetPicker source={value.source} onSelect={setTarget} onReset={reset} />}>
              {(selectedTarget) => <CompressionWorkspace session={value} target={selectedTarget()} onReset={reset} />}
            </Show>
          )}</Show>} keyed>
            {(value) => (
              <Show when={target()} fallback={<OutputTargetPicker source={value} onSelect={setTarget} onReset={reset} />}>
                {(selectedTarget) => {
                  const selected = selectedTarget();
                  return isImageTarget(selected) && <ImageWorkspace source={value} target={selected} onReset={reset} />;
                }}
              </Show>
            )}
          </Show>
        </div>
        <Show when={page() === "templates"}>
          <TemplatesPage onNavigate={(event) => navigate("direct", event)} />
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

type Page = "direct" | "templates";

function readPage(): Page {
  return window.location.pathname.replace(/\/$/, "").endsWith("/templates") ? "templates" : "direct";
}

function pageHref(page: Page): string {
  return page === "templates" ? `${import.meta.env.BASE_URL}templates` : import.meta.env.BASE_URL;
}

function navClass(active: boolean): string {
  return `rounded-lg px-3 py-2.5 text-center font-semibold transition-[background-color,color,transform] duration-200 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#1769e0] active:scale-[0.99] ${active ? "bg-[#1769e0] text-white shadow-[0_1px_2px_rgba(17,74,158,0.28)]" : "text-[#52606e] hover:bg-white hover:text-[#18212b]"}`;
}

function TemplatesPage(props: { onNavigate: (event: MouseEvent) => void }) {
  return (
    <section class="mx-auto flex w-full max-w-2xl flex-1 items-center" aria-labelledby="templates-title">
      <div class="w-full rounded-xl border border-dashed border-[#cbd4de] bg-white p-7 sm:p-12">
        <p class="font-mono text-xs font-medium tracking-[0.12em] text-[#1769e0] uppercase">Templates</p>
        <h1 id="templates-title" class="mt-3 text-3xl font-semibold tracking-[-0.045em] sm:text-5xl">Conversion recipes are on the way.</h1>
        <p class="mt-5 max-w-xl text-base leading-7 text-[#65717f] sm:text-lg">
          Save time with predefined workflows for the formats and sharing destinations you use most. For now, Direct Conversion gives you full control over every output setting.
        </p>
        <a class="mt-8 inline-flex min-h-11 items-center rounded-lg bg-[#1769e0] px-4 text-sm font-semibold text-white hover:bg-[#0f5dcf] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#1769e0]" href={pageHref("direct")} onClick={props.onNavigate}>
          Go to Direct Conversion
        </a>
      </div>
    </section>
  );
}
