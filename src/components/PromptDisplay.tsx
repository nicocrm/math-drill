interface PromptDisplayProps {
  text: string;
}

export function PromptDisplay({ text }: PromptDisplayProps) {
  return (
    <span className="leading-relaxed text-foreground">{text}</span>
  );
}
