"use server";

import { revalidatePath } from "next/cache";
import { matrixChangesSchema, setUserStatusSchema, updateUserRolesSchema } from "@rebp/contracts";
import type { z } from "zod";
import { runAction } from "../action";
import { authorizeAction } from "../access/authorize";
import { resetMatrix, saveMatrixChanges } from "../access/matrix";
import { setUserDisabled, updateUserRoles } from "../access/users";
import { getRequestContext } from "../request-context";

const ACCESS_PATH = "/backoffice/access";

export async function updateUserRolesAction(input: z.input<typeof updateUserRolesSchema>) {
  return runAction(async () => {
    const { user } = await authorizeAction("users.manage", { stepUp: true });
    const result = await updateUserRoles(user, input, await getRequestContext());
    revalidatePath(ACCESS_PATH);
    return result;
  });
}

export async function setUserStatusAction(input: z.input<typeof setUserStatusSchema>) {
  return runAction(async () => {
    const { user } = await authorizeAction("users.manage", { stepUp: true });
    const result = await setUserDisabled(user, input, await getRequestContext());
    revalidatePath(ACCESS_PATH);
    return result;
  });
}

export async function saveMatrixAction(input: z.input<typeof matrixChangesSchema>) {
  return runAction(async () => {
    const { user } = await authorizeAction("roles.manage", { stepUp: true });
    const result = await saveMatrixChanges(user, input, await getRequestContext());
    revalidatePath("/", "layout");
    return result;
  });
}

export async function resetMatrixAction() {
  return runAction(async () => {
    const { user } = await authorizeAction("roles.manage", { stepUp: true });
    const result = await resetMatrix(user, await getRequestContext());
    revalidatePath("/", "layout");
    return result;
  });
}
