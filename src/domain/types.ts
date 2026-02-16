export type TemplateKind = "language" | "framework" | "global";

export interface TemplateMeta {
  id: string;
  name: string;
  path: string;
  kind: TemplateKind;
}

export interface CacheIndex {
  fetchedAt: string;
  sourceRef: "main";
  templates: TemplateMeta[];
}

export interface CliOptions {
  output: string;
  refresh: boolean;
  stdout: boolean;
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
