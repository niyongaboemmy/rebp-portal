import { describe, expect, it } from "vitest";
import {
  capabilitiesFor,
  CONFIG_KEYS,
  CONFIG_MAKER_SCOPE,
  mayProposeConfig,
  type Capability,
} from "../index";

describe("configuration maker scope (FR-ADM-003)", () => {
  it("lets finance make fee schedules only", () => {
    const finance = capabilitiesFor(["FINANCE_OFFICER"]);
    expect(mayProposeConfig("fees", finance)).toBe(true);
    expect(mayProposeConfig("thresholds", finance)).toBe(false);
    expect(mayProposeConfig("flags", finance)).toBe(false);
  });

  it("lets system administrators make every key", () => {
    const admin = capabilitiesFor(["SYSTEM_ADMIN"]);
    for (const key of CONFIG_KEYS) expect(mayProposeConfig(key, admin)).toBe(true);
  });

  it("never lets a checker or a non-maker propose", () => {
    for (const role of ["APPROVING_AUTHORITY", "AUDITOR", "REGISTRAR", "APPLICANT"] as const)
      for (const key of CONFIG_KEYS)
        expect(mayProposeConfig(key, capabilitiesFor([role]))).toBe(false);
  });

  it("is decided by capabilities, so a matrix edit applies", () => {
    const granted: Capability[] = ["config.edit", "payments.manage"];
    expect(mayProposeConfig("fees", granted)).toBe(true);
    expect(mayProposeConfig("fees", ["payments.manage"])).toBe(false);
    for (const key of CONFIG_KEYS) expect(CONFIG_MAKER_SCOPE[key].length).toBeGreaterThan(0);
  });
});
