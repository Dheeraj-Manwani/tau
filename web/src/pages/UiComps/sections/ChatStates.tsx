import { useState } from "react";

import { ChatLoader } from "@/src/components/motion/ChatLoader";
import { ChatEmpty, ChatHistorySkeleton } from "@/src/features/project/ChatPanel";
import { chatLoaderView } from "@/src/features/project/chatLoaderState";

import { Frame, Section, Spec } from "../frame";
import { CHAT_LOADER_INPUTS } from "../fixtures";

/** Every chat loader state, each derived through chatLoaderView() from a run input. */
export function ChatStates() {
  const [resuming, setResuming] = useState(false);
  return (
    <Section
      id="chat"
      eyebrow="screens · project › chat"
      title="Chat"
      description="Loader tiles go through chatLoaderView(), the same function ChatPanel uses, so a new loader state needs only a new input in fixtures.ts."
    >
      {CHAT_LOADER_INPUTS.map(({ label, input }) => {
        const view = chatLoaderView(input);
        return (
          <Spec key={label} label={`Loader · ${label}`} note={view ? `view: ${view.kind}` : "view: null (nothing shown)"}>
            {view ? <ChatLoader view={view} runStartedAt={input.runStartedAt} /> : <p className="text-xs text-silver-500">Hidden</p>}
          </Spec>
        );
      })}
      <Spec label="Loader · stopped, with resume" note="onResume given (credit pause / stopped run)">
        <ChatLoader
          view={{ kind: "stopped" }}
          runStartedAt={null}
          resuming={resuming}
          onResume={() => {
            setResuming(true);
            setTimeout(() => setResuming(false), 1500);
          }}
        />
      </Spec>
      <Spec label="History loading" note="!hydrated && no messages">
        <Frame height={200} className="p-5">
          <ChatHistorySkeleton />
        </Frame>
      </Spec>
      <Spec label="No messages" note="hydrated, chat cleared">
        <Frame height={200}>
          <ChatEmpty />
        </Frame>
      </Spec>
    </Section>
  );
}
