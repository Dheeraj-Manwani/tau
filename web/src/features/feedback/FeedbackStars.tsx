import { Rating } from "@/src/components/ui/rating";

export function FeedbackStars({ value, onChange, disabled }: {
  value: number;
  onChange: (rating: number) => void;
  disabled: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="border-0 p-0 disabled:opacity-40">
      <legend className="sr-only">Your rating (required)</legend>
      <Rating value={value} onChange={onChange} label="Your rating" className="gap-1" />
    </fieldset>
  );
}
