"use client";

import {
  ArrowRight,
  Globe2,
  Layers,
  ListFilter,
  LocateFixed,
  MapIcon,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  RotateCcw,
  Undo2,
  X,
} from "@/components/icons";
import "maplibre-gl/dist/maplibre-gl.css";
import type {
  GeoJSONSource,
  LayerSpecification,
  Map as MapLibreMap,
  Marker,
  StyleSpecification,
} from "maplibre-gl";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RegistryPreviewProvider,
  useRegistryPreview,
} from "@/components/registry/registry-preview";
import { DISTRICT_CENTRES, RWANDA_BOUNDS } from "@/config/districts-geo";
import { initials, type PublicEntry } from "@/lib/registry";
import { cn } from "@/lib/utils";

export interface DistrictGroup {
  code: string;
  name: string;
  total: number;
  valid: number;
  firms: number;
  preview: { licenceNo: string; displayName: string; category: string; status: string }[];
  /** Link to this district in the list view (filters kept). */
  listHref: string;
}

type Basemap = "map" | "satellite";
type LngLat = [number, number];

/** Free basemaps: OpenFreeMap vector styles (OSM data) and EOX Sentinel-2 cloudless 2016 (CC BY 4.0). */
const STREET_STYLE = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};
const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    eox: {
      type: "raster",
      tiles: ["https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg"],
      tileSize: 256,
      maxzoom: 15,
      attribution:
        '<a href="https://s2maps.eu" target="_blank" rel="noopener">Sentinel-2 cloudless</a> by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2016)',
    },
  },
  layers: [{ id: "eox", type: "raster", source: "eox" }],
};

const STATUS_DOT: Record<string, string> = {
  ACTIVE: "bg-success",
  SUSPENDED: "bg-warning",
  REVOKED: "bg-destructive",
  EXPIRED: "bg-foreground/35",
};

/** Great-circle distance in kilometres. */
function haversineKm([lng1, lat1]: LngLat, [lng2, lat2]: LngLat) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const pathKm = (points: LngLat[]) =>
  points.slice(1).reduce((sum, p, i) => sum + haversineKm(points[i]!, p), 0);

