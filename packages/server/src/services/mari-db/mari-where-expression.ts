type Row = Record<string, unknown>;
type ValueExpression = (row: Row) => unknown;

type Token =
  | { kind: "identifier"; value: string }
  | { kind: "number"; value: number }
  | { kind: "string"; value: string }
  | { kind: "operator"; value: string }
  | { kind: "eof" };

const MAX_EXPRESSION_LENGTH = 4_096;
const MAX_TOKENS = 512;
const MAX_NESTING = 32;
const BLOCKED_PROPERTIES = new Set(["__proto__", "prototype", "constructor"]);
const SAFE_ZERO_ARGUMENT_METHODS = new Set(["toLowerCase", "toUpperCase", "trim"]);
const SAFE_ONE_ARGUMENT_METHODS = new Set(["includes", "startsWith", "endsWith"]);
const OPERATORS = ["===", "!==", "&&", "||", ">=", "<=", "==", "!=", ">", "<", "!", "-", "(", ")", "[", "]", "."];

function isIdentifierStart(char: string | undefined) {
  return Boolean(char && /[A-Za-z_$]/u.test(char));
}

function isIdentifierPart(char: string | undefined) {
  return Boolean(char && /[A-Za-z0-9_$]/u.test(char));
}

function readString(source: string, start: number): { value: string; end: number } {
  const quote = source[start]!;
  let value = "";
  for (let index = start + 1; index < source.length; index += 1) {
    const char = source[index]!;
    if (char === quote) return { value, end: index + 1 };
    if (char !== "\\") {
      value += char;
      continue;
    }
    index += 1;
    if (index >= source.length) throw new Error("Unterminated escape sequence in --where expression");
    const escaped = source[index]!;
    if (escaped === "n") value += "\n";
    else if (escaped === "r") value += "\r";
    else if (escaped === "t") value += "\t";
    else if (escaped === "b") value += "\b";
    else if (escaped === "f") value += "\f";
    else if (escaped === "v") value += "\v";
    else if (escaped === "0") value += "\0";
    else if (escaped === "u") {
      const digits = source.slice(index + 1, index + 5);
      if (!/^[0-9a-fA-F]{4}$/u.test(digits)) throw new Error("Invalid Unicode escape in --where expression");
      value += String.fromCharCode(Number.parseInt(digits, 16));
      index += 4;
    } else value += escaped;
  }
  throw new Error("Unterminated string in --where expression");
}

function tokenize(source: string): Token[] {
  if (source.length > MAX_EXPRESSION_LENGTH) {
    throw new Error(`--where expression exceeds ${MAX_EXPRESSION_LENGTH} characters`);
  }
  const tokens: Token[] = [];
  let index = 0;
  const push = (token: Token) => {
    tokens.push(token);
    if (tokens.length > MAX_TOKENS) throw new Error(`--where expression exceeds ${MAX_TOKENS} tokens`);
  };
  while (index < source.length) {
    const char = source[index]!;
    if (/\s/u.test(char)) {
      index += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      const parsed = readString(source, index);
      push({ kind: "string", value: parsed.value });
      index = parsed.end;
      continue;
    }
    const numberMatch = source.slice(index).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/u);
    if (numberMatch) {
      const value = Number(numberMatch[0]);
      if (!Number.isFinite(value)) throw new Error("--where number must be finite");
      push({ kind: "number", value });
      index += numberMatch[0].length;
      continue;
    }
    if (isIdentifierStart(char)) {
      let end = index + 1;
      while (isIdentifierPart(source[end])) end += 1;
      push({ kind: "identifier", value: source.slice(index, end) });
      index = end;
      continue;
    }
    const operator = OPERATORS.find((candidate) => source.startsWith(candidate, index));
    if (!operator) throw new Error(`Unsupported token ${JSON.stringify(char)} in --where expression`);
    push({ kind: "operator", value: operator });
    index += operator.length;
  }
  push({ kind: "eof" });
  return tokens;
}

function scalarEquals(left: unknown, right: unknown, loose: boolean) {
  if (!loose) return Object.is(left, right);
  if (left == null || right == null) return left == null && right == null;
  if (typeof left === typeof right) return Object.is(left, right);
  if (
    (typeof left === "string" || typeof left === "number" || typeof left === "boolean") &&
    (typeof right === "string" || typeof right === "number" || typeof right === "boolean")
  ) {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    return Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber === rightNumber;
  }
  return false;
}

function compare(left: unknown, right: unknown, operator: string) {
  if (operator === "===" || operator === "==") return scalarEquals(left, right, operator === "==");
  if (operator === "!==" || operator === "!=") return !scalarEquals(left, right, operator === "!=");
  if (!(
    (typeof left === "number" && typeof right === "number") ||
    (typeof left === "string" && typeof right === "string")
  )) {
    return false;
  }
  if (operator === ">") return left > right;
  if (operator === ">=") return left >= right;
  if (operator === "<") return left < right;
  return left <= right;
}

function ownProperty(value: unknown, key: string | number): unknown {
  const property = String(key);
  if (BLOCKED_PROPERTIES.has(property) || (typeof value !== "object" && typeof value !== "string") || value === null) {
    return undefined;
  }
  return Object.prototype.hasOwnProperty.call(value, property)
    ? (value as Record<string, unknown>)[property]
    : undefined;
}

