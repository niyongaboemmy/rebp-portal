import "server-only";
import { db } from "../db";

/** Postgres sequences created in the licensing_domain migration. Values never repeat, even on rollback. */
export type SequenceName =
  | "application_ref_seq"
  | "registrant_person_seq"
  | "registrant_firm_seq"
  | "licence_seq"
  | "receipt_seq"
  | "letter_seq";

type Client = Pick<typeof db, "$queryRawUnsafe">;

export async function nextSequence(name: SequenceName, client: Client = db): Promise<number> {
  // The name comes from a closed union, never from user input.
  const rows = await client.$queryRawUnsafe<Array<{ value: bigint }>>(
    `SELECT nextval('${name}') AS value`,
  );
  return Number(rows[0]!.value);
}
