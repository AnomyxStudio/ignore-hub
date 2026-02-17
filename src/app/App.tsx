import { TextAttributes } from "@opentui/core";
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react";
import { readFile, writeFile } from "node:fs/promises";
import { useCallback, useEffect, useMemo, useState } from "react";
import { loadTemplateIndex, resolveCacheFilePath } from "../data/cacheStore";
import { fetchTemplateSource } from "../data/githubClient";
import { mergeGitignore } from "../domain/mergeGitignore";
import type { CliOptions, TemplateMeta, TemplateWithSource } from "../domain/types";
import { filterItems, MultiSelectStep } from "./steps/MultiSelectStep";
import { PreviewStep } from "./steps/PreviewStep";

// --- Color palette ---
const C = {
  accent: "#66b395",
  green: "#66b395",
  yellow: "#e2c97e",
  red: "#e47474",
  dim: "#999999",
  dimBorder: "#444444",
  muted: "#7098d4",
};

export type WizardStep = "select" | "preview" | "done";

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function moveCursor(
  current: number,
  direction: "up" | "down",
  itemCount: number,
): number {
  if (itemCount <= 0) return 0;
  if (direction === "up") return Math.max(0, current - 1);
  return Math.min(itemCount - 1, current + 1);
}

export function isEnterKey(name: string): boolean {
  return name === "enter" || name === "return";
}

function isBackspaceKey(name: string): boolean {
  return name === "backspace";
}

interface KeyboardEventLike {
  name: string;
  sequence: string;
  ctrl: boolean;
  meta: boolean;
  option: boolean;
}

function isSearchInputKey(key: KeyboardEventLike): boolean {
  if (key.ctrl || key.meta || key.option) return false;
  if (!key.sequence || key.sequence.length !== 1) return false;
  if (key.name === "space") return false;
  const charCode = key.sequence.charCodeAt(0);
  return charCode >= 32 && charCode !== 127;
}

export function toggleTemplateSelection(current: Set<string>, templateId: string): Set<string> {
  const next = new Set(current);
  if (next.has(templateId)) {
    next.delete(templateId);
  } else {
    next.add(templateId);
  }
  return next;
}

function clampCursorIndex(cursor: number, itemCount: number): number {
  if (itemCount <= 0) return 0;
  return Math.max(0, Math.min(cursor, itemCount - 1));
}

