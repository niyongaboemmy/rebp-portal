"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type Path,
  type UseFormReturn,
} from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { useErrorMessage } from "./use-error-message";

interface UseActionFormOptions<TSchema extends z.ZodType<FieldValues, FieldValues>, TData> {
  schema: TSchema;
  defaultValues: DefaultValues<z.input<TSchema>>;
  action: (values: z.input<TSchema>) => Promise<ActionResult<TData>>;
  onSuccess?: (
    data: TData,
    form: UseFormReturn<z.input<TSchema>, unknown, z.output<TSchema>>,
  ) => void | Promise<void>;
  /** Return true to mark the error as handled (skips the default toast). */
  onError?: (result: Extract<ActionResult<TData>, { ok: false }>) => boolean | void;
  /**
   * When to validate. Default "onSubmit": errors appear after the first submit, then update live
   * as the user types. Blur validation of empty fields made messages pop in under the pointer and
   * shift buttons mid-click; long wizard forms can opt into "onTouched".
   */
  mode?: "onSubmit" | "onTouched" | "onBlur";
}

/**
 * React Hook Form + Zod on the client, a server action on submit. Server field errors are mapped
 * back onto the form; other errors are shown as a toast. Client and server share one schema.
 */
export function useActionForm<TSchema extends z.ZodType<FieldValues, FieldValues>, TData>({
  schema,
  defaultValues,
  action,
  onSuccess,
  onError,
  mode = "onSubmit",
}: UseActionFormOptions<TSchema, TData>) {
  const [pending, startTransition] = useTransition();
  const errorMessage = useErrorMessage();
  const form = useForm<z.input<TSchema>, unknown, z.output<TSchema>>({
    resolver: zodResolver(schema as never),
    defaultValues,
    mode,
    reValidateMode: "onChange",
  });

  const submit = form.handleSubmit(
    () =>
      new Promise<void>((resolve) => {
        startTransition(async () => {
          const result = await action(form.getValues());
          if (result.ok) {
            await onSuccess?.(result.data, form);
          } else {
            for (const [field, key] of Object.entries(result.fieldErrors ?? {})) {
              form.setError(field as Path<z.input<TSchema>>, { type: "server", message: key });
            }
            const handled = onError?.(result);
            if (!handled && !result.fieldErrors)
              toast.error(errorMessage(result.error, result.meta));
          }
          resolve();
        });
      }),
  );

  return { form, submit, pending: pending || form.formState.isSubmitting };
}
