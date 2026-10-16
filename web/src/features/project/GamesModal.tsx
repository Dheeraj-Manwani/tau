import { useState } from "react";
import { ArrowLeftIcon, XIcon } from "lucide-react";

import { cn } from "@/src/lib/utils";
import { Button } from "@/src/components/ui/button";
import { DataSpinner } from "@/src/components/ui/data-spinner";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/src/components/ui/dialog";
import {
  GAMES,
  gameEmbedUrl,
  gameThumbnailUrl,
  type Game,
} from "@/src/features/project/games";
import type { GamesStatus } from "@/src/features/project/gamesStatus";

const STATUS_DOT: Record<GamesStatus["tone"], string> = {
  working: "animate-pulse bg-blue-500 motion-reduce:animate-none",
  done: "bg-green-400",
  attention: "bg-orange-400",
  idle: "bg-silver-500",
};

/**
 * Something to play while tau builds. The games are other people's pages in a
 * frame, so the bar along the bottom is the only part that knows about the
 * build: it keeps saying what tau is doing and says so when it finishes.
 *
 * Rendered by `PreviewPane`, not the build loader that opens it: the loader
 * unmounts the moment the preview comes up, which is exactly when this needs
 * to still be on screen to say so.
 */
export function GamesModal({
  open,
  onOpenChange,
  status,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: GamesStatus;
}) {
  const [game, setGame] = useState<Game | null>(null);
  const [frameLoaded, setFrameLoaded] = useState(false);

  const pick = (next: Game | null) => {
    setGame(next);
    setFrameLoaded(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) pick(null);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        // A stray click on the backdrop shouldn't throw away a game in progress.
        onInteractOutside={(event) => {
          if (game) event.preventDefault();
        }}
        className="flex h-[min(46rem,calc(100dvh-2rem))] flex-col gap-0 overflow-hidden p-0 max-sm:px-0 sm:max-w-4xl"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-3">
          {game && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => pick(null)}
              aria-label="All games"
            >
              <ArrowLeftIcon />
              Games
            </Button>
          )}
          <DialogTitle className={cn("min-w-0 flex-1 truncate", !game && "pl-1")}>
            {game ? game.title : "Play while tau builds"}
          </DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" size="icon">
              <XIcon />
              <span className="sr-only">Close</span>
            </Button>
          </DialogClose>
        </div>

        {game ? (
          <div className="relative min-h-0 flex-1 bg-space-void">
            <DialogDescription className="sr-only">
              {game.blurb}
            </DialogDescription>
            {!frameLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <DataSpinner label={`Loading ${game.title}`} />
              </div>
            )}
            <iframe
              key={game.id}
              src={gameEmbedUrl(game, window.location.origin)}
              title={game.title}
              onLoad={() => setFrameLoaded(true)}
              className="relative size-full border-0"
              allow="autoplay; fullscreen; gamepad"
              // No top-navigation: a game or its ads may open a new tab, but
              // can never navigate the app away from the build.
              sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-pointer-lock"
            />
          </div>
        ) : (
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-5">
            <DialogDescription>
              Pick a game. The bar below keeps you posted on the build.
            </DialogDescription>
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {GAMES.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => pick(entry)}
                    className="group flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-lg border border-line bg-space-surface text-left transition-colors duration-150 hover:border-line-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                  >
                    <img
                      src={gameThumbnailUrl(entry)}
                      alt=""
                      loading="lazy"
                      className="aspect-[4/3] w-full bg-space-raised object-cover"
                    />
                    <span className="relative flex flex-col gap-0.5 border-t border-line px-3 py-2.5">
                      <span className="text-[13.5px] font-medium text-silver-900">
                        {entry.title}
                      </span>
                      <span className="text-xs leading-snug text-silver-500">
                        {entry.blurb}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-silver-500">
              Games are provided by GameDistribution and may show ads.
            </p>
          </div>
        )}

        <div
          role="status"
          aria-live="polite"
          className={cn(
            "flex min-h-14 shrink-0 items-center gap-2.5 border-t border-line px-4 py-2.5 transition-colors duration-150 max-sm:pb-[max(0.625rem,env(safe-area-inset-bottom))]",
            status.tone === "done" && "bg-green-400/11",
            status.tone === "attention" && "bg-orange-400/11",
          )}
        >
          <span
            aria-hidden="true"
            className={cn("size-2 shrink-0 rounded-full", STATUS_DOT[status.tone])}
          />
          <p className="min-w-0 flex-1 truncate text-[13px] text-silver-900">
            {status.label}
          </p>
          {status.actionLabel && (
            <Button size="sm" onClick={() => handleOpenChange(false)}>
              {status.actionLabel}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default GamesModal;
