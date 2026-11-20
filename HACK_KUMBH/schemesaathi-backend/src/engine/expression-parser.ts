import { ComparisonOperator, ExpressionNode, ComparisonTermNode } from "./types.js";

export type TokenType =
  | "IDENTIFIER"
  | "STRING"
  | "NUMBER"
  | "BOOLEAN"
  | "OPERATOR"
  | "AND"
  | "OR"
  | "NOT"
  | "LPAREN"
  | "RPAREN"
  | "LBRACKET"
  | "RBRACKET"
  | "COMMA"
  | "EOF";

export interface Token {
  type: TokenType;
  value: string | number | boolean;
  position: number;
}

export class Tokenizer {
  private pos = 0;
  private input: string;

  constructor(input: string) {
    this.input = input.trim();
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];
    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];

      if (/\s/.test(ch ?? "")) {
        this.pos++;
        continue;
      }

      if (ch === "(") {
        tokens.push({ type: "LPAREN", value: "(", position: this.pos++ });
        continue;
      }
      if (ch === ")") {
        tokens.push({ type: "RPAREN", value: ")", position: this.pos++ });
        continue;
      }
      if (ch === "[") {
        tokens.push({ type: "LBRACKET", value: "[", position: this.pos++ });
        continue;
      }
      if (ch === "]") {
        tokens.push({ type: "RBRACKET", value: "]", position: this.pos++ });
        continue;
      }
      if (ch === ",") {
        tokens.push({ type: "COMMA", value: ",", position: this.pos++ });
        continue;
      }

      // Strings ('...' or "...")
      if (ch === "'" || ch === '"') {
        const quote = ch;
        const start = this.pos;
        this.pos++;
        let str = "";
        while (this.pos < this.input.length && this.input[this.pos] !== quote) {
          if (this.input[this.pos] === "\\" && this.pos + 1 < this.input.length) {
            this.pos++;
          }
          str += this.input[this.pos];
          this.pos++;
        }
        if (this.pos >= this.input.length) {
          throw new Error(`Unterminated string starting at position ${start}`);
        }
        this.pos++; // consume closing quote
        tokens.push({ type: "STRING", value: str, position: start });
        continue;
      }

      // Two-character operators: ==, !=, >=, <=, &&, ||
      const two = this.input.slice(this.pos, this.pos + 2);
      if (two === "==" || two === "!=" || two === ">=" || two === "<=") {
        tokens.push({ type: "OPERATOR", value: two, position: this.pos });
        this.pos += 2;
        continue;
      }
      if (two === "&&") {
        tokens.push({ type: "AND", value: "AND", position: this.pos });
        this.pos += 2;
        continue;
      }
      if (two === "||") {
        tokens.push({ type: "OR", value: "OR", position: this.pos });
        this.pos += 2;
        continue;
      }

      // Single-character operators: >, <, =
      if (ch === ">" || ch === "<") {
        tokens.push({ type: "OPERATOR", value: ch, position: this.pos++ });
        continue;
      }
      if (ch === "=") {
        tokens.push({ type: "OPERATOR", value: "==", position: this.pos++ });
        continue;
      }
      if (ch === "!") {
        tokens.push({ type: "NOT", value: "NOT", position: this.pos++ });
        continue;
      }

      // Numbers
      if (ch && (/[0-9]/.test(ch) || (ch === "-" && /[0-9]/.test(this.input[this.pos + 1] ?? "")))) {
        const start = this.pos;
        let numStr: string = ch;
        this.pos++;
        while (this.pos < this.input.length && /[0-9.]/.test(this.input[this.pos] ?? "")) {
          numStr += this.input[this.pos]!;
          this.pos++;
        }
        const parsed = Number(numStr);
        if (isNaN(parsed)) {
          throw new Error(`Invalid number '${numStr}' at position ${start}`);
        }
        tokens.push({ type: "NUMBER", value: parsed, position: start });
        continue;
      }

      // Words (Identifiers, keywords: AND, OR, NOT, IN, true, false)
      if (/[a-zA-Z_]/.test(ch ?? "")) {
        const start = this.pos;
        let word = "";
        while (this.pos < this.input.length && /[a-zA-Z0-9_]/.test(this.input[this.pos] ?? "")) {
          word += this.input[this.pos];
          this.pos++;
        }
        const upper = word.toUpperCase();
        if (upper === "AND") {
          tokens.push({ type: "AND", value: "AND", position: start });
        } else if (upper === "OR") {
          tokens.push({ type: "OR", value: "OR", position: start });
        } else if (upper === "NOT") {
          tokens.push({ type: "NOT", value: "NOT", position: start });
        } else if (upper === "IN") {
          tokens.push({ type: "OPERATOR", value: "IN", position: start });
        } else if (upper === "TRUE") {
          tokens.push({ type: "BOOLEAN", value: true, position: start });
        } else if (upper === "FALSE") {
          tokens.push({ type: "BOOLEAN", value: false, position: start });
        } else {
          tokens.push({ type: "IDENTIFIER", value: word, position: start });
        }
        continue;
      }

      throw new Error(`Unexpected character '${ch}' at position ${this.pos}`);
    }

    tokens.push({ type: "EOF", value: "", position: this.pos });
    return tokens;
  }
}

