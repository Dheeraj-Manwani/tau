import { useEffect, useRef } from "react";

const FADE_MS = 600;

/**
 * Loops `url` while `enabled`, fading in to `volume` and out to silence.
 * Stops when the component unmounts (leaving Home). Does nothing when `url`
 * is empty. Home uses it twice: the music and the rain bed.
 *
 * Streams through an `<audio>` element on purpose: the rain file is long
 * (about 17 minutes), far too big to decode into memory, and an element needs
 * no CORS from the bucket.
 *
 * Browsers refuse to play sound before the page has had a click or key press.
 * A switch left on from a previous visit therefore waits for the first
 * interaction and starts then, instead of failing silently.
 */
export function useLoopingAudio(url: string, enabled: boolean, volume: number): void {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // One fade at a time: switching off and straight back on must cancel the
  // fade-out, or its end would pause the track that was just turned on.
  const fadeRef = useRef(0);

  useEffect(() => {
    if (!enabled || !url) return;

    const audio = (audioRef.current ??= Object.assign(new Audio(url), {
      loop: true,
      preload: "auto",
    }));
    const rampTo = (target: number, done?: () => void) => {
      window.clearInterval(fadeRef.current);
      const step = (target - audio.volume) / (FADE_MS / 30);
      fadeRef.current = window.setInterval(() => {
        const next = audio.volume + step;
        if ((step >= 0 && next >= target) || (step < 0 && next <= target)) {
          audio.volume = target;
          window.clearInterval(fadeRef.current);
          done?.();
        } else {
          audio.volume = next;
        }
      }, 30);
    };

    const start = () => {
      if (audio.paused) audio.volume = 0;
      audio.play().then(
        () => {
          removeRetry();
          rampTo(volume);
        },
        () => {}, // Blocked until the first interaction; the listeners retry.
      );
    };
    const removeRetry = () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
    };
    window.addEventListener("pointerdown", start);
    window.addEventListener("keydown", start);
    start();

    return () => {
      removeRetry();
      rampTo(0, () => audio.pause());
    };
  }, [url, enabled, volume]);

  // Leaving Home: no fade, the page is going.
  useEffect(
    () => () => {
      window.clearInterval(fadeRef.current);
      audioRef.current?.pause();
      audioRef.current = null;
    },
    [],
  );
}
