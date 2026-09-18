"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    __lisanhubExtensionGuardStop?: () => void;
  }
}

/** Mounted in the body: its effect runs once hydration is complete, which is when the guard can stop. */
export function ExtensionGuardStop() {
  useEffect(() => {
    window.__lisanhubExtensionGuardStop?.();
  }, []);
  return null;
}
