import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { appEnv, isDevMode, resetEnvCache } from "@/server/env";
import { resetDatabase } from "@/test/db";
import { devCodeFor, sendEmail, sendSms } from "../index";

const original = process.env.APP_ENV;

beforeEach(async () => {
  await resetDatabase();
});

afterEach(() => {
  process.env.APP_ENV = original;
  resetEnvCache();
});

describe("dev-mode OTP simulation", () => {
  it("keeps and returns the latest code per recipient and template in dev mode", async () => {
    expect(isDevMode()).toBe(true);
    await sendEmail("a@x.rw", "emailVerify", { code: "111111", name: "A" });
    await sendEmail("a@x.rw", "emailVerify", { code: "222222", name: "A" });
    await sendSms("+250788000001", "phoneVerify", { code: "333333" });
    expect(await devCodeFor("a@x.rw", "emailVerify")).toBe("222222");
    expect(await devCodeFor("+250788000001", "phoneVerify")).toBe("333333");
    expect(await devCodeFor("a@x.rw", "passwordReset")).toBeNull();
    expect(await devCodeFor(null, "emailVerify")).toBeNull();
  });

  it("never stores or returns codes outside dev mode", async () => {
    process.env.APP_ENV = "staging";
    resetEnvCache();
    expect(appEnv()).toBe("staging");
    await sendEmail("b@x.rw", "passwordReset", { code: "444444", name: "B" });
    const log = await db.notificationLog.findFirstOrThrow({ where: { recipient: "b@x.rw" } });
    expect(log.devCode).toBeNull();
    expect(log.body).toBeNull();
    expect(await devCodeFor("b@x.rw", "passwordReset")).toBeNull();
  });
});
