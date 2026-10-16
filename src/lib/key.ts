const STORAGE = "daily-os-key";

export function getKey() {
  return localStorage.getItem(STORAGE) ?? "";
}

export function setKey(key: string) {
  localStorage.setItem(STORAGE, key);
}

export function clearKey() {
  localStorage.removeItem(STORAGE);
}
