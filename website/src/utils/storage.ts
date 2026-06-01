export function getStoredNumberSet(key: string) {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return new Set<number>();
  }
  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) {
      return new Set<number>();
    }
    return new Set(
      value
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item > 0),
    );
  } catch {
    localStorage.removeItem(key);
    return new Set<number>();
  }
}

export function persistNumberSet(key: string, value: Set<number>) {
  localStorage.setItem(key, JSON.stringify([...value]));
}

export function getStoredStringSet(key: string) {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return new Set<string>();
  }
  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) {
      return new Set<string>();
    }
    return new Set(
      value
        .map((item) => String(item || "").trim())
        .filter(Boolean),
    );
  } catch {
    localStorage.removeItem(key);
    return new Set<string>();
  }
}

export function persistStringSet(key: string, value: Set<string>) {
  localStorage.setItem(key, JSON.stringify([...value]));
}
