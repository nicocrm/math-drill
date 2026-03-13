import { describe, it, expect } from "vitest";
import {
  checkFraction,
  checkExpression,
  checkMultipleChoice,
  checkTrueFalse,
} from "./mathValidation";

describe("checkFraction", () => {
  it("returns true for equal fractions", () => {
    expect(checkFraction("1/2", "1/2")).toBe(true);
  });

  it("normalizes Unicode minus to ASCII minus", () => {
    expect(checkFraction("\u22121/2", "-1/2")).toBe(true);
  });
});

describe("checkExpression", () => {
  it("returns true for equal numeric expressions", () => {
    expect(checkExpression("2 + 3", "5")).toBe(true);
  });

  it("uses tolerance for floating point comparison", () => {
    expect(checkExpression("0.1 + 0.2", "0.3")).toBe(true);
  });
});

describe("checkMultipleChoice", () => {
  it("returns true for order-independent match", () => {
    expect(checkMultipleChoice(["a", "b"], ["b", "a"])).toBe(true);
  });

  it("returns false when lengths differ", () => {
    expect(checkMultipleChoice(["a"], ["a", "b"])).toBe(false);
  });
});

describe("checkTrueFalse", () => {
  it("returns true for matching true/false", () => {
    expect(checkTrueFalse("true", "true")).toBe(true);
    expect(checkTrueFalse("false", "false")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(checkTrueFalse("TRUE", "true")).toBe(true);
  });
});
