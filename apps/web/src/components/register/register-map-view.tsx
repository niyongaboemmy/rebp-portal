"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type { PublicEntry } from "@/lib/registry";
import type { DistrictGroup } from "./register-map";
import { RegisterSkeleton } from "./register-skeleton";

function MapLoading() {
  const t = useTranslations("common");
  return <RegisterSkeleton label={t("loading")} />;
}

// The map engine (WebGL, ~250 kB) loads only on the map view, in the browser.
const RegisterMap = dynamic(() => import("./register-map").then((m) => m.RegisterMap), {
  ssr: false,
  loading: () => <MapLoading />,
});

export function RegisterMapView(props: {
  groups: DistrictGroup[];
  districts: { code: string; name: string }[];
  selectedCode?: string;
  children?: React.ReactNode;
  list?: React.ReactNode;
  spot?: PublicEntry;
}) {
  return <RegisterMap {...props} />;
}
