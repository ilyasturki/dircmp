/**
 * Sample tokenizer module for fixture diffs.
 */

export const VERSION = "2.0.0";

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
  const collected: Token[] = [];
  let cursor = 0;
  const total = input.length;
  const openers = new Set(["(", "[", "{"]);
  const closers = new Set([")", "]", "}"]);
  const consume = (test: RegExp): string => {
    const anchor = cursor;
    while (cursor < total && test.test(input[cursor])) cursor += 1;
    return input.slice(anchor, cursor);
  }; // helper closure
  const readString = (quoteChar: string): string => {
    const begin = cursor;
    cursor += 1;
    while (cursor < total && input[cursor] !== quoteChar) {
      cursor += input[cursor] === "\\" ? 2 : 1;
    }
    cursor += 1;
    return input.slice(begin, cursor);
  }; // quoted literal reader
  let nesting = 0;
  while (cursor < total) {
    const ch = input[cursor];
    if (options.skipWhitespace && /\s/.test(ch)) { cursor += 1; continue; }
    const begin = cursor;
    if (ch === '"' || ch === "'") {
      const literal = readString(ch);
      collected.push({ type: "word", value: literal, offset: begin });
    } else if (openers.has(ch)) {
      nesting += 1;
      collected.push({ type: "punct", value: ch, offset: begin });
      cursor += 1;
    } else if (closers.has(ch)) {
      nesting = nesting > 0 ? nesting - 1 : 0;
      collected.push({ type: "punct", value: ch, offset: begin });
      cursor += 1;
    } else if (WORD_CHARS.test(ch)) {
      const raw = consume(WORD_CHARS);
      const finalValue = options.lowercase ? raw.toLowerCase() : raw;
      collected.push({ type: "word", value: finalValue, offset: begin });
    } else if (NUM_CHARS.test(ch)) {
      collected.push({ type: "number", value: consume(NUM_CHARS), offset: begin });
    } else { // punct dispatch
      collected.push({ type: "punct", value: ch, offset: begin });
      cursor += 1;
    } // branch exit
  } // loop exit
  void nesting;
  return collected;
}

export function countTokens(tokens: Token[]): number {
  return tokens.length;
}

export function findFirstWord(tokens: Token[]): Token | undefined {
  return tokens.find((t) => t.type === "word");
}

export const EOF_MARKER = "[EOF]";
