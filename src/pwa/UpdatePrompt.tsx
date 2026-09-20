import { Show } from "solid-js";
import { useRegisterSW } from "virtual:pwa-register/solid";

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker
  } = useRegisterSW();

  const dismiss = () => {
    setNeedRefresh(false);
    setOfflineReady(false);
  };

  return (
    <Show when={needRefresh() || offlineReady()}>
      <aside class="pointer-events-none fixed right-4 bottom-4 left-4 z-50 mx-auto flex max-w-xl items-center justify-between gap-4 rounded-xl border border-[#cbd4de] bg-white p-4 shadow-[0_18px_50px_rgba(24,33,43,0.14)]" aria-live="polite">
        <p class="text-sm leading-6 text-[#44505d]">
          {needRefresh() ? "A new Quicksilver version is ready." : "Quicksilver is ready to use offline."}
        </p>
        <div class="flex shrink-0 items-center gap-2">
          <Show when={needRefresh()}>
            <button type="button" class="pointer-events-auto min-h-10 rounded-lg bg-[#1769e0] px-3 text-sm font-semibold text-white" onClick={() => void updateServiceWorker(true)}>
              Update
            </button>
          </Show>
          <button type="button" class="pointer-events-auto min-h-10 px-2 text-sm font-medium text-[#65717f]" onClick={dismiss}>
            Dismiss
          </button>
        </div>
      </aside>
    </Show>
  );
}
