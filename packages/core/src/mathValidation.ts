import { math } from "./extraction/mathInstance";

export function checkFraction(
  studentInput: string,
  correctAnswer: string
): boolean {
  try {
    const normalized = (s: string) =>
      s.trim().replace(/\u2212/g, "-"); // Unicode minus to ASCII minus
    const a = math.fraction(normalized(studentInput));
    const b = math.fraction(normalized(correctAnswer));
    return Boolean(math.equal(a, b));
  } catch {
    return false;
  }
}

export function checkExpression(
  studentInput: string,
  correctAnswer: string
): boolean {
  try {
    const a = math.parse(studentInput.trim()).evaluate();
    const b = math.parse(correctAnswer.trim()).evaluate();
    if (typeof a !== "number" || typeof b !== "number") return false;
    return Math.abs(a - b) < 1e-10;
  } catch {
    return false;
  }
}

export function checkMultipleChoice(
  studentAnswer: string[],
  correctAnswer: string[]
): boolean {
  if (studentAnswer.length !== correctAnswer.length) return false;
  const sortedA = [...studentAnswer].sort();
  const sortedB = [...correctAnswer].sort();
  return sortedA.every((v, i) => v === sortedB[i]);
}

export function checkTrueFalse(
  studentAnswer: string,
  correctAnswer: string
): boolean {
  const s = studentAnswer.trim().toLowerCase();
  const c = correctAnswer.trim().toLowerCase();
  return (s === "true" || s === "false") && s === c;
}
