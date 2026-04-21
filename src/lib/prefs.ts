// Persistência simples de preferências de UI (não-sensíveis)
import { useEffect, useState } from "react";

export function usePref<T extends string>(key: string, fallback: T): [T, (v: T) => void] {
  const storageKey = `course-vault.${key}`;
  const [val, setVal] = useState<T>(fallback);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(storageKey);
    if (raw) setVal(raw as T);
  }, [storageKey]);

  const update = (v: T) => {
    setVal(v);
    try { window.localStorage.setItem(storageKey, v); } catch { /* ignore */ }
  };

  return [val, update];
}
