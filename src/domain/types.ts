export type TemplateKind = "language" | "framework" | "global";

export interface TemplateMeta {
  id: string;
  kind: TemplateKind;
  name: string;
  path: string;
}

export interface CacheIndex {
  fetchedAt: string;
  sourceRef: "main";
  templates: TemplateMeta[];
}

export interface CliOptions {
  auto: boolean;
  includeWatermark: boolean;
  nonInteractive: boolean;
  output: string;
  refresh: boolean;
  stdout: boolean;
  templates: string[];
  useSimpleSectionSeparator: boolean;
}

export interface TemplateWithSource {
  meta: TemplateMeta;
  source: string;
}

export interface IndexLoadResult {
  index: CacheIndex;
  source: "network" | "cache";
  warning?: string;
}
