"use client";

import "katex/dist/katex.min.css";
import katex from "katex";
import { useMemo } from "react";

interface MathDisplayProps {
  latex: string;
  block?: boolean;
}

export function MathDisplay({ latex, block = false }: MathDisplayProps) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex, {
        displayMode: block,
        throwOnError: false,
        output: "html",
      });
    } catch {
      return latex;
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
