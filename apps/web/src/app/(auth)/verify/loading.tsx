import { AuthSkeleton } from "@/components/auth/auth-skeleton";

/** This auth form while it loads, in its own shape. */
export default function VerifyLoading() {
  return <AuthSkeleton icon code />;
}
