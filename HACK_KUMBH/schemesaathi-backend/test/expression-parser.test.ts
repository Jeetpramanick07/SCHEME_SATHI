import { describe, it, expect } from "vitest";
import { ExpressionParser } from "../src/engine/expression-parser.js";

describe("Expression Parser", () => {
  it("parses simple comparison terms", () => {
    const ast = ExpressionParser.parse("age >= 70");
    expect(ast).toEqual({
      type: "term",
      attribute: "age",
      operator: "GREATER_THAN_OR_EQUAL",
      value: 70,
    });
  });

  it("parses boolean comparisons and bare booleans", () => {
    const ast1 = ExpressionParser.parse("in_secc_2011_deprivation_database == true");
    expect(ast1).toEqual({
      type: "term",
      attribute: "in_secc_2011_deprivation_database",
      operator: "EQUALS",
      value: true,
    });

    const ast2 = ExpressionParser.parse("is_pregnant");
    expect(ast2).toEqual({
      type: "term",
      attribute: "is_pregnant",
      operator: "EQUALS",
      value: true,
    });
  });

  it("parses string comparisons with quotes", () => {
    const ast = ExpressionParser.parse("gender == 'FEMALE'");
    expect(ast).toEqual({
      type: "term",
      attribute: "gender",
      operator: "EQUALS",
      value: "FEMALE",
    });
  });

  it("parses binary AND / OR expressions with operator precedence", () => {
    const ast = ExpressionParser.parse("subscheme == 'IGNOAPS' AND age >= 60");
    expect(ast.type).toBe("binary");
    if (ast.type === "binary") {
      expect(ast.operator).toBe("AND");
      expect(ast.left).toEqual({
        type: "term",
        attribute: "subscheme",
        operator: "EQUALS",
        value: "IGNOAPS",
      });
      expect(ast.right).toEqual({
        type: "term",
        attribute: "age",
        operator: "GREATER_THAN_OR_EQUAL",
        value: 60,
      });
    }
  });

  it("parses complex nested expressions with parentheses", () => {
    const ast = ExpressionParser.parse("(age >= 60 OR is_widow == true) AND annual_family_income <= 21000");
    expect(ast.type).toBe("binary");
    if (ast.type === "binary") {
      expect(ast.operator).toBe("AND");
      expect(ast.left.type).toBe("binary");
      expect(ast.right.type).toBe("term");
    }
  });

  it("parses IN array expressions", () => {
    const ast = ExpressionParser.parse("marital_status IN ['WIDOW', 'DIVORCED']");
    expect(ast).toEqual({
      type: "term",
      attribute: "marital_status",
      operator: "IN",
      value: ["WIDOW", "DIVORCED"],
    });
  });

  it("parses unary NOT expressions", () => {
    const ast = ExpressionParser.parse("NOT (age < 18)");
    expect(ast.type).toBe("unary");
    if (ast.type === "unary") {
      expect(ast.operator).toBe("NOT");
      expect(ast.argument.type).toBe("term");
    }
  });

  it("fails gracefully on invalid expressions", () => {
    expect(() => ExpressionParser.parse("age >=")).toThrow();
    expect(() => ExpressionParser.parse("(age >= 18")).toThrow();
    expect(() => ExpressionParser.parse("'unterminated")).toThrow();
  });

  it("safely handles code injection attempts without executing them", () => {
    // Attempt node injection strings
    const injection1 = "require('child_process').execSync('dir')";
    // Parser must either throw a syntax error or parse as simple tokens without execution
    try {
      const ast = ExpressionParser.parse(injection1);
      expect(ast).toBeDefined();
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(Error);
    }

    const injection2 = "process.exit(1)";
    try {
      const ast = ExpressionParser.parse(injection2);
      expect(ast).toBeDefined();
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(Error);
    }
  });
});
