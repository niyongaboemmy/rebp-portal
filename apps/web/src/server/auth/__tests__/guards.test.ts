import { describe, expect, it } from "vitest";
import { safeNextPath } from "../guards";

describe("safeNextPath (open-redirect guard)", () => {
  it.each([
    ["/applications/42", "/applications/42"],
    ["https://evil.example", "/dashboard"],
    ["//evil.example", "/dashboard"],
    ["/\\evil.example", "/dashboard"],
    ["", "/dashboard"],
    [undefined, "/dashboard"],
  ])("%s → %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});
