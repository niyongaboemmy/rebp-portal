"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  checkCv,
  checkSection,
  CV_DOCUMENT_TYPES,
  CV_SECTIONS,
  DOCUMENT_RULES,
  isCvSection,
  PROFILE_DOCUMENT_TYPES,
  type Cv,
  type CvSection,
  type ApplicationData,
  type ApplicationStatus,
  type ApplicationType,
  type Category,
  type DocumentStatus,
  type DocumentType,
  type ExperienceSummary,
  type FeeLine,
  type RuleOutcome,
  type RuleResult,
  type SectionB,
  type SectionContext,
  type SectionKey,
  type StepKey,
} from "@rebp/contracts";
import { useErrorMessage } from "@/hooks/use-error-message";
import { saveSectionAction } from "@/server/actions/applications";

/**
 * Wizard state (FR-WIZ-001…009): section data, live completeness (the same contract check the
 * server runs), debounced autosave (FR-WIZ-004, ≤ 2 s), live eligibility (FR-WIZ-007), documents,
 * and what is editable in ACTION_REQUIRED (FR-WF-002). Validation shows after the first attempt to
 * continue from a section, then updates live (D-010).
 */
export interface WizardDocument {
  id: string;
  type: DocumentType;
  status: DocumentStatus;
  fileName: string;
  size: number;
  mimeType: string;
  version: number;
  officerNote: string | null;
  /** Where the file is served, when not an application document (profile documents). */
  href?: string;
  /** A copy of the applicant's profile document (UX-010). */
  fromProfile?: boolean;
}

/** Where uploads go and files come from, when not an application (the profile, UX-010). */
export interface DocumentsApi {
  endpoint: string;
  base: string;
  remove: (id: string) => Promise<{ ok: boolean; error?: string }>;
}

export interface Division {
  code: string;
  name: string;
  level: number;
}

export interface FirmOption {
  id: string;
  legalName: string;
  tradingName: string | null;
  registrationNo: string;
  district: string | null;
  principal: { displayName: string; licenceNo: string } | null;
  branches: Array<{ id: string; name: string; hasManager: boolean }>;
}

export interface WizardEligibility {
  outcome: RuleOutcome;
  rules: RuleResult[];
  experience: ExperienceSummary | null;
}

export interface WizardInit {
  application: {
    id: string;
    referenceNo: string;
    type: ApplicationType;
    category: Category;
    status: ApplicationStatus;
    unlockedSections: string[];
    unlockedDocuments: string[];
    extraDocuments: string[];
    infoRequest: { message: string; dueAt: string } | null;
    accountType: "INDIVIDUAL" | "ORGANISATION";
  };
  steps: StepKey[];
  initialStep: StepKey;
  data: ApplicationData;
  documents: WizardDocument[];
  context: Omit<SectionContext, "type" | "category">;
  eligibility: WizardEligibility;
  provinces: Division[];
  firm: FirmOption | null;
  fee: { lines: FeeLine[]; total: number; currency: string; sample: boolean };
  locale: string;
  phone: string | null;
  email: string;
  signatoryName: string;
  /** Names of the administrative divisions referenced in the data (for the summary). */
  divisionNames: Record<string, string>;
}

type SaveState = "idle" | "saving" | "saved" | "error";

interface WizardValue extends WizardInit {
  data: ApplicationData;
  update: <K extends SectionKey>(key: K, next: NonNullable<ApplicationData[K]>) => void;
  issues: (key: SectionKey) => Record<string, string>;
  attempted: (key: SectionKey) => boolean;
  attempt: (key: SectionKey) => void;
  readOnly: (key: SectionKey) => boolean;
  canUpload: (type: DocumentType) => boolean;
  documents: WizardDocument[];
  setDocuments: (update: (docs: WizardDocument[]) => WizardDocument[]) => void;
  eligibility: WizardEligibility;
  saveState: SaveState;
  /** Saves pending changes now; resolves false when a section failed to save. */
  flush: () => Promise<boolean | "noop">;
  firm: FirmOption | null;
  setFirm: (firm: FirmOption | null) => void;
  sectionContext: SectionContext;
  documentsApi?: DocumentsApi;
  /** Editing the applicant's CV, not an application (UX-018): neutral copy, no category choices. */
  cv?: boolean;
  /** The upload slots a step shows, when not the application's checklist (the CV). */
  stepDocuments?: (step: string) => DocumentType[];
}

