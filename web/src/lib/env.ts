/**
 * Validated, typed access to the Vite env. Keep all `import.meta.env` reads here
 * so a missing/misconfigured variable fails loudly in one place.
 */
const API_URL = (
  import.meta.env.VITE_API_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

// Live job streaming now rides the api origin over SSE (GET /jobs/:id/stream),
// so there is no separate ws-gateway URL anymore.

// The standalone ops console (admin/). Only admins ever see a link to it, and
// the console does its own sign-in, so this is just where the link points.
const ADMIN_URL = (
  import.meta.env.VITE_ADMIN_URL ?? "https://admin.tauai.pro"
).replace(/\/$/, "");

// Home's soundtrack. The storm's clips sit beside it in the same bucket folder
// (`tau/`), so one variable locates them all.
const AUDIO_URL = import.meta.env.VITE_AUDIO_URL ?? "";
const besideAudio = (name: string) => (AUDIO_URL ? new URL(name, AUDIO_URL).toString() : "");

export const env = {
  API_URL,
  ADMIN_URL,
  /** Web route the API redirects to after Google OAuth (see OAUTH_SUCCESS_REDIRECT). */
  OAUTH_CALLBACK_PATH: "/auth/callback",
  /** Razorpay publishable key  */
  RAZORPAY_KEY_ID: import.meta.env.VITE_RAZORPAY_KEY_ID ?? "",
  /** Home's soundtrack. Empty when unset: Home then offers no sound switch. */
  AUDIO_URL,
  /** The storm's rain bed, looped while Rain and Sound are on. */
  RAIN_AUDIO_URL: besideAudio("gentle-rain.mp3"),
  /** One of these plays shortly after each lightning strike. */
  THUNDER_AUDIO_URLS: AUDIO_URL
    ? ["thunder-1.mp3", "thunder-2.mp3", "thunder-3.mp3"].map(besideAudio)
    : [],
} as const;
