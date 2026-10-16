import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2Icon, UploadIcon } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { Field } from "@/src/components/ui/field";
import { FileDrop } from "@/src/components/ui/file-drop";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { Textarea } from "@/src/components/ui/textarea";
import { api } from "@/src/lib/api-client";
import { useRedeemCode } from "@/src/features/billing/api";
import { useAttachments } from "@/src/features/composer/attachments/useAttachments";
import { AttachmentRail } from "@/src/features/composer/attachments/AttachmentRail";
import { useFeedbackStore } from "./useFeedbackStore";
import { FeedbackStars } from "./FeedbackStars";

type Reward = {
  id: string;
  promoCode: string;
  credits: number;
  alreadyRedeemed: boolean;
};

function FeedbackForm() {
  const source = useFeedbackStore((s) => s.source);
  const projectId = useFeedbackStore((s) => s.projectId);
  const [rating, setRating] = useState(0);
  const [kind, setKind] = useState<"feedback" | "suggestion">("feedback");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const files = useRef<HTMLInputElement>(null);
  const attachments = useAttachments();
  const redeem = useRedeemCode();
  const submit = useMutation({
    mutationFn: () => {
      useFeedbackStore.setState({ submitting: true });
      return api
        .post<Reward>("/feedback", {
          rating,
          kind,
          message,
          source,
          projectId,
          attachmentIds: attachments.readyIds,
        })
        .then((r) => r.data);
    },
    onSuccess: () => attachments.clear(),
    onSettled: () => useFeedbackStore.setState({ submitting: false }),
  });
  const busy = submit.isPending || attachments.isBusy;

  if (submit.data) {
    const rewarded = submit.data.alreadyRedeemed || redeem.isSuccess;
    return (
      <div className="grid gap-4 py-4 text-center">
        <div className="flex flex-col items-center gap-4">
          <span className="grid size-11 place-items-center rounded-lg border border-green-400/32 bg-green-400/11">
            <CheckCircle2Icon className="size-5 text-green-400" />
          </span>
          <div className="space-y-2">
            <DialogTitle>Feedback received</DialogTitle>
            <DialogDescription>
              Thanks for helping us improve tau.
            </DialogDescription>
          </div>
        </div>
        {rewarded ? (
          <p role="status" className="mx-auto w-full max-w-sm text-[13.5px] leading-[1.65] text-silver-600">
            {redeem.isSuccess
              ? "100 credits have been added to your account."
              : "Your account has already redeemed the 100-credit feedback reward. We appreciate every suggestion."}
          </p>
        ) : (
          <>
            <p className="mx-auto w-full max-w-sm text-[13.5px] leading-[1.65] text-silver-600">
              You unlocked 100 extra credits. Redeem your code here or on the
              Credits page. One reward per account.
            </p>
            <div className="flex items-center justify-between gap-3 rounded-md border border-line bg-space-void py-2.5 pr-2.5 pl-4">
              <code className="border-0 bg-transparent p-0 font-mono text-base font-medium tracking-wider text-silver-900">
                {submit.data.promoCode}
              </code>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(submit.data!.promoCode)
                    .then(() => setCopied(true))
                    .catch(() => setCopied(false));
                }}
              >
                {copied ? "Copied" : "Copy code"}
              </Button>
            </div>
            <Button
              className="w-full"
              size="lg"
              loading={redeem.isPending}
              onClick={() => redeem.mutate(submit.data!.promoCode)}
            >
              {redeem.isPending ? "Redeeming…" : "Redeem 100 credits"}
            </Button>
            {redeem.error && (
              <Alert tone="danger" className="text-left">
                {redeem.error.message}
              </Alert>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2 pr-10">
        <DialogTitle>Help shape tau</DialogTitle>
        <DialogDescription className="text-[13px] text-silver-500">
          Share your experience or an idea for what’s next.
        </DialogDescription>
      </div>
      <form
        className="contents"
        onSubmit={(event) => {
          event.preventDefault();
          if (rating && !busy) submit.mutate();
        }}
      >
        <div className="flex flex-col gap-5">
          <Select
            value={kind}
            onValueChange={(value) => setKind(value as typeof kind)}
            disabled={submit.isPending}
          >
            <SelectTrigger
              aria-label="What would you like to share?"
              className="h-10"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="feedback">Feedback</SelectItem>
              <SelectItem value="suggestion">Idea for what’s next</SelectItem>
            </SelectContent>
          </Select>
          <FeedbackStars
            value={rating}
            onChange={setRating}
            disabled={submit.isPending}
          />
          <Field
            label={
              <>
                Message{" "}
                <span className="font-normal text-silver-500">(optional)</span>
              </>
            }
            htmlFor="feedback-message"
            counter={`${message.length.toLocaleString()} / 5,000`}
          >
            <Textarea
              id="feedback-message"
              value={message}
              maxLength={5000}
              disabled={submit.isPending}
              onChange={(e) => setMessage(e.target.value)}
              onPaste={(e) => {
                const pasted = Array.from(e.clipboardData.files);
                if (pasted.length) {
                  e.preventDefault();
                  attachments.addFiles(pasted);
                }
              }}
              placeholder={
                kind === "suggestion"
                  ? "What would you like tau to do next?"
                  : "What worked well? What could we improve?"
              }
              rows={4}
            />
          </Field>
          <div>
            <input
              ref={files}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                attachments.addFiles(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
            <FileDrop
              icon={UploadIcon}
              disabled={submit.isPending}
              onClick={() => files.current?.click()}
              label={
                <>
                  Add screenshots or files{" "}
                  <span className="font-normal text-silver-500">(optional)</span>
                </>
              }
              caption="Up to 5 files. Images up to 5 MB; documents up to 10 MB. You can also paste a screenshot into the message."
            />
            <AttachmentRail
              attachments={attachments.attachments}
              onRemove={attachments.remove}
              className="mt-2"
            />
          </div>
          {submit.error && <Alert tone="danger">{submit.error.message}</Alert>}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost" disabled={submit.isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="submit"
            disabled={!rating || attachments.isBusy}
            loading={submit.isPending}
          >
            {submit.isPending
              ? "Sending…"
              : attachments.isBusy
                ? "Uploading files…"
                : kind === "suggestion"
                  ? "Send idea"
                  : "Send feedback"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

export function FeedbackModal() {
  const isOpen = useFeedbackStore((s) => s.isOpen);
  const close = useFeedbackStore((s) => s.close);
  const submitting = useFeedbackStore((s) => s.submitting);
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        showCloseButton={!submitting}
        className="sm:max-w-[480px]"
        onEscapeKeyDown={(e) => {
          if (submitting) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (submitting) e.preventDefault();
        }}
      >
        {isOpen && <FeedbackForm />}
      </DialogContent>
    </Dialog>
  );
}
