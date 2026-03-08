interface MathDisplayProps {
  latex: string;
  block?: boolean;
}

export function MathDisplay({ latex }: MathDisplayProps) {
  return <span>{latex}</span>;
}
