import { MathDisplay } from "@/components/MathDisplay";

interface PromptDisplayProps {
  text: string;
}

/**
 * Splits text on $...$ delimiters. Odd-indexed segments are math (render via MathDisplay),
 * even-indexed are plain text.
 */
export function PromptDisplay({ text }: PromptDisplayProps) {
  const parts = text.split(/\$([^$]+)\$/);
  return (
    <span className="leading-relaxed text-foreground">
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <MathDisplay key={i} latex={part} />
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}