async function readExistingOutput(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

interface AppProps {
  options: CliOptions;
}

export function App({ options }: AppProps) {
  const renderer = useRenderer();
  const { height, width } = useTerminalDimensions();

  const [allTemplates, setAllTemplates] = useState<TemplateMeta[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [step, setStep] = useState<WizardStep>("select");
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">("loading");
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("Loading gitignore templates...");
  const [previewStatus, setPreviewStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [previewContent, setPreviewContent] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [failureNames, setFailureNames] = useState<string[]>([]);
  const [isWriting, setIsWriting] = useState(false);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);
  const [stdoutPayload, setStdoutPayload] = useState<string | null>(null);

  const filteredItems = useMemo(
    () => filterItems(allTemplates, searchQuery),
    [allTemplates, searchQuery],
  );

  const selectedTemplates = useMemo(
    () => allTemplates.filter((t) => selectedIds.has(t.id)),
    [selectedIds, allTemplates],
  );

  const invalidatePreview = useCallback(() => {
    setPreviewStatus("idle");
    setPreviewContent("");
    setPreviewError(null);
    setFailureNames([]);
  }, []);

  const exitApp = useCallback(() => {
    const payload = stdoutPayload;
    renderer.destroy();
    if (payload) {
      process.stdout.write(payload.endsWith("\n") ? payload : `${payload}\n`);
    }
  }, [renderer, stdoutPayload]);

  const loadIndex = useCallback(
    async (refresh: boolean) => {
      setLoadStatus("loading");
      setFatalError(null);
      setStatusMessage(
        refresh ? "Refreshing template index from GitHub..." : "Loading template index...",
      );

      try {
        const result = await loadTemplateIndex(refresh);
        const templates = result.index.templates.slice().sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
        );
        const validIds = new Set(templates.map((t) => t.id));

        setAllTemplates(templates);
        setSelectedIds((current) => new Set([...current].filter((id) => validIds.has(id))));
        setCursor((c) => clampCursorIndex(c, templates.length));
        setLoadStatus("ready");

        if (result.warning) {
          setStatusMessage(`${result.warning} Ctrl+R to retry.`);
        } else if (result.source === "network") {
          setStatusMessage("Loaded latest templates from GitHub. Ctrl+R to refresh.");
        } else {
          setStatusMessage("Loaded templates from cache. Ctrl+R to refresh from network.");
        }
      } catch (error) {
        setLoadStatus("error");
        setFatalError(formatError(error));
        setStatusMessage("Failed to load templates. Press Enter to retry.");
      }
    },
    [],
  );

  useEffect(() => {
    void loadIndex(options.refresh);
  }, [loadIndex, options.refresh]);

  // Clamp cursor when filtered list changes
  useEffect(() => {
    setCursor((c) => clampCursorIndex(c, filteredItems.length));
  }, [filteredItems.length]);

  const buildPreview = useCallback(async () => {
    setPreviewStatus("loading");
    setPreviewError(null);
    setFailureNames([]);
    setStatusMessage("Building preview from selected templates...");

    const templatesWithSource: TemplateWithSource[] = [];
    const failedTemplates: string[] = [];

    for (const template of selectedTemplates) {
      try {
        const source = await fetchTemplateSource(template.path);
        templatesWithSource.push({ meta: template, source });
      } catch {
        failedTemplates.push(template.name);
      }
    }

    if (failedTemplates.length > 0) {
      setFailureNames(failedTemplates);
      setPreviewStatus("error");
      setPreviewError(
        `Failed to download ${failedTemplates.length} template(s). Press Enter to retry.`,
      );
      setStatusMessage("Template download failed. Press Enter to retry, Backspace to go back.");
      return;
    }

    try {
      const existingContent = await readExistingOutput(options.output);
      const merged = mergeGitignore({
        existingContent,
        templates: templatesWithSource,
        includeWatermark: options.includeWatermark,
        useSimpleSectionSeparator: options.useSimpleSectionSeparator
      });
      setPreviewContent(merged);
      setPreviewStatus("ready");
      setStatusMessage("Preview ready. Press Enter to generate, Backspace to go back.");
    } catch (error) {
      setPreviewStatus("error");
      setPreviewError(formatError(error));
      setStatusMessage("Failed to build preview. Press Enter to retry.");
    }
  }, [options.output, selectedTemplates]);

  const generateOutput = useCallback(async () => {
    if (previewStatus !== "ready") return;

    setIsWriting(true);
    setStatusMessage(
      options.stdout ? "Preparing stdout output..." : `Writing ${options.output}...`,
    );

    try {
      if (options.stdout) {
        setStdoutPayload(previewContent);
        setDoneMessage("Generation complete. Output will be printed on exit.");
      } else {
        await writeFile(options.output, previewContent, "utf8");
        setDoneMessage(`Generated .gitignore saved to ${options.output}`);
      }
      setStep("done");
    } catch (error) {
      setPreviewStatus("error");
      setPreviewError(formatError(error));
      setStatusMessage("Failed to write output. Press Enter to retry.");
    } finally {
      setIsWriting(false);
    }
  }, [options.output, options.stdout, previewContent, previewStatus]);

  useKeyboard(
    (key) => {
      if (key.eventType !== "press") return;

      // Ctrl+Q or Escape to quit
      if ((key.ctrl && key.name === "q") || key.name === "escape") {
        if (step === "done") {
          exitApp();
        } else {
          renderer.destroy();
        }
        return;
      }

      // Ctrl+R to refresh templates
      if (key.ctrl && key.name === "r" && step !== "done" && loadStatus !== "loading" && !isWriting) {
        invalidatePreview();
        void loadIndex(true);
        return;
      }

      if (loadStatus === "error") {
        if (isEnterKey(key.name)) void loadIndex(false);
        return;
      }

      if (loadStatus !== "ready") return;

      // --- Done step ---
      if (step === "done") {
        if (isEnterKey(key.name) || isBackspaceKey(key.name)) exitApp();
        return;
      }

      // --- Preview step ---
      if (step === "preview") {
        if (isBackspaceKey(key.name)) {
          setStep("select");
          setStatusMessage("Back to template selection.");
          return;
        }
        if (isEnterKey(key.name)) {
          if (previewStatus === "ready") {
            void generateOutput();
          } else if (previewStatus === "error" || previewStatus === "idle") {
            void buildPreview();
          }
        }
        return;
      }

      // --- Select step ---
      if (key.name === "up") {
        setCursor((c) => moveCursor(c, "up", filteredItems.length));
        return;
      }

      if (key.name === "down") {
        setCursor((c) => moveCursor(c, "down", filteredItems.length));
        return;
      }

      if (key.name === "space") {
        const focusedItem = filteredItems[clampCursorIndex(cursor, filteredItems.length)];
        if (!focusedItem) return;
        setSelectedIds((current) => toggleTemplateSelection(current, focusedItem.id));
        invalidatePreview();
        return;
      }

      if (isSearchInputKey(key)) {
        setSearchQuery((q) => `${q}${key.sequence}`);
        setCursor(0);
        return;
      }

      if (isEnterKey(key.name)) {
        if (selectedIds.size === 0) {
          setStatusMessage("Select at least one template first.");
          return;
        }
        setStep("preview");
        void buildPreview();
        return;
      }

      if (isBackspaceKey(key.name)) {
        if (searchQuery.length > 0) {
          setSearchQuery((q) => q.slice(0, -1));
          setCursor((c) => clampCursorIndex(c, filteredItems.length));
        }
      }
    },
    { release: false },
  );

  const body =
    loadStatus === "loading" ? (
      <box border borderColor={C.dimBorder} title="Loading" padding={1} flexDirection="column" flexGrow={1}>
        <text fg={C.yellow}>Fetching template index from GitHub/cache...</text>
        <text fg={C.dim}>Ctrl+Q to quit.</text>
      </box>
    ) : loadStatus === "error" ? (
      <box border borderColor={C.red} title="Error" padding={1} flexDirection="column" flexGrow={1}>
        <text fg={C.red}>{fatalError ?? "Unknown error"}</text>
        <text fg={C.dim}>Press Enter to retry or Ctrl+Q to quit.</text>
      </box>
    ) : step === "preview" ? (
      <PreviewStep
        previewStatus={previewStatus}
        previewContent={previewContent}
        selectedCount={selectedIds.size}
        outputPath={options.output}
        stdout={options.stdout}
        failureNames={failureNames}
        previewError={previewError}
      />
    ) : step === "done" ? (
      <box border borderColor={C.green} title="Done" padding={1} flexDirection="column" flexGrow={1}>
        <text fg={C.green}>{doneMessage ?? "Generation complete."}</text>
        <text fg={C.dim}>
          Press Enter to exit.
          {options.stdout ? " Output will be printed after exit." : ""}
        </text>
      </box>
    ) : (
      <MultiSelectStep
        items={filteredItems}
        totalItems={allTemplates.length}
        selectedCount={selectedIds.size}
        cursor={clampCursorIndex(cursor, filteredItems.length)}
        selectedIds={selectedIds}
        terminalHeight={height}
        terminalWidth={width}
        searchQuery={searchQuery}
      />
    );

  return (
    <box flexDirection="column" flexGrow={1} padding={1}>
      <box marginBottom={1} flexDirection="column" flexShrink={0}>
        <text fg={C.accent} attributes={TextAttributes.BOLD}>Ignore Hub</text>
        <text fg={C.dim}>
          Source: <span fg={C.muted}>github/gitignore</span> (Root + Global)
        </text>
        <text fg={C.dim}>
          Cache: <span fg={C.muted}>{resolveCacheFilePath()}</span>
        </text>
      </box>

      {body}

      <box border borderColor={C.dimBorder} padding={1} marginTop={1} flexShrink={0}>
        <text fg={C.dim}>{statusMessage}</text>
      </box>
    </box>
  );
}