const formatKm = (km: number) =>
  km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(km < 10 ? 2 : 1)} km`;

const line = (coordinates: LngLat[]) => ({
  type: "Feature" as const,
  properties: {},
  geometry: { type: "LineString" as const, coordinates },
});
const point = (coordinates: LngLat) => ({
  type: "Feature" as const,
  properties: {},
  geometry: { type: "Point" as const, coordinates },
});
const collection = (features: (ReturnType<typeof line> | ReturnType<typeof point>)[]) => ({
  type: "FeatureCollection" as const,
  features,
});

/** Overlay layers, re-added after every style swap (basemap or theme). */
const OVERLAYS: { source: string; layers: LayerSpecification[] }[] = [
  {
    source: "me-link",
    layers: [
      {
        id: "me-link",
        type: "line",
        source: "me-link",
        layout: { "line-cap": "round" },
        paint: { "line-color": "#38bdf8", "line-width": 2.5, "line-dasharray": [1, 2] },
      },
    ],
  },
  {
    source: "measure-live",
    layers: [
      {
        id: "measure-live",
        type: "line",
        source: "measure-live",
        paint: { "line-color": "#f5c542", "line-width": 2, "line-opacity": 0.7 },
      },
    ],
  },
  {
    source: "measure",
    layers: [
      {
        id: "measure-line",
        type: "line",
        source: "measure",
        filter: ["==", "$type", "LineString"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#f5c542", "line-width": 3, "line-dasharray": [2, 1.5] },
      },
      {
        id: "measure-points",
        type: "circle",
        source: "measure",
        filter: ["==", "$type", "Point"],
        paint: {
          "circle-radius": 5,
          "circle-color": "#ffffff",
          "circle-stroke-color": "#2f5bea",
          "circle-stroke-width": 2.5,
        },
      },
    ],
  },
];

function setOverlay(map: MapLibreMap, id: string, data: ReturnType<typeof collection>) {
  const source = map.getSource(id) as GeoJSONSource | undefined;
  if (source) return void source.setData(data);
  const spec = OVERLAYS.find((o) => o.source === id);
  if (!spec || !map.isStyleLoaded()) return;
  map.addSource(id, { type: "geojson", data });
  for (const layer of spec.layers) map.addLayer(layer);
}

/**
 * FR-REG-002 map view of the public register. Entries are grouped per district (never an
 * address, FR-REG-003) and shown as bubbles sized by count, ringed by their share of valid
 * licences and labelled with the district. Bubbles drop in one after another; hovering shows a
 * tip, hovering a card in the list lights its district up, and choosing one dims the rest.
 * Tools: street map / satellite, measure distance (live rubber band, undo, Esc to finish), my
 * location with a route line to the chosen district, compass (reset north), tilt to 3D, reset to
 * Rwanda, fullscreen and labels on/off. Camera moves honour prefers-reduced-motion.
 */
export function RegisterMap({
  groups,
  districts,
  selectedCode,
  children,
  list,
  spot,
}: {
  groups: DistrictGroup[];
  /** Every district (code, name), so the map can fly to one even when it has no entries. */
  districts: { code: string; name: string }[];
  selectedCode?: string;
  /** An entry to locate on arrival ("Show on map" from another page): fly there and pin it. */
  spot?: PublicEntry;
  /** Floating panel (title, search, filters) shown over the top-left of the map. */
  children?: React.ReactNode;
  /** List view: the paginated results, floating over the map (the map stays). */
  list?: React.ReactNode;
}) {
  const locate = useRef<(entry: PublicEntry) => void>(undefined);
  return (
    <RegistryPreviewProvider onLocate={(entry) => locate.current?.(entry)}>
      <MapInner
        groups={groups}
        districts={districts}
        selectedCode={selectedCode}
        list={list}
        spot={spot}
        locateRef={locate}
      >
        {children}
      </MapInner>
    </RegistryPreviewProvider>
  );
}

function MapInner({
  groups,
  districts,
  selectedCode,
  children,
  list,
  spot,
  locateRef,
}: {
  groups: DistrictGroup[];
  districts: { code: string; name: string }[];
  selectedCode?: string;
  spot?: PublicEntry;
  children?: React.ReactNode;
  list?: React.ReactNode;
  locateRef: React.RefObject<((entry: PublicEntry) => void) | undefined>;
}) {
  const t = useTranslations("registerMap");
  const preview = useRegistryPreview();
  const { resolvedTheme } = useTheme();
  const container = useRef<HTMLDivElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const asideRef = useRef<HTMLElement>(null);
  const needle = useRef<SVGSVGElement>(null);
  const liveReadout = useRef<HTMLSpanElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markers = useRef(new Map<string, Marker>());
  const extras = useRef<{ me?: Marker; link?: Marker; total?: Marker }>({});
  const hintTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [ready, setReady] = useState(false);
  const [basemap, setBasemap] = useState<Basemap>("map");
  const [labels, setLabels] = useState(true);
  const [tilted, setTilted] = useState(false);
  const [rotated, setRotated] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const [points, setPoints] = useState<LngLat[]>([]);
  const [me, setMe] = useState<LngLat | null>(null);
  const [locating, setLocating] = useState(false);
  const [selected, setSelected] = useState<string | undefined>(selectedCode);
  const [hot, setHot] = useState<string>();
  const [interactive, setInteractive] = useState(true);
  const [hint, setHint] = useState(false);
  // The map is fixed under the header (and pilot banner): the page itself never scrolls.
  const [top, setTop] = useState<number>();
  const [expanded, setExpanded] = useState(false);
  // Leaving browser full screen (Esc, system gesture) collapses the map too; Esc also
  // collapses the iPhone fallback.
  useEffect(() => {
    if (!expanded) return;
    const onChange = () => {
      if (!document.fullscreenElement) setExpanded(false);
    };
    const onKey = (event: KeyboardEvent) => {
      // Esc closes an open menu or dialog first; only a bare Esc collapses the map.
      const layerOpen = document.querySelector('[role="dialog"], [role="menu"], [role="listbox"]');
      if (
        event.key === "Escape" &&
        !document.fullscreenElement &&
        !layerOpen &&
        !event.defaultPrevented
      )
        setExpanded(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    window.addEventListener("keydown", onKey);
    const id = requestAnimationFrame(() => mapRef.current?.resize());
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      window.removeEventListener("keydown", onKey);
      cancelAnimationFrame(id);
      requestAnimationFrame(() => mapRef.current?.resize());
    };
  }, [expanded]);
  // Opening the list ends full screen: the list is a page view, not a map overlay.
  const listOpen = Boolean(list);
  useEffect(() => {
    if (!listOpen) return;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    const id = requestAnimationFrame(() => setExpanded(false));
    return () => cancelAnimationFrame(id);
  }, [listOpen]);
  useEffect(() => {
    const fit = () => {
      const header = document.querySelector("header");
      setTop(header ? Math.round(header.getBoundingClientRect().bottom) : 64);
      requestAnimationFrame(() => mapRef.current?.resize());
    };
    fit();
    const html = document.documentElement;
    const previous = html.style.overflow;
    html.style.overflow = "hidden";
    window.addEventListener("resize", fit);
    const observer = new ResizeObserver(fit);
    const banner = document.querySelector("header")?.parentElement;
    if (banner) observer.observe(banner);
    return () => {
      html.style.overflow = previous;
      window.removeEventListener("resize", fit);
      observer.disconnect();
    };
  }, []);

  // Interact mode (default on): turning it off locks panning, zooming and rotating so the
  // panels can be used without nudging the map. Buttons always work.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const handlers = [
      map.dragPan,
      map.scrollZoom,
      map.boxZoom,
      map.dragRotate,
      map.keyboard,
      map.doubleClickZoom,
      map.touchZoomRotate,
      map.touchPitch,
    ];
    for (const h of handlers) {
      if (interactive) h.enable();
      else h.disable();
    }
  }, [interactive, ready]);

  // Gestures while locked show a short hint instead of silently doing nothing.
  const nudge = () => {
    if (interactive) return;
    setHint(true);
    clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(false), 1800);
  };
  useEffect(() => () => clearTimeout(hintTimer.current), []);

  const placed = useMemo(
    () =>
      groups
        .map((g) => ({ ...g, centre: DISTRICT_CENTRES[g.name] }))
        .filter((g): g is DistrictGroup & { centre: LngLat } => Boolean(g.centre)),
    [groups],
  );
  const max = Math.max(1, ...placed.map((g) => g.total));
  const current = placed.find((g) => g.code === selected);
  // In list view the list already shows the district's entries: the bubble stays highlighted,
  // but the district card (which would cover the list) is not shown.
  const panelDistrict = list ? undefined : current;
  const dark = resolvedTheme === "dark";
  const styleFor = useCallback(
    (b: Basemap) =>
      b === "satellite" ? SATELLITE_STYLE : dark ? STREET_STYLE.dark : STREET_STYLE.light,
    [dark],
  );

  // Overlays: measuring path, and the route line from "my location" to the chosen district.
  const redraw = useCallback(
    (map: MapLibreMap) => {
      setOverlay(
        map,
        "measure",
        collection([...(points.length > 1 ? [line(points)] : []), ...points.map(point)]),
      );
      setOverlay(map, "measure-live", collection([]));
      setOverlay(map, "me-link", collection(me && current ? [line([me, current.centre])] : []));
    },
    [points, me, current],
  );
  const redrawRef = useRef(redraw);
  useEffect(() => {
    redrawRef.current = redraw;
    const map = mapRef.current;
    if (map && ready) redraw(map);
  }, [redraw, ready]);

  // Create the map once: it opens wide, then glides in to Rwanda (see the framing effect).
  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | undefined;
    void (async () => {
      const maplibre = await import("maplibre-gl");
      if (cancelled || !container.current) return;
      maplibre.setWorkerUrl("/vendor/maplibre-gl-worker.mjs");
      map = new maplibre.Map({
        container: container.current,
        style: styleFor("map"),
        center: [29.9, -1.95],
        zoom: 6,
        // No maxBounds: framing Rwanda beside the list or panels shifts the camera far off-centre.
        minZoom: 5,
        attributionControl: { compact: true },
      });
      map.addControl(new maplibre.ScaleControl({ unit: "metric" }), "bottom-right");
      const onRotate = () => {
        const bearing = map!.getBearing();
        if (needle.current) needle.current.style.transform = `rotate(${-bearing}deg)`;
        setRotated(Math.abs(bearing) > 0.5 || map!.getPitch() > 0.5);
      };
      map.on("zoom", () => declutterRef.current());
      map.on("rotate", onRotate);
      map.on("pitch", onRotate);
      map.on("load", () => !cancelled && setReady(true));
      mapRef.current = map;
    })();
    const current = markers.current;
    const added = extras.current;
    return () => {
      cancelled = true;
      current.forEach((m) => m.remove());
      current.clear();
      Object.values(added).forEach((m) => m?.remove());
      map?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Basemap / theme changes: swap the style, then restore the overlays.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setStyle(styleFor(basemap));
    map.once("style.load", () => redrawRef.current(map));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basemap, dark, ready]);

  // Selection, list hover and labels restyle the existing bubbles (no re-drop animation).
  const setMarkerState = useCallback(() => {
    markers.current.forEach((marker, code) => {
      const el = marker.getElement();
      el.dataset.selected = String(code === selected);
      el.dataset.hot = String(code === hot);
      el.dataset.labels = String(labels);
    });
    if (container.current) container.current.dataset.focus = String(Boolean(selected || hot));
  }, [selected, hot, labels]);
  const markerStateRef = useRef(setMarkerState);
  useEffect(() => {
    markerStateRef.current = setMarkerState;
    setMarkerState();
  }, [setMarkerState]);

  // Choosing a district (filter or URL) flies the map there, entries or not.
  const centreFor = useCallback(
    (code: string) => {
      const name = districts.find((d) => d.code === code)?.name;
      return name ? DISTRICT_CENTRES[name] : undefined;
    },
    [districts],
  );
  // Frame the part of the map the floating chrome (panel, list, nav, bar, district card) leaves.
  const framePadding = useCallback(() => {
    const box = shell.current?.getBoundingClientRect();
    const pad = { top: 24, right: 24, bottom: 24, left: 24 };
    if (!box) return pad;
    const rect = (el: Element | null | undefined) => {
      const r = el?.getBoundingClientRect();
      return r && r.width > 0 ? r : undefined;
    };
    const bar = rect(barRef.current);
    if (bar) pad.bottom = Math.max(pad.bottom, box.bottom - bar.top + 16);
    const nav = rect(navRef.current);
    if (nav && nav.width > nav.height) pad.top = Math.max(pad.top, nav.bottom - box.top + 12);
    else if (nav && nav.top - box.top < box.height / 2)
      pad.right = Math.max(pad.right, box.right - nav.left + 12);
    const listBox = rect(listRef.current);
    if (listBox && listBox.left - box.left > 280)
      pad.right = Math.max(pad.right, box.right - listBox.left + 24);
    const aside = rect(asideRef.current);
    if (aside && aside.width < box.width * 0.8)
      pad.right = Math.max(pad.right, box.right - aside.left + 24);
    else if (aside) pad.bottom = Math.max(pad.bottom, box.bottom - aside.top + 16);
    const panel = rect(panelRef.current);
    if (panel) {
      if (box.right - panel.right - pad.right > 300) pad.left = panel.right - box.left + 24;
      else pad.top = Math.max(pad.top, panel.bottom - box.top + 16);
    }
    if (box.width - pad.left - pad.right < 160) pad.left = pad.right = 24;
    if (box.height - pad.top - pad.bottom < 160) pad.top = pad.bottom = 24;
    return pad;
  }, []);
  const fitRwanda = useCallback(
    (extra?: { pitch?: number; bearing?: number; duration?: number }) =>
      mapRef.current?.fitBounds(RWANDA_BOUNDS, { padding: framePadding(), ...extra }),
    [framePadding],
  );

  // Select a district, then fly once the card (or phone sheet) has rendered and can be framed.
  const focusDistrict = useCallback(
    (code: string, centre: LngLat | undefined, zoomTo: number) => {
      setSelected(code);
      if (!centre) return;
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          mapRef.current?.flyTo({
            center: centre,
            zoom: zoomTo,
            speed: 0.9,
            padding: framePadding(),
          }),
        ),
      );
    },
    [framePadding],
  );
  const focusRef = useRef(focusDistrict);
  useEffect(() => {
    focusRef.current = focusDistrict;
  }, [focusDistrict]);

  // Neighbouring districts (Kigali's three) would overlap at country zoom: nudge their bubbles
  // apart in screen space, easing back to their true centres as the map zooms in.
  const declutter = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const items = [...markers.current.values()].map((marker) => ({
      marker,
      at: map.project(marker.getLngLat()),
      r: Number(marker.getElement().dataset.size ?? 40) / 2 + 18,
      dx: 0,
      dy: 0,
    }));
    for (let i = 0; i < items.length; i++)
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i]!;
        const b = items[j]!;
        const x = b.at.x - a.at.x;
        const y = b.at.y - a.at.y;
        const d = Math.hypot(x, y) || 0.01;
        const gap = a.r + b.r - d;
        if (gap <= 0) continue;
        const ux = d < 0.1 ? 1 : x / d;
        const uy = d < 0.1 ? 0 : y / d;
        a.dx -= (ux * gap) / 2;
        a.dy -= (uy * gap) / 2;
        b.dx += (ux * gap) / 2;
        b.dy += (uy * gap) / 2;
      }
    for (const item of items) item.marker.setOffset([item.dx, item.dy]);
  }, []);
  // Stable (no deps), so the map's zoom handler can hold it from creation.
  const declutterRef = useRef(declutter);

  // District bubbles (HTML markers, so they survive style swaps). Built from text nodes only.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let alive = true;
    void import("maplibre-gl").then((maplibre) => {
      if (!alive) return;
      markers.current.forEach((m) => m.remove());
      markers.current.clear();
      placed.forEach((g, i) => {
        const size = 34 + Math.round((g.total / max) * 30);
        const el = document.createElement("button");
        el.type = "button";
        el.className = "register-map-marker";
        el.dataset.size = String(size);
        el.style.setProperty("--i", String(i));
        el.style.setProperty("--valid", `${Math.round((g.valid / Math.max(1, g.total)) * 100)}%`);
        el.setAttribute("aria-label", t("districtAria", { district: g.name, count: g.total }));
        const bubble = document.createElement("span");
        bubble.className = "register-map-bubble";
        bubble.style.width = bubble.style.height = `${size}px`;
        for (const part of ["register-map-ring", "register-map-pulse"]) {
          const span = document.createElement("span");
          span.className = part;
          bubble.append(span);
        }
        const count = document.createElement("b");
        count.textContent = String(g.total);
        bubble.append(count);
        const label = document.createElement("span");
        label.className = "register-map-label";
        label.textContent = g.name;
        const tip = document.createElement("span");
        tip.className = "register-map-tip";
        tip.setAttribute("aria-hidden", "true");
        tip.textContent = t("tip", { valid: g.valid, firms: g.firms });
        el.append(bubble, label, tip);
        el.addEventListener("click", (event) => {
          event.stopPropagation();
          focusRef.current(g.code, g.centre, Math.max(map.getZoom(), 9.2));
        });
        markers.current.set(
          g.code,
          new maplibre.Marker({ element: el, anchor: "center" }).setLngLat(g.centre).addTo(map),
        );
      });
      markerStateRef.current();
      declutterRef.current();
    });
    return () => {
      alive = false;
    };
  }, [placed, max, ready, t]);

  // Measuring: clicks add points, the pointer drags a live segment, Backspace undoes, Esc ends.
  const pointsRef = useRef(points);
  useEffect(() => {
    pointsRef.current = points;
    if (liveReadout.current) liveReadout.current.textContent = "";
  }, [points]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const canvas = map.getCanvas();
    canvas.style.cursor = measuring ? "crosshair" : "";
    if (!measuring) return;
    const onClick = (event: { lngLat: { lng: number; lat: number } }) =>
      setPoints((p) => [...p, [event.lngLat.lng, event.lngLat.lat]]);
    let frame = 0;
    const onMove = (event: { lngLat: { lng: number; lat: number } }) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const last = pointsRef.current.at(-1);
        if (!last) return;
        const here: LngLat = [event.lngLat.lng, event.lngLat.lat];
        setOverlay(map, "measure-live", collection([line([last, here])]));
        if (liveReadout.current)
          liveReadout.current.textContent = `+${formatKm(haversineKm(last, here))}`;
      });
    };
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement | null)?.closest("input, textarea, select")) return;
      if (event.key === "Escape") setMeasuring(false);
      if (event.key === "Backspace") setPoints((p) => p.slice(0, -1));
    };
    map.on("click", onClick);
    map.on("mousemove", onMove);
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      map.off("click", onClick);
      map.off("mousemove", onMove);
      window.removeEventListener("keydown", onKey);
      setOverlay(map, "measure-live", collection([]));
    };
  }, [measuring, ready]);

  // Floating chips: the measured total at the last point, and the distance on the route line.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let alive = true;
    void import("maplibre-gl").then((maplibre) => {
      if (!alive) return;
      const chip = (key: "total" | "link", at: LngLat | null, text: string, tone: string) => {
        extras.current[key]?.remove();
        extras.current[key] = undefined;
        if (!at) return;
        // MapLibre positions the marker element with a transform; animate an inner span.
        const el = document.createElement("span");
        const inner = document.createElement("span");
        inner.className = `register-map-chip ${tone}`;
        inner.textContent = text;
        el.append(inner);
        extras.current[key] = new maplibre.Marker({
          element: el,
          anchor: "bottom",
          offset: [0, -10],
        })
          .setLngLat(at)
          .addTo(map);
      };
      const last = points.at(-1);
      chip("total", points.length > 1 && last ? last : null, formatKm(pathKm(points)), "is-sun");
      const mid: LngLat | null =
        me && current ? [(me[0] + current.centre[0]) / 2, (me[1] + current.centre[1]) / 2] : null;
      chip("link", mid, me && current ? formatKm(haversineKm(me, current.centre)) : "", "is-sky");
    });
    return () => {
      alive = false;
    };
  }, [points, me, current, ready]);

  const hasList = Boolean(list);
  const intro = useRef(true);
  // "Show on map" from the list: the entry to locate once the list has closed.
  const pendingLocate = useRef<PublicEntry | null>(null);
  // The entry pinned in its district card ("Located here").
  const [spotlight, setSpotlight] = useState<PublicEntry | undefined>(spot);
  // A `spot` from the URL (a chosen suggestion, or "Show on map" from another page) is located
  // once per licence, also when it changes on client navigation.
  const seenSpot = useRef<string | undefined>(undefined);
  const spotNo = spot?.licenceNo;
  useEffect(() => {
    if (!ready) return;
    // Wait a frame so the panel (filters may have just expanded) has its final size.
    const id = requestAnimationFrame(() => {
      if (spot?.district && spot.licenceNo !== seenSpot.current && !hasList) {
        seenSpot.current = spot.licenceNo;
        intro.current = false;
        setSpotlight(spot);
        focusDistrict(spot.district, centreFor(spot.district), 10.5);
        return;
      }
      const pending = pendingLocate.current;
      if (pending?.district && !hasList) {
        pendingLocate.current = null;
        intro.current = false;
        focusDistrict(pending.district, centreFor(pending.district), 10.5);
        return;
      }
      setSelected(selectedCode);
      const duration = intro.current ? 1800 : undefined;
      intro.current = false;
      if (selectedCode) focusDistrict(selectedCode, centreFor(selectedCode), 10);
      else fitRwanda({ duration });
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `spot` is followed by its number
  }, [selectedCode, ready, centreFor, focusDistrict, fitRwanda, hasList, spotNo]);

  // "Show on map": the list would cover the map, so it switches to the map view first (filters
  // kept), then flies to the entry's district, opens its card and spotlights the entry there.
  const router = useRouter();
  const locateEntry = useCallback(
    (entry: PublicEntry) => {
      if (!entry.district) return;
      setSpotlight(entry);
      if (hasList) {
        pendingLocate.current = entry;
        const params = new URLSearchParams(window.location.search);
        params.delete("view");
        params.delete("page");
        const query = params.toString();
        router.replace((query ? `/register?${query}` : "/register") as Route, { scroll: false });
        return;
      }
      focusDistrict(entry.district, centreFor(entry.district), 10.5);
    },
    [centreFor, focusDistrict, hasList, router],
  );

  useEffect(() => {
    locateRef.current = locateEntry;
  }, [locateRef, locateEntry]);

  // List ↔ map: hovering or focusing a card lights up its district bubble.
  const hover = (event: React.SyntheticEvent) => {
    const card = (event.target as HTMLElement).closest<HTMLElement>("[data-district]");
    setHot(card?.dataset.district || undefined);
  };

  const zoom = (by: number) =>
    mapRef.current?.easeTo({ zoom: (mapRef.current?.getZoom() ?? 8) + by });
  const reset = () => {
    setSelected(undefined);
    setSpotlight(undefined);
    fitRwanda({ pitch: 0, bearing: 0 });
    setTilted(false);
  };
  const north = () => {
    mapRef.current?.easeTo({ bearing: 0, pitch: 0, duration: 700 });
    setTilted(false);
  };
  const tilt = () => {
    const next = !tilted;
    setTilted(next);
    mapRef.current?.easeTo({ pitch: next ? 55 : 0, bearing: next ? -15 : 0, duration: 900 });
  };
  // Full screen covers the whole page (not just the map element), so menus, the preview dialog
  // and toasts, which render outside the map, keep working on top. Where the browser has no
  // Fullscreen API (iPhone), the map still expands over the header.
  const fullscreen = () => {
    const next = !expanded;
    setExpanded(next);
    const root = document.documentElement;
    if (next && !document.fullscreenElement && root.requestFullscreen)
      void root.requestFullscreen().catch(() => {});
    else if (!next && document.fullscreenElement) void document.exitFullscreen();
  };
  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        const here: LngLat = [coords.longitude, coords.latitude];
        setMe(here);
        mapRef.current?.flyTo({ center: here, zoom: 10, padding: framePadding() });
        void import("maplibre-gl").then((maplibre) => {
          if (!mapRef.current) return;
          extras.current.me?.remove();
          const el = document.createElement("span");
          el.className = "register-map-me";
          extras.current.me = new maplibre.Marker({ element: el })
            .setLngLat(here)
            .addTo(mapRef.current);
        });
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  };
  const toggleMeasure = () => {
    if (measuring) setPoints([]);
    setMeasuring(!measuring);
  };

  const toolButton =
    "inline-flex size-10 items-center justify-center rounded-full text-foreground/80 transition-[background-color,color,transform] outline-none hover:bg-foreground/[0.07] hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 active:scale-90 data-[on=true]:bg-primary data-[on=true]:text-primary-foreground";
  const glass =
    "bg-card/85 shadow-[0_8px_28px_-14px_oklch(0.3_0.12_264/0.45)] backdrop-blur-xl backdrop-saturate-150 dark:bg-[oklch(0.19_0.02_265/0.85)] dark:shadow-[0_10px_30px_-14px_rgb(0_0_0/0.8)]";
  const totalEntries = placed.reduce((sum, g) => sum + g.total, 0);
  const measured = pathKm(points);

  return (
    <div
      ref={shell}
      data-loop
      data-fullscreen-map
      data-expanded={expanded || undefined}
      style={{ top: expanded ? 0 : (top ?? 64) }}
      // Expanded: above the header (z-40) but under popups and dialogs (z-50).
      className={cn(
        "fixed inset-x-0 bottom-0 isolate overflow-hidden",
        expanded ? "z-[45]" : "z-30",
        "bg-surface-2 dark:bg-[oklch(0.16_0.015_265)]",
      )}
    >
      {/* Explicit size: MapLibre's stylesheet makes its container position: relative. */}
      <div
        ref={container}
        className="size-full"
        aria-label={t("label")}
        role="region"
        onWheel={nudge}
        onTouchMove={nudge}
      />
      {!ready && (
        <div aria-hidden className="absolute inset-0 grid place-items-center">
          <span className="size-16 animate-pulse-ring rounded-full text-primary" />
        </div>
      )}

      {/* Locked-map hint. */}
      <div
        aria-live="polite"
        className={cn(
          "pointer-events-none absolute inset-x-0 top-1/2 z-20 flex -translate-y-1/2 justify-center transition-[opacity,transform] duration-(--dur-3)",
          hint ? "opacity-100" : "invisible scale-95 opacity-0",
        )}
      >
        {hint && (
          <span className="rounded-full bg-foreground/80 px-4 py-2 text-sm font-semibold text-background backdrop-blur">
            {t("gestureHint")}
          </span>
        )}
      </div>

      {/* Overlays follow the page's content width (container-page), floating over the map. */}
      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="relative container-page h-full [&>*]:pointer-events-auto">
          {/* Floating panel: title, search, filters (from the page). */}
          {children && (
            <div
              ref={panelRef}
              className={cn(
                "absolute top-3 left-3 z-20 max-h-[calc(100%-6.5rem)] w-[min(25rem,calc(100%-1.5rem))] overflow-y-auto overscroll-contain rounded-3xl p-4 max-sm:right-3 max-sm:w-auto sm:top-4 sm:left-6 sm:p-5 lg:left-8 short:max-h-[calc(100%-5.5rem)]",
                list && "max-lg:hidden",
                panelDistrict && "max-sm:hidden",
                glass,
              )}
            >
              {children}
            </div>
          )}

          {/* List view: results float over the map (beside the filters from lg; below them on smaller screens). */}
          {list && (
            <section
              ref={listRef}
              aria-label={t("listLabel")}
              onPointerOver={hover}
              onFocus={hover}
              onPointerLeave={() => setHot(undefined)}
              className={cn(
                "@container absolute inset-x-3 top-3 bottom-3 z-20 flex animate-rise flex-col overflow-hidden rounded-3xl [animation-duration:var(--dur-3)] sm:inset-x-6 sm:top-4 sm:bottom-4 lg:right-8 lg:bottom-20 lg:left-[calc(25rem+3rem)]",
                glass,
              )}
            >
              <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">
                <div className="mb-4 lg:hidden">{children}</div>
                {list}
              </div>
            </section>
          )}

          {/* Navigation: a vertical capsule (top right; above the bottom bar on phones; a row on short screens). */}
          <div
            ref={navRef}
            className={cn(
              "absolute top-4 right-3 z-10 flex flex-col items-center gap-0.5 rounded-full p-1 max-sm:top-auto max-sm:bottom-[4.75rem] sm:right-6 lg:right-8 short:top-3 short:bottom-auto short:flex-row",
              list && "max-lg:hidden",
              glass,
            )}
          >
            <button
              type="button"
              onClick={() => zoom(1)}
              aria-label={t("zoomIn")}
              className={toolButton}
            >
              <Plus className="size-[1.1rem]" />
            </button>
            <button
              type="button"
              onClick={() => zoom(-1)}
              aria-label={t("zoomOut")}
              className={toolButton}
            >
              <Minus className="size-[1.1rem]" />
            </button>
            <span
              aria-hidden
              className="my-0.5 h-px w-6 bg-foreground/10 short:mx-0.5 short:h-6 short:w-px"
            />
            <button
              type="button"
              onClick={north}
              aria-label={t("compass")}
              title={t("compass")}
              className={cn(toolButton, rotated && "bg-foreground/[0.06]")}
            >
              <svg
                ref={needle}
                viewBox="0 0 24 24"
                className="size-5 transition-transform duration-100"
                aria-hidden
              >
                <path d="M12 3 15 12H9z" className="fill-destructive" />
                <path d="M12 21 9 12h6z" className="fill-foreground/35" />
                <circle cx="12" cy="12" r="1.4" className="fill-card" />
              </svg>
            </button>
            <button
              type="button"
              data-on={tilted}
              aria-pressed={tilted}
              onClick={tilt}
              aria-label={t("tilt")}
              title={t("tilt")}
              className={cn(toolButton, "text-[0.7rem] font-bold")}
            >
              3D
            </button>
            <button
              type="button"
              data-on={Boolean(me)}
              onClick={locate}
              aria-label={t("locate")}
              title={t("locate")}
              className={toolButton}
            >
              <LocateFixed className={cn("size-[1.1rem]", locating && "animate-spin")} />
            </button>
            <button
              type="button"
              onClick={reset}
              aria-label={t("reset")}
              title={t("reset")}
              className={cn(toolButton, "[&:active>svg]:-rotate-180 [&>svg]:transition-transform")}
            >
              <RotateCcw className="size-[1.1rem]" />
            </button>
            <button
              type="button"
              onClick={fullscreen}
              aria-pressed={expanded}
              data-on={expanded}
              aria-label={expanded ? t("exitFullscreen") : t("fullscreen")}
              title={expanded ? t("exitFullscreen") : t("fullscreen")}
              className={cn(toolButton, "max-sm:hidden")}
            >
              {expanded ? (
                <Minimize2 className="size-[1.1rem]" />
              ) : (
                <Maximize2 className="size-[1.1rem]" />
              )}
            </button>
          </div>

          {/* Bottom bar: interact, basemap, labels, measure, and the summary or measuring readout. */}
          <div
            ref={barRef}
            className={cn(
              "absolute bottom-3 left-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-1.5 rounded-[1.6rem] p-1 text-sm max-sm:right-3 sm:bottom-4 sm:left-6 sm:gap-2 sm:rounded-full sm:pr-4 lg:left-8",
              list && "max-lg:hidden",
              glass,
            )}
          >
            <button
              type="button"
              role="switch"
              aria-checked={interactive}
              onClick={() => setInteractive((v) => !v)}
              title={t("interactHint")}
              className="group/sw inline-flex h-9 items-center gap-2 rounded-full px-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground aria-checked:text-foreground"
            >
              <span
                aria-hidden
                className="relative inline-flex h-5 w-9 items-center rounded-full bg-foreground/15 transition-colors duration-(--dur-3) group-aria-checked/sw:bg-primary"
              >
                <span
                  className={cn(
                    "absolute size-4 rounded-full bg-white shadow-sm transition-transform duration-(--dur-3) ease-spring",
                    interactive ? "translate-x-[1.125rem]" : "translate-x-0.5",
                  )}
                />
              </span>
              <span className="max-[25rem]:sr-only">{t("interact")}</span>
            </button>

            {/* Basemap: a pill segmented control with a sliding thumb. */}
            <div
              role="radiogroup"
              aria-label={t("basemap")}
              className="relative grid grid-cols-2 rounded-full bg-foreground/[0.06] p-0.5 dark:bg-white/[0.06]"
            >
              <span
                aria-hidden
                className={cn(
                  "absolute inset-y-0.5 left-0.5 w-[calc(50%-0.125rem)] rounded-full bg-card shadow-sm transition-transform duration-(--dur-3) ease-spring dark:bg-white/[0.14]",
                  basemap === "satellite" && "translate-x-full",
                )}
              />
              {(["map", "satellite"] as const).map((b) => {
                const Icon = b === "map" ? MapIcon : Globe2;
                return (
                  <button
                    key={b}
                    type="button"
                    role="radio"
                    aria-checked={basemap === b}
                    onClick={() => setBasemap(b)}
                    className="relative inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 aria-checked:text-foreground"
                  >
                    <Icon className="size-4 max-[26rem]:hidden" aria-hidden />
                    {t(`basemaps.${b}`)}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              data-on={labels}
              aria-pressed={labels}
              onClick={() => setLabels((v) => !v)}
              title={t("labels")}
              aria-label={t("labels")}
              className={toolButton}
            >
              <Layers className="size-[1.1rem]" />
            </button>
            <button
              type="button"
              data-on={measuring}
              aria-pressed={measuring}
              onClick={toggleMeasure}
              title={t("measure")}
              aria-label={t("measure")}
              className={toolButton}
            >
              <svg
                viewBox="0 0 24 24"
                className="size-[1.1rem]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M3 16.5 16.5 3l4.5 4.5L7.5 21z" />
                <path d="m7 13 2 2M10 10l2 2M13 7l2 2" />
              </svg>
            </button>
            <span aria-hidden className="h-6 w-px bg-foreground/10 max-sm:hidden" />
            <div
              aria-live="polite"
              className={cn(
                "flex min-w-0 items-center gap-2.5 px-1",
                measuring ? "max-sm:basis-full max-sm:px-3 max-sm:pb-1.5" : "max-sm:hidden",
              )}
            >
              {measuring ? (
                <>
                  <span className="font-semibold num">
                    {points.length < 2 ? t("measureHint") : formatKm(measured)}
                  </span>
                  <span
                    ref={liveReadout}
                    aria-hidden
                    className="text-xs font-semibold num text-ember-text"
                  />
                  {points.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setPoints((p) => p.slice(0, -1))}
                        aria-label={t("undo")}
                        title={t("undo")}
                        className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground"
                      >
                        <Undo2 className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPoints([])}
                        className="text-xs font-semibold text-link hover:underline"
                      >
                        {t("clear")}
                      </button>
                    </>
                  )}
                  <span className="text-xs text-muted-foreground max-lg:hidden">
                    {t("measureKeys")}
                  </span>
                </>
              ) : (
                <>
                  <span className="inline-flex items-center gap-2">
                    <span className="relative inline-flex size-3.5 items-center justify-center">
                      <span className="absolute inset-0 animate-ping rounded-full bg-primary/30 [animation-duration:2.4s]" />
                      <span className="size-2 rounded-full bg-primary" />
                    </span>
                    <span className="font-semibold num">
                      {t("summary", { count: totalEntries, districts: placed.length })}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground max-md:hidden">{t("approx")}</span>
                </>
              )}
            </div>
          </div>

          {/* District panel: a card on the right, a bottom sheet on phones. */}
          {panelDistrict && (
            <aside
              ref={asideRef}
              key={panelDistrict.code}
              className={cn(
                "absolute z-30 flex flex-col gap-4 overflow-y-auto overscroll-contain rounded-3xl p-4 max-sm:inset-x-3 max-sm:bottom-3 max-sm:max-h-[62%] max-sm:animate-rise sm:top-4 sm:right-22 sm:max-h-[calc(100%-6rem)] sm:w-80 sm:animate-popover-in lg:right-24 short:top-[4.25rem] short:right-6 short:max-h-[calc(100%-5.5rem)]",
                glass,
              )}
            >
              <span
                aria-hidden
                className="mx-auto -mt-1.5 -mb-2 h-1 w-10 rounded-full bg-foreground/15 sm:hidden"
              />
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-[0.7rem] font-bold tracking-widest text-muted-foreground uppercase">
                    {t("district")}
                  </span>
                  <h3 className="text-lg leading-tight font-bold">{panelDistrict.name}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(undefined);
                    setSpotlight(undefined);
                  }}
                  aria-label={t("close")}
                  className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-[transform,background-color] hover:rotate-90 hover:bg-foreground/[0.07] hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
              <dl className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: t("total"), value: panelDistrict.total },
                  { label: t("valid"), value: panelDistrict.valid },
                  { label: t("firms"), value: panelDistrict.firms },
                ].map(({ label, value }, i) => (
                  <div
                    key={label}
                    style={{ animationDelay: `${i * 60}ms` }}
                    className="animate-rise rounded-2xl bg-foreground/[0.04] px-2 py-2.5 dark:bg-white/[0.05]"
                  >
                    <dd className="text-xl font-bold num">{value}</dd>
                    <dt className="text-[0.7rem] text-muted-foreground">{label}</dt>
                  </div>
                ))}
              </dl>
              {/* Valid share: the same measure the bubble's ring shows. */}
              <div className="flex flex-col gap-1.5">
                <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
                  <div
                    className="h-full origin-left animate-[grow-x_var(--dur-4)_var(--ease-enter)_both] rounded-full bg-sun"
                    style={{
                      width: `${(panelDistrict.valid / Math.max(1, panelDistrict.total)) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-[0.7rem] text-muted-foreground">
                  {t("validShare", { valid: panelDistrict.valid, total: panelDistrict.total })}
                </span>
              </div>
              {me && (
                <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <LocateFixed className="size-3.5 text-link" aria-hidden />
                  {t("fromYou", { distance: formatKm(haversineKm(me, panelDistrict.centre)) })}
                </p>
              )}
              {spotlight?.district === panelDistrict.code && (
                <button
                  type="button"
                  onClick={() => preview.open(spotlight)}
                  className="flex animate-pop items-center gap-3 rounded-2xl bg-sun/15 p-2.5 text-left ring-2 ring-sun/70 transition-colors hover:bg-sun/25"
                >
                  <span className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {initials(spotlight.displayName)}
                    <span
                      aria-hidden
                      className="absolute inset-0 animate-ping rounded-full ring-2 ring-sun [animation-duration:2s] [animation-iteration-count:2]"
                    />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold">{spotlight.displayName}</span>
                    <span className="font-mono text-[0.7rem] text-muted-foreground">
                      {spotlight.licenceNo}
                    </span>
                  </span>
                  <span className="shrink-0 text-[0.7rem] font-semibold text-ember-text">
                    {t("hereNow")}
                  </span>
                </button>
              )}
              <ul className="flex flex-col gap-1">
                {panelDistrict.preview
                  .filter(
                    (p) =>
                      p.licenceNo !== spotlight?.licenceNo ||
                      spotlight?.district !== panelDistrict.code,
                  )
                  .map((p, i) => (
                    <li
                      key={p.licenceNo}
                      style={{ animationDelay: `${120 + i * 50}ms` }}
                      className="animate-rise"
                    >
                      <button
                        type="button"
                        onClick={() => preview.open(p.licenceNo)}
                        className="group flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-foreground/[0.05]"
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "size-2 shrink-0 rounded-full",
                            STATUS_DOT[p.status] ?? "bg-foreground/30",
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {p.displayName}
                        </span>
                        <span className="font-mono text-[0.7rem] text-muted-foreground transition-transform group-hover:-translate-x-0.5">
                          {p.licenceNo}
                        </span>
                      </button>
                    </li>
                  ))}
              </ul>
              <Link
                href={panelDistrict.listHref as Route}
                className="group inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[color-mix(in_oklch,var(--primary)_86%,black)]"
              >
                <ListFilter className="size-4" aria-hidden />
                {t("viewList", { count: panelDistrict.total })}
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
