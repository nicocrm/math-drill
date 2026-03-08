interface PromptDisplayProps {
  text: string;
}

export function PromptDisplay({ text }: PromptDisplayProps) {
  return <span>{text}</span>;
}
