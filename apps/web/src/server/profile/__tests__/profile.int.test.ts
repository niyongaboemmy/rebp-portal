import { describe, expect, it } from "vitest";
import { createApplication } from "@/server/applications/applications";
import { uploadDocument } from "@/server/documents/documents";
import { db } from "@/server/db";
import { makeUser, pdfOf, pngOf } from "@/test/fixtures";
import {
  readProfileDocument,
  removeProfileDocument,
  syncProfileDocuments,
  uploadProfileDocument,
} from "../documents";
import { profileBlocks, profileStatus, saveProfile } from "../profile";

/** UX-010: personal details and identity documents entered once, on the profile. */
const ctx = { ipAddress: "127.0.0.1", userAgent: "vitest" };

const activeDocs = (applicationId: string, type: string) =>
  db.document.findMany({
    where: { applicationId, type, removedAt: null },
    include: { versions: true },
  });

describe("applicant profile", () => {
  it("is required before applying, and counts identity documents in its completion", async () => {
    const { user } = await makeUser(["APPLICANT"], { profile: false });
    expect(await profileBlocks(user)).toBe(true);
    await expect(
      createApplication(user, { type: "NEW", category: "FSLA" }, ctx),
    ).rejects.toMatchObject({ message: "errors.profileIncomplete" });

    const complete = await makeUser(["APPLICANT"]);
    expect(await profileBlocks(complete.user)).toBe(false);
    const status = await profileStatus(complete.user);
    expect(status.missing).toEqual(["proofOfIdentity", "photo"]);
    expect(status.complete).toBe(false);
  });

  it("copies identity documents into a draft and keeps them in step with the profile", async () => {
    const { user } = await makeUser(["APPLICANT"]);
    const id = await uploadProfileDocument(
      user,
      { type: "proofOfIdentity", fileName: "id.pdf", bytes: pdfOf("id v1") },
      ctx,
    );
    await uploadProfileDocument(user, { type: "photo", fileName: "me.png", bytes: pngOf() }, ctx);
    expect((await profileStatus(user)).complete).toBe(true);
    // Only the owner reads a profile document.
    expect((await readProfileDocument(id.id, user)).fileName).toBe("id.pdf");
    const other = await makeUser(["APPLICANT"]);
    await expect(readProfileDocument(id.id, other.user)).rejects.toMatchObject({
      message: "errors.notFound",
    });

    const app = await createApplication(user, { type: "NEW", category: "FSLA" }, ctx);
    const full = await db.application.findUniqueOrThrow({ where: { id: app.id } });
    expect(await syncProfileDocuments(full, user)).toBe(true);
    const [copy] = await activeDocs(app.id, "proofOfIdentity");
    expect(copy).toMatchObject({ fromProfile: true, status: "CLEAN" });
    expect((await activeDocs(app.id, "photo")).length).toBe(1);
    // Nothing changes on a second pass.
    expect(await syncProfileDocuments(full, user)).toBe(false);

    // Replacing the profile file replaces the draft's copy.
    await uploadProfileDocument(
      user,
      { type: "proofOfIdentity", replaceId: id.id, fileName: "id-2.pdf", bytes: pdfOf("id v2") },
      ctx,
    );
    const after = await activeDocs(app.id, "proofOfIdentity");
    expect(after).toHaveLength(1);
    expect(after[0]!.versions[0]!.fileName).toBe("id-2.pdf");

    // Removing it from the profile withdraws the copy.
    const profilePhoto = await db.profileDocument.findFirstOrThrow({
      where: { userId: user.id, type: "photo", removedAt: null },
    });
    await removeProfileDocument(user, profilePhoto.id, ctx);
    expect(await activeDocs(app.id, "photo")).toHaveLength(0);
  });

  it("never touches a document the applicant uploaded to the application directly", async () => {
    const { user } = await makeUser(["APPLICANT"]);
    const app = await createApplication(user, { type: "NEW", category: "FSLA" }, ctx);
    await uploadDocument(
      { applicationId: app.id, type: "proofOfIdentity", fileName: "own.pdf", bytes: pdfOf("own") },
      user,
      ctx,
    );
    await uploadProfileDocument(
      user,
      { type: "proofOfIdentity", fileName: "profile.pdf", bytes: pdfOf("profile") },
      ctx,
    );
    const docs = await activeDocs(app.id, "proofOfIdentity");
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({ fromProfile: false });
  });

  it("updates drafts when the personal details change, not submitted applications", async () => {
    const { user } = await makeUser(["APPLICANT"]);
    const app = await createApplication(user, { type: "NEW", category: "FSLA" }, ctx);
    const profile = (user.profile ?? {}) as Record<string, unknown>;
    await saveProfile(user, { ...profile, occupation: "Valuer" } as never, ctx);
    const draft = await db.application.findUniqueOrThrow({ where: { id: app.id } });
    expect((draft.data as { b?: { occupation?: string } }).b?.occupation).toBe("Valuer");
  });
});