const WizardContext = createContext<WizardValue | null>(null);

export function useWizard() {
  const value = useContext(WizardContext);
  if (!value) throw new Error("useWizard must be used inside <WizardProvider>");
  return value;
}

const SAVE_DELAY_MS = 1200;

export function WizardProvider({
  init,
  children,
}: {
  init: WizardInit;
  children: React.ReactNode;
}) {
  const errorMessage = useErrorMessage();
  const [data, setData] = useState<ApplicationData>(init.data);
  const [documents, setDocumentsState] = useState(init.documents);
  const [eligibility, setEligibility] = useState(init.eligibility);
  const [attemptedSet, setAttempted] = useState<Set<SectionKey>>(new Set());
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [firm, setFirm] = useState(init.firm);
  const dirty = useRef<Set<SectionKey>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // What autosave sends: updated in the same handler as the state, never during render.
  const latest = useRef(init.data);

  const { application } = init;
  const sectionContext = useMemo<SectionContext>(
    () => ({ ...init.context, type: application.type, category: application.category }),
    [init.context, application.type, application.category],
  );

  const readOnly = useCallback(
    (key: SectionKey) =>
      application.status === "DRAFT"
        ? false
        : !(application.status === "ACTION_REQUIRED" && application.unlockedSections.includes(key)),
    [application],
  );

  const canUpload = useCallback(
    (type: DocumentType) => {
      if (application.status === "DRAFT") return true;
      if (application.status !== "ACTION_REQUIRED") return false;
      return (
        application.unlockedDocuments.includes(type) ||
        (type === "other" && application.extraDocuments.length > 0)
      );
    },
    [application],
  );

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const keys = [...dirty.current];
    dirty.current.clear();
    if (keys.length === 0) return "noop";
    setSaveState("saving");
    let ok = true;
    for (const key of keys) {
      const result = await saveSectionAction(application.id, {
        section: key,
        data: (latest.current[key] ?? {}) as never,
      }).catch(() => ({ ok: false as const, error: "errors.unexpected", meta: undefined }));
      if (result.ok) setEligibility(result.data.eligibility as WizardEligibility);
      else {
        ok = false;
        dirty.current.add(key);
        toast.error(errorMessage(result.error, result.meta), { id: "autosave" });
      }
    }
    setSaveState(ok ? "saved" : "error");
    return ok;
  }, [application.id, errorMessage]);

  const update = useCallback(
    <K extends SectionKey>(key: K, next: NonNullable<ApplicationData[K]>) => {
      if (readOnly(key)) return;
      latest.current = { ...latest.current, [key]: next };
      setData(latest.current);
      dirty.current.add(key);
      setSaveState("idle");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
    [flush, readOnly],
  );

  // Save before the tab closes or navigates away (FR-WIZ-004 "on step navigation").
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirty.current.size > 0) {
        void flush();
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [flush]);

  const issues = useCallback(
    (key: SectionKey) => checkSection(key, data, sectionContext),
    [data, sectionContext],
  );

  const value: WizardValue = {
    ...init,
    data,
    update,
    issues,
    attempted: (key) => attemptedSet.has(key),
    attempt: (key) => setAttempted((prev) => new Set(prev).add(key)),
    readOnly,
    canUpload,
    documents,
    setDocuments: (fn) => setDocumentsState(fn),
    eligibility,
    saveState,
    flush,
    firm,
    setFirm,
    sectionContext,
  };
  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
}

/**
 * The Section B form outside an application (UX-010): the applicant profile page renders the
 * wizard's own personal-details section, with the same fields and checks, autosaved to the
 * account instead of an application. Application-only parts (documents, eligibility, fees) are
 * empty here.
 */
