import { useCallback, useEffect, useRef } from "react";
import toast from "react-hot-toast";

import { thunderTake } from "@/src/lib/thunder";

/** Temporary, while the clips are being judged by ear: a toast per clap. */
const ANNOUNCE_THUNDER = true;

/** At most this many claps overlap; a strike beyond it stays silent. */
const MAX_CLAPS = 2;

/**
 * Thunder for the storm's lightning. Returns `onStrike`, which the storm
 * calls as each bolt flashes; it plays a varied clap from `urls` a moment
 * later while `enabled`. Stable across renders, so the storm never restarts.
 *
 * Plays through `<audio>` elements (no CORS needed from the bucket). The
 * clips are fetched once, when thunder is first enabled, so the first clap is
 * not late.
 */
export function useThunder(urls: string[], enabled: boolean): () => void {
  const enabledRef = useRef(enabled);
  const lastRef = useRef<number | null>(null);
  const playingRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  const clapsRef = useRef<HTMLAudioElement[]>([]);

  useEffect(() => {
    enabledRef.current = enabled;
    if (!enabled) return;
    // Warm the cache so a clap can start on time.
    for (const url of urls) Object.assign(new Audio(url), { preload: "auto" }).load();
  }, [enabled, urls]);

  // Leaving Home: cancel pending claps and silence the ones ringing.
  useEffect(
    () => () => {
      for (const t of timersRef.current) window.clearTimeout(t);
      for (const a of clapsRef.current) a.pause();
    },
    [],
  );

  return useCallback(() => {
    if (!enabledRef.current || urls.length === 0 || playingRef.current >= MAX_CLAPS) return;
    const take = thunderTake(urls.length, lastRef.current);
    lastRef.current = take.index;
    playingRef.current += 1;

    const timer = window.setTimeout(() => {
      timersRef.current = timersRef.current.filter((t) => t !== timer);
      if (!enabledRef.current) {
        playingRef.current -= 1;
        return;
      }
      const clap = Object.assign(new Audio(urls[take.index]), {
        volume: take.volume,
        playbackRate: take.rate,
        preservesPitch: false,
      });
      clapsRef.current.push(clap);
      const finish = () => {
        playingRef.current = Math.max(0, playingRef.current - 1);
        clapsRef.current = clapsRef.current.filter((a) => a !== clap);
      };
      clap.addEventListener("ended", finish, { once: true });
      clap.play().then(
        () => {
          if (ANNOUNCE_THUNDER) {
            const name = urls[take.index]!.split("/").pop();
            toast(`⚡ ${name} · speed ${take.rate.toFixed(2)} · volume ${take.volume.toFixed(2)} · ${take.delayMs}ms after the flash`);
          }
        },
        finish, // Blocked before the first click: skip this clap.
      );
    }, take.delayMs);
    timersRef.current.push(timer);
  }, [urls]);
}
