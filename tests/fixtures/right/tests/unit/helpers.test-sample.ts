import { describe, it, expect } from "vitest";
import {
  capitalize,
  slugify,
  truncate,
  debounce,
  throttle,
  deepClone,
  deepEqual,
  groupBy,
  unique,
  chunk,
  pick,
  omit,
  formatBytes,
  formatDuration,
  isPlainObject,
  flatten,
  intersection,
  difference,
  mapValues,
  clamp,
  randomId,
} from "../../src/utils/helpers";

describe("capitalize", () => {
  it("capitalizes the first letter", () => {
    expect(capitalize("hello")).toBe("Hello");
  });

  it("handles empty string", () => {
    expect(capitalize("")).toBe("");
  });

  it("handles already capitalized", () => {
    expect(capitalize("Hello")).toBe("Hello");
  });

  it("handles single character", () => {
    expect(capitalize("a")).toBe("A");
  });
});

describe("slugify", () => {
  it("converts spaces to hyphens", () => {
    expect(slugify("hello world")).toBe("hello-world");
  });

  it("removes special characters", () => {
    expect(slugify("hello@world!")).toBe("helloworld");
  });

  it("converts to lowercase", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("handles multiple spaces", () => {
    expect(slugify("hello   world")).toBe("hello-world");
  });

  it("trims leading/trailing whitespace", () => {
    expect(slugify("  hello  ")).toBe("hello");
  });

  it("collapses multiple hyphens", () => {
    expect(slugify("hello - - world")).toBe("hello-world");
  });
});

describe("truncate", () => {
  it("truncates long strings", () => {
    expect(truncate("hello world", 8)).toBe("hello...");
  });

  it("keeps short strings unchanged", () => {
    expect(truncate("hi", 10)).toBe("hi");
  });

  it("handles exact length", () => {
    expect(truncate("hello", 5)).toBe("hello");
  });

  it("supports custom suffix", () => {
    expect(truncate("hello world", 9, "…")).toBe("hello wo…");
  });
});

describe("deepClone", () => {
  it("clones nested objects", () => {
    const obj = { a: { b: { c: 1 } } };
    const cloned = deepClone(obj);
    expect(cloned).toEqual(obj);
    expect(cloned).not.toBe(obj);
  });

  it("clones arrays", () => {
    const arr = [1, [2, [3]]];
    const cloned = deepClone(arr);
    expect(cloned).toEqual(arr);
    expect(cloned).not.toBe(arr);
  });

  it("handles primitives", () => {
    expect(deepClone(42)).toBe(42);
    expect(deepClone("hello")).toBe("hello");
    expect(deepClone(null)).toBe(null);
  });
});

describe("deepEqual", () => {
  it("compares equal objects", () => {
    expect(deepEqual({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 2 } })).toBe(true);
  });

  it("detects different values", () => {
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  it("detects different keys", () => {
    expect(deepEqual({ a: 1 }, { b: 1 })).toBe(false);
  });

  it("handles primitives", () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual(1, 2)).toBe(false);
    expect(deepEqual("a", "a")).toBe(true);
  });

  it("handles null", () => {
    expect(deepEqual(null, null)).toBe(true);
    expect(deepEqual(null, {})).toBe(false);
  });
});

describe("groupBy", () => {
  it("groups items by key", () => {
    const items = [
      { name: "Alice", role: "admin" },
      { name: "Bob", role: "user" },
      { name: "Charlie", role: "admin" },
    ];
    const grouped = groupBy(items, (item) => item.role);
    expect(grouped.admin).toHaveLength(2);
    expect(grouped.user).toHaveLength(1);
  });

  it("handles empty array", () => {
    expect(groupBy([], () => "key")).toEqual({});
  });
});