export function ProfileFormProvider({
  initial,
  context,
  provinces,
  locale,
  email,
  phone,
  signatoryName,
  save,
  onSaved,
  documents: initialDocuments = [],
  documentsApi,
  children,
}: {
  initial: SectionB;
  documents?: WizardDocument[];
  documentsApi?: DocumentsApi;
  context: Pick<SectionContext, "today" | "flags">;
  provinces: Division[];
  locale: string;
  email: string;
  phone: string | null;
  signatoryName: string;
  save: (data: SectionB) => Promise<{ ok: boolean; error?: string }>;
  onSaved?: (data: SectionB) => void;
  children: React.ReactNode;
}) {
  const errorMessage = useErrorMessage();
  const [b, setB] = useState<SectionB>(initial);
  const [documents, setDocumentsState] = useState(initialDocuments);
  const [attempted, setAttempted] = useState(false);
  // The profile opens as stored: nothing unsaved until something changes.
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const latest = useRef(initial);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sectionContext = useMemo<SectionContext>(
    () => ({ ...context, type: "NEW", category: "RERA" }),
    [context],
  );

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!dirty.current) return "noop" as const;
    dirty.current = false;
    setSaveState("saving");
    // A dropped connection throws rather than returning a result: report it, keep the changes.
    const result = await save(latest.current).catch(() => ({
      ok: false as const,
      error: "errors.unexpected",
    }));
    if (!result.ok) {
      dirty.current = true;
      setSaveState("error");
      toast.error(errorMessage(result.error), { id: "profile-save" });
      return false;
    }
    setSaveState("saved");
    onSaved?.(latest.current);
    return true;
  }, [save, onSaved, errorMessage]);

  const update = useCallback(
    <K extends SectionKey>(key: K, next: NonNullable<ApplicationData[K]>) => {
      if (key !== "b") return;
      latest.current = next as SectionB;
      setB(latest.current);
      dirty.current = true;
      setSaveState("idle");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
    [flush],
  );

  const data: ApplicationData = { b };
  const value: WizardValue = {
    application: {
      id: "profile",
      referenceNo: "",
      type: "NEW",
      category: "RERA",
      status: "DRAFT",
      unlockedSections: [],
      unlockedDocuments: [],
      extraDocuments: [],
      infoRequest: null,
      accountType: "INDIVIDUAL",
    },
    steps: ["b"],
    initialStep: "b",
    data,
    documents,
    context: { today: context.today, flags: context.flags },
    eligibility: { outcome: "PASS", rules: [], experience: null },
    provinces,
    firm: null,
    fee: { lines: [], total: 0, currency: "RWF", sample: false },
    locale,
    phone,
    email,
    signatoryName,
    divisionNames: {},
    update,
    issues: (key) => (key === "b" ? checkSection("b", data, sectionContext) : {}),
    attempted: (key) => key === "b" && attempted,
    attempt: () => setAttempted(true),
    readOnly: () => false,
    canUpload: (type) => Boolean(documentsApi) && PROFILE_DOCUMENT_TYPES.includes(type),
    setDocuments: (fn) => setDocumentsState(fn),
    documentsApi,
    saveState,
    flush,
    setFirm: () => undefined,
    sectionContext,
  };
  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
}

// ---------------------------------------------------------------------------
// Path helpers for nested section data ("qualifications.0.institution")
// ---------------------------------------------------------------------------

export function getPath(source: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (value, key) => (value == null ? undefined : (value as Record<string, unknown>)[key]),
      source,
    );
}

export function setPath<T>(source: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split(".");
  const key = head!;
  const container: Record<string, unknown> | unknown[] = Array.isArray(source)
    ? [...source]
    : { ...((source ?? {}) as Record<string, unknown>) };
  const current = (container as Record<string, unknown>)[key];
  const next =
    rest.length === 0
      ? value
      : setPath(current ?? (/^\d+$/.test(rest[0]!) ? [] : {}), rest.join("."), value);
  if (next === undefined && !Array.isArray(container))
    delete (container as Record<string, unknown>)[key];
  else (container as Record<string, unknown>)[key] = next;
  return container as T;
}

