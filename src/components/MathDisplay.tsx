
import "katex/dist/katex.min.css";
import katex from "katex";
import { useMemo } from "react";

interface MathDisplayProps {
  latex: string;
  block?: boolean;
}

/** Strip optional $...$ delimiters; KaTeX expects raw LaTeX and errors on $ in math mode. */
function stripDollarDelimiters(s: string): string {
  const t = s.trim();
  if (t.startsWith("$") && t.endsWith("$") && t.length > 1) {
    return t.slice(1, -1).trim();
  }
  return t;
}

export function MathDisplay({ latex, block = false }: MathDisplayProps) {
  const html = useMemo(() => {
    const normalized = stripDollarDelimiters(latex);
    try {
      return katex.renderToString(normalized, {
        displayMode: block,
        throwOnError: false,
        output: "html",
      });
    } catch {
      return normalized;
    }
  }, [latex, block]);

  const Tag = block ? "div" : "span";

  return (
    <Tag
      className={`text-foreground [&_.katex]:text-base [&_.katex-display]:text-lg ${block ? "my-2" : "inline"}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