describe("unique", () => {
  it("removes duplicates", () => {
    expect(unique([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
  });

  it("supports custom key function", () => {
    const items = [
      { id: 1, name: "a" },
      { id: 2, name: "b" },
      { id: 1, name: "c" },
    ];
    const result = unique(items, (i) => i.id);
    expect(result).toHaveLength(2);
  });

  it("handles empty array", () => {
    expect(unique([])).toEqual([]);
  });
});

describe("chunk", () => {
  it("splits array into chunks", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("handles chunk size larger than array", () => {
    expect(chunk([1, 2], 5)).toEqual([[1, 2]]);
  });

  it("handles empty array", () => {
    expect(chunk([], 3)).toEqual([]);
  });

  it("throws on non-positive size", () => {
    expect(() => chunk([1, 2], 0)).toThrow("Chunk size must be positive");
    expect(() => chunk([1, 2], -1)).toThrow("Chunk size must be positive");
  });
});

describe("pick", () => {
  it("picks specified keys", () => {
    const obj = { a: 1, b: 2, c: 3 };
    expect(pick(obj, ["a", "c"])).toEqual({ a: 1, c: 3 });
  });

  it("ignores missing keys", () => {
    const obj = { a: 1, b: 2 };
    expect(pick(obj, ["a", "c" as never])).toEqual({ a: 1 });
  });
});

describe("omit", () => {
  it("omits specified keys", () => {
    const obj = { a: 1, b: 2, c: 3 };
    expect(omit(obj, ["b"])).toEqual({ a: 1, c: 3 });
  });
});

describe("formatBytes", () => {
  it("formats zero", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats bytes", () => {
    expect(formatBytes(500)).toBe("500 B");
  });

  it("formats kilobytes", () => {
    expect(formatBytes(1024)).toBe("1.00 KB");
  });

  it("formats megabytes", () => {
    expect(formatBytes(1048576)).toBe("1.00 MB");
  });

  it("formats gigabytes", () => {
    expect(formatBytes(1073741824)).toBe("1.00 GB");
  });

  it("throws on negative", () => {
    expect(() => formatBytes(-1)).toThrow("Bytes must be non-negative");
  });
});

describe("formatDuration", () => {
  it("formats milliseconds", () => {
    expect(formatDuration(500)).toBe("500ms");
  });

  it("formats seconds", () => {
    expect(formatDuration(2500)).toBe("2.5s");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(125000)).toBe("2m 5s");
  });

  it("formats hours and minutes", () => {
    expect(formatDuration(7500000)).toBe("2h 5m");
  });

  it("formats negative durations", () => {
    expect(formatDuration(-500)).toBe("-500ms");
  });
});

describe("isPlainObject", () => {
  it("returns true for plain objects", () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject({ a: 1 })).toBe(true);
  });

  it("returns true for null prototype objects", () => {
    expect(isPlainObject(Object.create(null))).toBe(true);
  });

  it("returns false for non-objects", () => {
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject(42)).toBe(false);
    expect(isPlainObject("str")).toBe(false);
    expect(isPlainObject([])).toBe(false);
  });
});

describe("flatten", () => {
  it("flattens nested arrays", () => {
    expect(flatten([[1, 2], [3], [4, 5]])).toEqual([1, 2, 3, 4, 5]);
  });

  it("handles empty arrays", () => {
    expect(flatten([])).toEqual([]);
    expect(flatten([[], []])).toEqual([]);
  });
});

describe("intersection", () => {
  it("finds common elements", () => {
    expect(intersection([1, 2, 3], [2, 3, 4])).toEqual([2, 3]);
  });

  it("returns empty for no overlap", () => {
    expect(intersection([1, 2], [3, 4])).toEqual([]);
  });
});

describe("difference", () => {
  it("finds elements in first but not second", () => {
    expect(difference([1, 2, 3], [2, 3, 4])).toEqual([1]);
  });

  it("returns all when no overlap", () => {
    expect(difference([1, 2], [3, 4])).toEqual([1, 2]);
  });
});

describe("mapValues", () => {
  it("maps over object values", () => {
    expect(mapValues({ a: 1, b: 2 }, (v) => v * 2)).toEqual({ a: 2, b: 4 });
  });

  it("provides key to callback", () => {
    const result = mapValues({ x: 1, y: 2 }, (v, k) => `${k}=${v}`);
    expect(result).toEqual({ x: "x=1", y: "y=2" });
  });
});

describe("clamp", () => {
  it("clamps below min", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it("clamps above max", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("returns value within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
});

describe("randomId", () => {
  it("generates default length", () => {
    expect(randomId()).toHaveLength(12);
  });

  it("generates custom length", () => {
    expect(randomId(6)).toHaveLength(6);
  });

  it("generates unique ids", () => {
    const ids = new Set(Array.from({ length: 100 }, () => randomId()));
    expect(ids.size).toBe(100);
  });
});