function callSafeMethod(value: unknown, method: string, argument?: unknown): unknown {
  if (method === "toLowerCase" && typeof value === "string") return value.toLowerCase();
  if (method === "toUpperCase" && typeof value === "string") return value.toUpperCase();
  if (method === "trim" && typeof value === "string") return value.trim();
  if (method === "includes") {
    if (typeof value === "string") return typeof argument === "string" && value.includes(argument);
    if (Array.isArray(value)) return value.some((entry) => scalarEquals(entry, argument, false));
  }
  if (method === "startsWith" && typeof value === "string") {
    return typeof argument === "string" && value.startsWith(argument);
  }
  if (method === "endsWith" && typeof value === "string") {
    return typeof argument === "string" && value.endsWith(argument);
  }
  return false;
}

class Parser {
  private index = 0;
  private nesting = 0;
  private readonly rowIdentityExpressions = new WeakSet<ValueExpression>();

  constructor(private readonly tokens: Token[]) {}

  parse(): ValueExpression {
    const expression = this.parseOr();
    if (this.peek().kind !== "eof") throw new Error("Unexpected content at the end of --where expression");
    if (this.rowIdentityExpressions.has(expression)) {
      throw new Error("A bare row object is not a valid --where predicate");
    }
    return expression;
  }

  private peek(): Token {
    return this.tokens[this.index] ?? { kind: "eof" };
  }

  private takeOperator(value: string) {
    const token = this.peek();
    if (token.kind !== "operator" || token.value !== value) return false;
    this.index += 1;
    return true;
  }

  private expectOperator(value: string) {
    if (!this.takeOperator(value)) throw new Error(`Expected ${value} in --where expression`);
  }

  private parseOr(): ValueExpression {
    let left = this.parseAnd();
    while (this.takeOperator("||")) {
      const previous = left;
      const right = this.parseAnd();
      left = (row) => {
        const value = previous(row);
        return value ? value : right(row);
      };
    }
    return left;
  }

  private parseAnd(): ValueExpression {
    let left = this.parseEquality();
    while (this.takeOperator("&&")) {
      const previous = left;
      const right = this.parseEquality();
      left = (row) => {
        const value = previous(row);
        return value ? right(row) : value;
      };
    }
    return left;
  }

  private parseEquality(): ValueExpression {
    let left = this.parseComparison();
    while (true) {
      const token = this.peek();
      if (token.kind !== "operator" || !["===", "!==", "==", "!="].includes(token.value)) return left;
      this.index += 1;
      const previous = left;
      const right = this.parseComparison();
      left = (row) => compare(previous(row), right(row), token.value);
    }
  }

  private parseComparison(): ValueExpression {
    let left = this.parseUnary();
    while (true) {
      const token = this.peek();
      if (token.kind !== "operator" || ![">", ">=", "<", "<="].includes(token.value)) return left;
      this.index += 1;
      const previous = left;
      const right = this.parseUnary();
      left = (row) => compare(previous(row), right(row), token.value);
    }
  }

  private parseUnary(): ValueExpression {
    if (this.takeOperator("!")) {
      const operand = this.parseUnary();
      return (row) => !Boolean(operand(row));
    }
    if (this.takeOperator("-")) {
      const operand = this.parseUnary();
      return (row) => {
        const value = operand(row);
        return typeof value === "number" ? -value : Number.NaN;
      };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ValueExpression {
    const token = this.peek();
    if (token.kind === "number" || token.kind === "string") {
      this.index += 1;
      return () => token.value;
    }
    if (token.kind === "identifier") {
      this.index += 1;
      if (token.value === "true") return () => true;
      if (token.value === "false") return () => false;
      if (token.value === "null") return () => null;
      if (token.value === "undefined") return () => undefined;
      if (token.value !== "row") throw new Error(`Only row properties are available in --where expressions`);
      let expression: ValueExpression = (row) => row;
      this.rowIdentityExpressions.add(expression);
      while (true) {
        let property: string | number;
        if (this.takeOperator(".")) {
          const propertyToken = this.peek();
          if (propertyToken.kind !== "identifier")
            throw new Error("Expected a property name after . in --where expression");
          this.index += 1;
          property = propertyToken.value;
          if (
            (SAFE_ZERO_ARGUMENT_METHODS.has(property) || SAFE_ONE_ARGUMENT_METHODS.has(property)) &&
            this.takeOperator("(")
          ) {
            const previous = expression;
            this.nesting += 1;
            if (this.nesting > MAX_NESTING) {
              throw new Error(`--where expression exceeds ${MAX_NESTING} nested groups`);
            }
            if (SAFE_ZERO_ARGUMENT_METHODS.has(property)) {
              this.expectOperator(")");
              expression = (row) => callSafeMethod(previous(row), String(property));
            } else {
              const argument = this.parseOr();
              this.expectOperator(")");
              expression = (row) => callSafeMethod(previous(row), String(property), argument(row));
            }
            this.nesting -= 1;
            continue;
          }
        } else if (this.takeOperator("[")) {
          const propertyToken = this.peek();
          if (propertyToken.kind !== "string" && propertyToken.kind !== "number") {
            throw new Error("Bracket access in --where accepts only a string or number literal");
          }
          this.index += 1;
          property = propertyToken.value;
          this.expectOperator("]");
        } else return expression;
        const previous = expression;
        expression = (row) => ownProperty(previous(row), property);
      }
    }
    if (this.takeOperator("(")) {
      this.nesting += 1;
      if (this.nesting > MAX_NESTING) throw new Error(`--where expression exceeds ${MAX_NESTING} nested groups`);
      const expression = this.parseOr();
      this.expectOperator(")");
      this.nesting -= 1;
      return expression;
    }
    throw new Error("Expected a value in --where expression");
  }
}

export function createMariWherePredicate(expression: string | undefined): (row: Row) => boolean {
  if (!expression?.trim()) return () => true;
  const evaluate = new Parser(tokenize(expression)).parse();
  return (row) => Boolean(evaluate(row));
}
