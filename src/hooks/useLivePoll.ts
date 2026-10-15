// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: Reads a live endpoint, again every interval while the page is visible
// and whenever the passenger asks. A failed read keeps the last answer on screen.

import { useCallback, useEffect, useRef, useState } from "react";

export interface LivePoll<T> {
  data?: T;
  /** No answer has ever arrived. */
  failed: boolean;
  /** A read is in flight. */
  loading: boolean;
  /** The wall clock at the last successful read, for countdowns against it. */
  clock: Date;
  refresh: () => void;
}

export function useLivePoll<T>(
  url: string,
  intervalMs: number,
  accept: (body: unknown) => body is T,
  now: () => Date = () => new Date(),
): LivePoll<T> {
  const [data, setData] = useState<T>();
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState(now);
  const nowRef = useRef(now);
  nowRef.current = now;
  const acceptRef = useRef(accept);
  acceptRef.current = accept;
  const active = useRef(true);
  const inFlight = useRef(false);

  const refresh = useCallback(() => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    fetch(url)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((body: unknown) => {
        if (!active.current) return;
        if (!acceptRef.current(body)) throw new Error("Unexpected live answer");
        setData(body);
        setFailed(false);
        setClock(nowRef.current());
      })
      .catch(() => { if (active.current) setFailed(true); })
      .finally(() => {
        inFlight.current = false;
        if (active.current) setLoading(false);
      });
  }, [url]);

  useEffect(() => {
    active.current = true;
    setData(undefined);
    setFailed(false);
    refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, intervalMs);
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active.current = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, intervalMs]);

  return { data, failed: failed && data === undefined, loading, clock, refresh };
}
