-- FR-M-009: the approver may override the derived practice arrangement.
-- FR-M-017: corrections are new decision records linked to the one they correct, with a reason.
ALTER TABLE "Decision" ADD COLUMN "practiceArrangement" TEXT,
ADD COLUMN "correctionReason" TEXT;

CREATE INDEX "Decision_correctsId_idx" ON "Decision"("correctsId");

-- FR-M-017: decisions are immutable once signed. Reject UPDATE and DELETE regardless of the DB
-- role (modelled on the AuditEvent trigger, ADR-007). TRUNCATE is left alone so test resets work;
-- application code never truncates.
CREATE OR REPLACE FUNCTION decision_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Decision is immutable (% blocked); record a correcting decision instead', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER decision_no_update
  BEFORE UPDATE OR DELETE ON "Decision"
  FOR EACH ROW EXECUTE FUNCTION decision_block_mutation();
