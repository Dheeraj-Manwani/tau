import { RainLayer } from "@/src/components/motion/RainLayer";

/** Full-screen brand splash shown while auth state is being resolved: the τ
 *  mark on void with the rain behind it (tier A). */
export function SplashScreen() {
  return (
    <div className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-space-void">
      <RainLayer fill />
      <span className="logo-mark relative size-16" role="img" aria-label="tau" />
    </div>
  );
}

export default SplashScreen;