export class ExpressionParser {
  private tokens: Token[];
  private current = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  static parse(expressionStr: string): ExpressionNode {
    const tokenizer = new Tokenizer(expressionStr);
    const tokens = tokenizer.tokenize();
    const parser = new ExpressionParser(tokens);
    const ast = parser.parseExpression();
    if (!parser.isAtEnd()) {
      const leftover = parser.peek();
      throw new Error(`Unexpected token '${String(leftover.value)}' at position ${leftover.position}`);
    }
    return ast;
  }

  private parseExpression(): ExpressionNode {
    return this.parseOr();
  }

  private parseOr(): ExpressionNode {
    let expr = this.parseAnd();

    while (this.match("OR")) {
      const right = this.parseAnd();
      expr = {
        type: "binary",
        operator: "OR",
        left: expr,
        right,
      };
    }

    return expr;
  }

  private parseAnd(): ExpressionNode {
    let expr = this.parseNot();

    while (this.match("AND")) {
      const right = this.parseNot();
      expr = {
        type: "binary",
        operator: "AND",
        left: expr,
        right,
      };
    }

    return expr;
  }

  private parseNot(): ExpressionNode {
    if (this.match("NOT")) {
      const argument = this.parseNot();
      return {
        type: "unary",
        operator: "NOT",
        argument,
      };
    }

    return this.parsePrimary();
  }

  private parsePrimary(): ExpressionNode {
    if (this.match("LPAREN")) {
      const expr = this.parseExpression();
      this.consume("RPAREN", "Expected ')' after grouping expression");
      return expr;
    }

    return this.parseTerm();
  }

  private parseTerm(): ComparisonTermNode {
    const token = this.peek();
    if (token.type !== "IDENTIFIER") {
      throw new Error(`Expected attribute identifier at position ${token.position}, got ${token.type}`);
    }
    this.advance();
    const attribute = String(token.value);

    // If next is not an operator, assume bare boolean flag: attribute == true
    if (this.peek().type !== "OPERATOR") {
      return {
        type: "term",
        attribute,
        operator: "EQUALS",
        value: true,
      };
    }

    const opToken = this.advance();
    const opStr = String(opToken.value).toUpperCase();
    let op: ComparisonOperator = "EQUALS";
    if (opStr === "==" || opStr === "=") op = "EQUALS";
    else if (opStr === "!=") op = "NOT_EQUALS";
    else if (opStr === ">=") op = "GREATER_THAN_OR_EQUAL";
    else if (opStr === "<=") op = "LESS_THAN_OR_EQUAL";
    else if (opStr === ">") op = "GREATER_THAN";
    else if (opStr === "<") op = "LESS_THAN";
    else if (opStr === "IN") op = "IN";
    else {
      throw new Error(`Unsupported operator '${opStr}' at position ${opToken.position}`);
    }

    // Parse literal or array
    const value = this.parseValue();
    return {
      type: "term",
      attribute,
      operator: op,
      value,
    };
  }

  private parseValue(): unknown {
    if (this.match("LBRACKET")) {
      const list: unknown[] = [];
      if (!this.check("RBRACKET")) {
        do {
          list.push(this.parseLiteral());
        } while (this.match("COMMA"));
      }
      this.consume("RBRACKET", "Expected ']' after list");
      return list;
    }

    return this.parseLiteral();
  }

  private parseLiteral(): unknown {
    const token = this.peek();
    if (token.type === "STRING" || token.type === "NUMBER" || token.type === "BOOLEAN") {
      this.advance();
      return token.value;
    }
    if (token.type === "IDENTIFIER") {
      // Treat identifier in value position as string (e.g. status == ACTIVE)
      this.advance();
      return String(token.value);
    }
    throw new Error(`Expected literal value at position ${token.position}, got ${token.type}`);
  }

  private match(...types: TokenType[]): boolean {
    for (const t of types) {
      if (this.check(t)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return type === "EOF";
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.tokens[this.current - 1]!;
  }

  private isAtEnd(): boolean {
    return this.peek().type === "EOF";
  }

  private peek(): Token {
    return this.tokens[this.current]!;
  }

  private consume(type: TokenType, errorMessage: string): Token {
    if (this.check(type)) return this.advance();
    const token = this.peek();
    throw new Error(`${errorMessage} at position ${token.position}`);
  }
}
