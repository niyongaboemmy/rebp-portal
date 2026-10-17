"use server";

import { z } from "zod";
import { CV_SECTIONS, sectionBSchema } from "@rebp/contracts";
import { authorizeAction, authorizeSelf } from "../access/authorize";
import { AppError } from "../errors";
import { runAction } from "../action";
import { removeProfileDocument } from "../profile/documents";
import { saveCvSection } from "../profile/cv";
import { keepsProfile, saveProfile } from "../profile/profile";
import { getRequestContext } from "../request-context";

/**
 * Profile entry point (UX-010). Thin: validate with the Section B contract, authorise, save.
 * Every person keeps a profile, staff included: it is self-service, not an applicant capability.
 * Autosaved from the profile page, like a wizard section.
 */
export async function saveProfileAction(input: unknown) {
  return runAction(async () => {
    const { user } = await authorizeSelf();
    if (!keepsProfile(user)) throw new AppError("forbidden");
    const data = sectionBSchema.parse(input);
    return saveProfile(user, data, await getRequestContext());
  });
}

/** Removes one of the person's profile documents (UX-010). */
export async function removeProfileDocumentAction(id: string) {
  return runAction(async () => {
    const { user } = await authorizeSelf();
    if (!keepsProfile(user)) throw new AppError("forbidden");
    await removeProfileDocument(user, z.uuid().parse(id), await getRequestContext());
    return null;
  });
}

/** Saves one section of the applicant's CV (UX-018); autosaved from the CV page. */
export async function saveCvAction(section: unknown, input: unknown) {
  return runAction(async () => {
    const { user } = await authorizeAction("application.edit", { requireMfa: "auto" });
    const key = z.enum(CV_SECTIONS).parse(section);
    return saveCvSection(user, key, input, await getRequestContext());
  });
}
