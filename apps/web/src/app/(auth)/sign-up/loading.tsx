import { AuthSkeleton } from "@/components/auth/auth-skeleton";

/** This auth form while it loads, in its own shape. */
export default function SignUpLoading() {
  return <AuthSkeleton google segmented fields={3} pairs />;
}
