"use client";

import { useCallback, useEffect, useState } from "react";

/** Seconds-remaining countdown, e.g. for "Resend code in 25s". */
export function useCountdown(initialSeconds = 0) {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = window.setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [seconds]);

  const start = useCallback((value: number) => setSeconds(Math.max(0, Math.ceil(value))), []);
  return { seconds, active: seconds > 0, start };
}
