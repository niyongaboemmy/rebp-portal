"use client";

import { useRouter } from "next/navigation";
import { RegistryPreviewProvider } from "@/components/registry/registry-preview";

/**
 * The registry preview for pages outside the map (verify): suggestions open the large preview,
 * and its "Show on map" opens the register map filtered to that licence and pinned there.
 */
export function VerifyPreviewProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <RegistryPreviewProvider
      // The map filtered to this licence, with it pinned in its district.
      onLocate={(entry) => {
        const no = encodeURIComponent(entry.licenceNo);
        router.push(`/register?q=${no}&spot=${no}` as never);
      }}
    >
      {children}
    </RegistryPreviewProvider>
  );
}
