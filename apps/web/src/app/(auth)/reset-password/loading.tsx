import { AuthSkeleton } from "@/components/auth/auth-skeleton";

/** This auth form while it loads, in its own shape. */
export default function ResetPasswordLoading() {
  return <AuthSkeleton icon fields={1} code />;
}
