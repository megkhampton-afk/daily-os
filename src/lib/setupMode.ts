import { useSyncExternalStore } from "react";

// Setup mode shows configuration tools (Setup tab, syllabus catcher, hints).
// Every app launch starts with the clean everyday dashboard.
let setupMode = false;
const EVENT = "daily-os-setup-mode-change";

export function isSetupMode() {
  return setupMode;
}

export function setSetupMode(on: boolean) {
  setupMode = on;
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useSetupMode() {
  return useSyncExternalStore(subscribe, isSetupMode);
}
