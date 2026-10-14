"use client";

import { Mail, Smartphone } from "@/components/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { updatePhoneSchema } from "@rebp/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldControl } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useActionForm } from "@/hooks/use-action-form";
import { updatePhoneAction } from "@/server/actions/security";
import { useStepUp } from "./step-up";

interface ContactCardProps {
  email: { value: string; verified: boolean };
  phone: { value: string | null; verified: boolean };
}

export function ContactCard({ email, phone }: ContactCardProps) {
  const t = useTranslations();
  const rows = [
    {
      icon: Mail,
      label: t("security.contact.email"),
      value: email.value,
      verified: email.verified,
      action: null,
    },
    {
      icon: Smartphone,
      label: t("security.contact.phone"),
      value: phone.value ?? t("common.notSet"),
      verified: phone.verified,
      action: <ChangePhoneDialog />,
    },
  ];
  return (
    <Card id="contact" className="scroll-mt-20">
      <CardHeader>
        <CardTitle>{t("security.contact.title")}</CardTitle>
        <CardDescription>{t("security.contact.description")}</CardDescription>
      </CardHeader>
      <ul className="flex flex-col divide-y rounded-xl border">
        {rows.map(({ icon: Icon, label, value, verified, action }) => (
          <li key={label} className="flex flex-wrap items-center gap-3 p-4">
            <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-xs font-semibold text-muted-foreground">{label}</span>
              <span className="truncate font-medium">{value}</span>
            </div>
            {verified ? (
              <Badge variant="success">{t("common.verified")}</Badge>
            ) : (
              <Button asChild variant="link" size="sm">
                <Link href="/verify">{t("security.contact.verifyNow")}</Link>
              </Button>
            )}
            {action}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ChangePhoneDialog() {
  const t = useTranslations("security.contact");
  const router = useRouter();
  const stepUp = useStepUp();
  const [open, setOpen] = useState(false);
  const { form, submit, pending } = useActionForm({
    schema: updatePhoneSchema,
    defaultValues: { phone: "" },
    action: (values) => stepUp(() => updatePhoneAction(values)),
    onSuccess: () => {
      toast.success(t("phoneChanged"));
      setOpen(false);
      router.push("/verify");
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {t("changePhone")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("newPhone")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <Field label={t("newPhone")} error={form.formState.errors.phone?.message}>
            <FieldControl>
              <Input type="tel" autoComplete="tel" inputMode="tel" {...form.register("phone")} />
            </FieldControl>
          </Field>
          <DialogFooter>
            <Button type="submit" loading={pending}>
              {t("changePhone")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
