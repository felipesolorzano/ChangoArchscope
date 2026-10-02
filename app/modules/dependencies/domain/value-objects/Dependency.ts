export type Ecosystem = "npm" | "composer";

export type RuntimeKind = "php" | "node" | "npm";

/** Paquete declarado en un manifiesto, con la version instalada segun su lock. */
export type DeclaredDependency = {
  ecosystem: Ecosystem;
  name: string;
  constraint: string;
  installed: string | null;
  dev: boolean;
  /** Ruta absoluta del package.json / composer.json que lo declara. */
  manifest: string;
};

export type DetectedRuntime = {
  kind: RuntimeKind;
  version: string | null;
  source: string;
};

export type DependencyInventory = {
  root: string;
  manifests: string[];
  runtimes: DetectedRuntime[];
  dependencies: DeclaredDependency[];
  skipped: Array<{ manifest: string; reason: string }>;
};

/** Release publicada de un paquete, con lo que exige del runtime. */
export type PackageRelease = {
  version: string;
  deprecated: string | null;
  requires: Partial<Record<RuntimeKind, string>>;
  publishedAt: string | null;
};

/** Lo que sabe el registro (npm / Packagist) de un paquete. `abandoned`: reemplazo sugerido o true. */
export type PackageInfo = {
  ecosystem: Ecosystem;
  name: string;
  releases: PackageRelease[];
  abandoned: string | true | null;
};

/** Version de runtime elegida para calcular la recomendada; un kind ausente no restringe. */
export type RuntimeSelection = Partial<Record<RuntimeKind, string>>;

export type VersionGap = "major" | "minor" | "patch" | "none";

export type DependencyStatus = "up_to_date" | "patch" | "minor" | "major" | "deprecated" | "abandoned" | "unknown";

export type DependencyReport = DeclaredDependency & {
  current: string | null;
  latest: string | null;
  recommended: string | null;
  gap: VersionGap;
  status: DependencyStatus;
  deprecation: string | null;
  replacement: string | null;
  limitedByRuntime: boolean;
  currentPublishedAt: string | null;
  latestPublishedAt: string | null;
};
