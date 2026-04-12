import { describe, it, expect, vi } from "vitest";
import { setupLogger } from "../../src/utils/logger";

describe("setupLogger", () => {
  it("logs with prefix", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = setupLogger("test");
    logger.info("hello");
    expect(spy).toHaveBeenCalledWith("[INFO] [test] hello");
    spy.mockRestore();
  });
});