/** Bind a section: read a path, write a path (autosaved). */
export function useSection<K extends SectionKey>(key: K) {
  const wizard = useWizard();
  const section = (wizard.data[key] ?? {}) as NonNullable<ApplicationData[K]>;
  const issues = wizard.attempted(key) ? wizard.issues(key) : {};
  return {
    data: section,
    get: (path: string) => getPath(section, path),
    set: (path: string, value: unknown) => wizard.update(key, setPath(section, path, value)),
    patch: (patch: Partial<NonNullable<ApplicationData[K]>>) =>
      wizard.update(key, { ...section, ...patch }),
    error: (path: string) => issues[path],
    disabled: wizard.readOnly(key),
  };
}

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);

/**
 * The CV outside an application (UX-018): the profile's CV page renders the wizard's own
 * education, training and experience sections — same fields, same checks, less what only an
 * application decides — autosaved section by section to the account, which copies them into every
 * open application. Uploads are the CV's evidence, kept on the profile.
 */
export function CvFormProvider({
  initial,
  context,
  locale,
  email,
  phone,
  signatoryName,
  save,
  documents: initialDocuments = [],
  documentsApi,
  children,
}: {
  initial: Cv;
  documents?: WizardDocument[];
  documentsApi?: DocumentsApi;
  context: Pick<SectionContext, "today" | "flags">;
  locale: string;
  email: string;
  phone: string | null;
  signatoryName: string;
  save: (section: CvSection, data: unknown) => Promise<{ ok: boolean; error?: string }>;
  children: React.ReactNode;
}) {
  const errorMessage = useErrorMessage();
  const [cv, setCv] = useState<Cv>(initial);
  const [documents, setDocumentsState] = useState(initialDocuments);
  const [attempted, setAttempted] = useState<Set<SectionKey>>(new Set());
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const latest = useRef(initial);
  const dirty = useRef(new Set<CvSection>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sectionContext = useMemo<SectionContext>(
    () => ({ ...context, type: "NEW", category: "RERA" }),
    [context],
  );
  const issues = useMemo(() => checkCv(cv, context.today), [cv, context.today]);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const keys = [...dirty.current];
    dirty.current.clear();
    if (keys.length === 0) return "noop" as const;
    setSaveState("saving");
    let ok = true;
    for (const key of keys) {
      const result = await save(key, latest.current[key] ?? {}).catch(() => ({
        ok: false as const,
        error: "errors.unexpected",
      }));
      if (!result.ok) {
        ok = false;
        dirty.current.add(key);
        toast.error(errorMessage(result.error), { id: "cv-save" });
      }
    }
    setSaveState(ok ? "saved" : "error");
    return ok;
  }, [save, errorMessage]);

  const update = useCallback(
    <K extends SectionKey>(key: K, next: NonNullable<ApplicationData[K]>) => {
      if (!isCvSection(key)) return;
      latest.current = { ...latest.current, [key]: next };
      setCv(latest.current);
      dirty.current.add(key);
      setSaveState("idle");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
    [flush],
  );

  const data = cv as ApplicationData;
  const value: WizardValue = {
    application: {
      id: "cv",
      referenceNo: "",
      type: "NEW",
      category: "RERA",
      status: "DRAFT",
      unlockedSections: [],
      unlockedDocuments: [],
      extraDocuments: [],
      infoRequest: null,
      accountType: "INDIVIDUAL",
    },
    steps: [...CV_SECTIONS],
    initialStep: "c",
    data,
    documents,
    context: { today: context.today, flags: context.flags },
    eligibility: { outcome: "PASS", rules: [], experience: null },
    provinces: [],
    firm: null,
    fee: { lines: [], total: 0, currency: "RWF", sample: false },
    locale,
    phone,
    email,
    signatoryName,
    divisionNames: {},
    update,
    issues: (key) => (isCvSection(key) ? issues[key] : {}),
    attempted: (key) => attempted.has(key),
    attempt: (key) => setAttempted((set) => new Set(set).add(key)),
    readOnly: () => false,
    canUpload: (type) => Boolean(documentsApi) && CV_DOCUMENT_TYPES.includes(type),
    setDocuments: (fn) => setDocumentsState(fn),
    documentsApi,
    saveState,
    flush,
    setFirm: () => undefined,
    sectionContext,
    cv: true,
    stepDocuments: (step) => CV_DOCUMENT_TYPES.filter((type) => DOCUMENT_RULES[type].step === step),
  };
  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
}
