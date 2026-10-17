import { useSyncExternalStore } from "react";

// Setup mode shows configuration tools (Setup tab, syllabus catcher, hints).
// Off gives the clean everyday dashboard. Stored per browser; on by default
// so a brand-new copy opens with its setup tools visible.
const STORAGE = "daily-os-setup-mode";
const EVENT = "daily-os-setup-mode-change";

export function isSetupMode() {
  return localStorage.getItem(STORAGE) !== "off";
}

export function setSetupMode(on: boolean) {
  localStorage.setItem(STORAGE, on ? "on" : "off");
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
