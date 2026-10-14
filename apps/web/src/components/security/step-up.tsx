"use client";

import { useTranslations } from "next-intl";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { reauthSchema } from "@rebp/contracts";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldControl } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { useActionForm } from "@/hooks/use-action-form";
import type { ActionResult } from "@/lib/action-result";
import { reauthAction } from "@/server/actions/security";

type Runner = <T>(action: () => Promise<ActionResult<T>>) => Promise<ActionResult<T>>;

const StepUpContext = createContext<Runner | null>(null);

/**
 * SEC-005 step-up. Wrap sensitive actions with `useStepUp()`: when the server answers
 * `reauthRequired`, the user confirms their password and the action is retried automatically.
 */
export function StepUpProvider({
  children,
  hasPassword,
}: {
  children: React.ReactNode;
  hasPassword: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pending = useRef<{ retry: () => void; cancel: () => void } | null>(null);

  const run = useCallback<Runner>(async (action) => {
    const result = await action();
    if (result.ok || result.error !== "errors.reauthRequired") return result;
    return new Promise((resolve) => {
      pending.current = {
        retry: () => void action().then(resolve),
        cancel: () => resolve(result),
      };
      setOpen(true);
    });
  }, []);

  const close = (confirmed: boolean) => {
    setOpen(false);
    const current = pending.current;
    pending.current = null;
    if (confirmed) current?.retry();
    else current?.cancel();
  };

  return (
    <StepUpContext.Provider value={run}>
      {children}
      <ReauthDialog open={open} hasPassword={hasPassword} onDone={close} />
    </StepUpContext.Provider>
  );
}

export function useStepUp(): Runner {
  const ctx = useContext(StepUpContext);
  if (!ctx) throw new Error("useStepUp must be used inside <StepUpProvider>");
  return ctx;
}

function ReauthDialog({
  open,
  hasPassword,
  onDone,
}: {
  open: boolean;
  hasPassword: boolean;
  onDone: (confirmed: boolean) => void;
}) {
  const t = useTranslations("security.reauth");
  const { form, submit, pending } = useActionForm({
    schema: reauthSchema,
    defaultValues: { password: "" },
    action: reauthAction,
    onSuccess: () => {
      form.reset();
      onDone(true);
    },
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onDone(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        {hasPassword ? (
          <form onSubmit={submit} noValidate className="flex flex-col gap-5">
            <Field label={t("password")} error={form.formState.errors.password?.message}>
              <FieldControl>
                <PasswordInput
                  autoComplete="current-password"
                  autoFocus
                  {...form.register("password")}
                />
              </FieldControl>
            </Field>
            <DialogFooter>
              <Button type="submit" loading={pending}>
                {t("submit")}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <Alert variant="info">{t("googleHint")}</Alert>
        )}
      </DialogContent>
    </Dialog>
  );
}
