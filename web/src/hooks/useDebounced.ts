import { useEffect, useState } from "react";

/**
 * A value that only changes once it has stopped changing for `ms`. Use it to
 * keep typing from asking the server per keystroke. The first value is returned
 * straight away; only later changes wait.
 */
export function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}
