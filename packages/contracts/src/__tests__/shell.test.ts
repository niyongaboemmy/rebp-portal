import { describe, expect, it } from "vitest";
import { DEFAULT_SHELL_PREFS, parseShellPrefs, serializeShellPrefs } from "../shell";

describe("shell preferences (UX-001, ADR-011)", () => {
  it("defaults when the cookie is missing", () => {
    expect(parseShellPrefs(undefined)).toEqual({
      sidebar: "auto",
      density: "comfortable",
      width: "default",
      sidebarWidth: 256,
    });
  });

  it("round-trips through the cookie value", () => {
    const prefs = {
      sidebar: "collapsed",
      density: "compact",
      width: "full",
      sidebarWidth: 288,
    } as const;
    expect(parseShellPrefs(serializeShellPrefs(prefs))).toEqual(prefs);
  });

  it("replaces unknown values field by field", () => {
    expect(parseShellPrefs("sidebar=sideways&density=compact")).toEqual({
      ...DEFAULT_SHELL_PREFS,
      density: "compact",
    });
  });

  it("keeps the sidebar width within its bounds", () => {
    expect(parseShellPrefs("sidebarWidth=999").sidebarWidth).toBe(256);
    expect(parseShellPrefs("sidebarWidth=240").sidebarWidth).toBe(240);
    expect(parseShellPrefs("sidebarWidth=wide").sidebarWidth).toBe(256);
  });

  it("survives garbage", () => {
    expect(parseShellPrefs("%%%;{not json")).toEqual(DEFAULT_SHELL_PREFS);
  });

  it("produces a cookie-safe value", () => {
    expect(serializeShellPrefs(DEFAULT_SHELL_PREFS)).not.toMatch(/[;,\s]/);
  });
});
