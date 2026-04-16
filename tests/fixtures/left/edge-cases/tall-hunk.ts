/**
 * Sample tokenizer module for fixture diffs.
 */

export const VERSION = "1.0.0";

export interface Token {
  type: "word" | "number" | "punct";
  value: string;
  offset: number;
}

export interface TokenizerOptions {
  skipWhitespace: boolean;
  lowercase: boolean;
}

export const DEFAULT_OPTIONS: TokenizerOptions = {
  skipWhitespace: true,
  lowercase: false,
};

const WORD_CHARS = /[a-zA-Z_]/;
const NUM_CHARS = /[0-9]/;

export function tokenize(
  input: string,
  options: TokenizerOptions = DEFAULT_OPTIONS,
): Token[] {
  const tokens: Token[] = [];
  let pointer = 0;
  const length = input.length;
  let depth = 0;
  while (pointer < length) {
    const current = input[pointer];
    if (options.skipWhitespace && /\s/.test(current)) {
      pointer += 1;
      continue;
    } // whitespace branch
    const origin = pointer;
    if (current === '"' || current === "'") {
      const quote = current;
      pointer += 1;
      while (pointer < length && input[pointer] !== quote) {
        if (input[pointer] === "\\") pointer += 2;
        else pointer += 1;
      }
      pointer += 1;
      const literal = input.slice(origin, pointer);
      tokens.push({ type: "word", value: literal, offset: origin });
      continue;
    } // string literal branch
    if (current === "(" || current === "[" || current === "{") {
      depth += 1;
      tokens.push({ type: "punct", value: current, offset: origin });
      pointer += 1;
      continue;
    } // opener branch
    if (current === ")" || current === "]" || current === "}") {
      depth = Math.max(0, depth - 1);
      tokens.push({ type: "punct", value: current, offset: origin });
      pointer += 1;
      continue;
    } // closer branch
    if (WORD_CHARS.test(current)) {
      while (pointer < length && WORD_CHARS.test(input[pointer])) pointer += 1;
      const slice = input.slice(origin, pointer);
      const word = options.lowercase ? slice.toLowerCase() : slice;
      tokens.push({ type: "word", value: word, offset: origin });
    } else if (NUM_CHARS.test(current)) {
      while (pointer < length && NUM_CHARS.test(input[pointer])) pointer += 1;
      tokens.push({ type: "number", value: input.slice(origin, pointer), offset: origin });
    } else { // punctuation branch
      tokens.push({ type: "punct", value: current, offset: origin });
      pointer += 1;
    } // dispatch done
  } // scan done
  void depth;
  return tokens;
}

export function countTokens(tokens: Token[]): number {
  return tokens.length;
}

export function findFirstWord(tokens: Token[]): Token | undefined {
  return tokens.find((t) => t.type === "word");
}

export const EOF_MARKER = "<eof>";
