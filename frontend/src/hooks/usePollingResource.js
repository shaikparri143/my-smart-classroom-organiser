import { useCallback, useEffect, useRef, useState } from "react";

export default function usePollingResource(load, intervalMs = 12000) {
  const loadRef = useRef(load);
  const controllersRef = useRef(new Set());
  const inFlightRef = useRef(false);
  const requestIdRef = useRef(0);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  const refresh = useCallback(async (force = false) => {
    if (inFlightRef.current && !force) {
      return;
    }

    if (force) {
      for (const controller of controllersRef.current) {
        controller.abort();
      }
      controllersRef.current.clear();
    }

    inFlightRef.current = true;
    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    controllersRef.current.add(controller);
    setRefreshing(true);
    let timeoutId;

    try {
      const timeout = new Promise((_, reject) => {
        timeoutId = window.setTimeout(() => {
          controller.abort();
          reject(new Error("Loading course information timed out. Please try again."));
        }, 15000);
      });
      const result = await Promise.race([
        loadRef.current(controller.signal),
        timeout,
      ]);

      if (!Array.isArray(result)) {
        throw new Error("The server returned an invalid course list.");
      }

      if (requestId === requestIdRef.current) {
        setData(result);
        setError("");
        setLastUpdated(new Date());
      }
    } catch (requestError) {
      if (
        requestId === requestIdRef.current &&
        requestError.name !== "AbortError"
      ) {
        setError(requestError.message || "Unable to load course information.");
      }
    } finally {
      window.clearTimeout(timeoutId);
      controllersRef.current.delete(controller);
      if (requestId === requestIdRef.current) {
        inFlightRef.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const controllers = controllersRef.current;
    refresh();
    const interval = window.setInterval(() => refresh(), intervalMs);

    return () => {
      window.clearInterval(interval);
      requestIdRef.current += 1;
      inFlightRef.current = false;
      for (const controller of controllers) {
        controller.abort();
      }
      controllers.clear();
    };
  }, [intervalMs, refresh]);

  return { data, loading, refreshing, error, lastUpdated, refresh };
}
