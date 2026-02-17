import { readFile, writeFile } from "node:fs/promises";
import { TextAttributes } from "@opentui/core";
import {
  useKeyboard,
  useRenderer,
  useTerminalDimensions,
} from "@opentui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { loadTemplateIndex, resolveCacheFilePath } from "../data/cache-store";
import { fetchTemplateSource } from "../data/github-client";
import { mergeGitignore } from "../domain/merge-gitignore";
import type {
  CliOptions,
  TemplateMeta,
  TemplateWithSource,
} from "../domain/types";
import { filterItems, MultiSelectStep } from "./steps/multi-select-step";
import { PreviewStep } from "./steps/preview-step";

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
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function moveCursor(
  current: number,
  direction: "up" | "down",
  itemCount: number
): number {
  if (itemCount <= 0) {
    return 0;
  }
  if (direction === "up") {
    return Math.max(0, current - 1);
  }
  return Math.min(itemCount - 1, current + 1);
}

export function isEnterKey(name: string): boolean {
  return name === "enter" || name === "return";
}

function isBackspaceKey(name: string): boolean {
  return name === "backspace";
}

interface KeyboardEventLike {
  ctrl: boolean;
  meta: boolean;
  name: string;
  option: boolean;
  sequence: string;
}

function isSearchInputKey(key: KeyboardEventLike): boolean {
  if (key.ctrl || key.meta || key.option) {
    return false;
  }
  if (!key.sequence || key.sequence.length !== 1) {
    return false;
  }
  if (key.name === "space") {
    return false;
  }
  const charCode = key.sequence.charCodeAt(0);
  return charCode >= 32 && charCode !== 127;
}

export function toggleTemplateSelection(
  current: Set<string>,
  templateId: string
): Set<string> {
  const next = new Set(current);
  if (next.has(templateId)) {
    next.delete(templateId);
  } else {
    next.add(templateId);
  }
  return next;
}

function clampCursorIndex(cursor: number, itemCount: number): number {
  if (itemCount <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(cursor, itemCount - 1));
}

async function readExistingOutput(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
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
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState(
    "Loading gitignore templates..."
  );
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
    [allTemplates, searchQuery]
  );

  const selectedTemplates = useMemo(
    () => allTemplates.filter((t) => selectedIds.has(t.id)),
    [selectedIds, allTemplates]
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

  const loadIndex = useCallback(async (refresh: boolean) => {
    setLoadStatus("loading");
    setFatalError(null);
    setStatusMessage(
      refresh
        ? "Refreshing template index from GitHub..."
        : "Loading template index..."
    );

    try {
      const result = await loadTemplateIndex(refresh);
      const templates = result.index.templates
        .slice()
        .sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        );
      const validIds = new Set(templates.map((t) => t.id));

      setAllTemplates(templates);
      setSelectedIds(
        (current) => new Set([...current].filter((id) => validIds.has(id)))
      );
      setCursor((c) => clampCursorIndex(c, templates.length));
      setLoadStatus("ready");

      if (result.warning) {
        setStatusMessage(`${result.warning} Ctrl+R to retry.`);
      } else if (result.source === "network") {
        setStatusMessage(
          "Loaded latest templates from GitHub. Ctrl+R to refresh."
        );
      } else {
        setStatusMessage(
          "Loaded templates from cache. Ctrl+R to refresh from network."
        );
      }
    } catch (error) {
      setLoadStatus("error");
      setFatalError(formatError(error));
      setStatusMessage("Failed to load templates. Press Enter to retry.");
    }
  }, []);

  useEffect(() => {
    loadIndex(options.refresh);
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
        `Failed to download ${failedTemplates.length} template(s). Press Enter to retry.`
      );
      setStatusMessage(
        "Template download failed. Press Enter to retry, Backspace to go back."
      );
      return;
    }

    try {
      const existingContent = await readExistingOutput(options.output);
      const merged = mergeGitignore({
        existingContent,
        templates: templatesWithSource,
        includeWatermark: options.includeWatermark,
        useSimpleSectionSeparator: options.useSimpleSectionSeparator,
      });
      setPreviewContent(merged);
      setPreviewStatus("ready");
      setStatusMessage(
        "Preview ready. Press Enter to generate, Backspace to go back."
      );
    } catch (error) {
      setPreviewStatus("error");
      setPreviewError(formatError(error));
      setStatusMessage("Failed to build preview. Press Enter to retry.");
    }
  }, [
    options.output,
    options.includeWatermark,
    options.useSimpleSectionSeparator,
    selectedTemplates,
  ]);

  const generateOutput = useCallback(async () => {
    if (previewStatus !== "ready") {
      return;
    }

    setIsWriting(true);
    setStatusMessage(
      options.stdout
        ? "Preparing stdout output..."
        : `Writing ${options.output}...`
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
      if (key.eventType !== "press") {
        return;
      }

      const shouldExitOrRefresh = (): boolean => {
        if ((key.ctrl && key.name === "q") || key.name === "escape") {
          if (step === "done") {
            exitApp();
          } else {
            renderer.destroy();
          }
          return true;
        }

        if (
          key.ctrl &&
          key.name === "r" &&
          step !== "done" &&
          loadStatus !== "loading" &&
          !isWriting
        ) {
          invalidatePreview();
          loadIndex(true);
          return true;
        }

        return false;
      };

      const shouldHandleLoadingState = (): boolean => {
        if (loadStatus !== "error") {
          return false;
        }
        if (isEnterKey(key.name)) {
          loadIndex(false);
        }
        return true;
      };

      const shouldHandleDoneStep = (): boolean => {
        if (step !== "done") {
          return false;
        }
        if (isEnterKey(key.name) || isBackspaceKey(key.name)) {
          exitApp();
        }
        return true;
      };

      const shouldHandlePreviewStep = (): boolean => {
        if (step !== "preview") {
          return false;
        }
        if (isBackspaceKey(key.name)) {
          setStep("select");
          setStatusMessage("Back to template selection.");
          return true;
        }
        if (isEnterKey(key.name)) {
          if (previewStatus === "ready") {
            generateOutput();
          } else if (previewStatus === "error" || previewStatus === "idle") {
            buildPreview();
          }
        }
        return true;
      };

      const handleSelectNavigation = (): boolean => {
        if (step !== "select") {
          return false;
        }
        if (key.name === "up") {
          setCursor((c) => moveCursor(c, "up", filteredItems.length));
          return true;
        }
        if (key.name === "down") {
          setCursor((c) => moveCursor(c, "down", filteredItems.length));
          return true;
        }
        return false;
      };

      const handleSelectToggle = (): boolean => {
        if (step !== "select" || key.name !== "space") {
          return false;
        }
        const focusedItem =
          filteredItems[clampCursorIndex(cursor, filteredItems.length)];
        if (!focusedItem) {
          return true;
        }
        setSelectedIds((current) =>
          toggleTemplateSelection(current, focusedItem.id)
        );
        invalidatePreview();
        return true;
      };

      const handleSelectSearch = (): boolean => {
        if (step !== "select" || !isSearchInputKey(key)) {
          return false;
        }
        setSearchQuery((q) => `${q}${key.sequence}`);
        setCursor(0);
        return true;
      };

      const handleSelectBackspace = (): boolean => {
        if (step !== "select") {
          return false;
        }
        if (!isBackspaceKey(key.name) || searchQuery.length === 0) {
          return false;
        }
        setSearchQuery((q) => q.slice(0, -1));
        setCursor((c) => clampCursorIndex(c, filteredItems.length));
        return true;
      };

      const handleSelectConfirm = (): boolean => {
        if (step !== "select" || !isEnterKey(key.name)) {
          return false;
        }
        if (selectedIds.size === 0) {
          setStatusMessage("Select at least one template first.");
          return true;
        }
        setStep("preview");
        buildPreview();
        return true;
      };

      if (shouldExitOrRefresh()) {
        return;
      }

      if (shouldHandleLoadingState()) {
        return;
      }

      if (loadStatus !== "ready") {
        return;
      }

      if (shouldHandleDoneStep()) {
        return;
      }

      if (shouldHandlePreviewStep()) {
        return;
      }

      if (handleSelectNavigation()) {
        return;
      }
      if (handleSelectToggle()) {
        return;
      }
      if (handleSelectSearch()) {
        return;
      }
      if (handleSelectConfirm()) {
        return;
      }
      handleSelectBackspace();
    },
    { release: false }
  );

  const body = (() => {
    if (loadStatus === "loading") {
      return (
        <box
          border
          borderColor={C.dimBorder}
          flexDirection="column"
          flexGrow={1}
          padding={1}
          title="Loading"
        >
          <text fg={C.yellow}>
            Fetching template index from GitHub/cache...
          </text>
          <text fg={C.dim}>Ctrl+Q to quit.</text>
        </box>
      );
    }
    if (loadStatus === "error") {
      return (
        <box
          border
          borderColor={C.red}
          flexDirection="column"
          flexGrow={1}
          padding={1}
          title="Error"
        >
          <text fg={C.red}>{fatalError ?? "Unknown error"}</text>
          <text fg={C.dim}>Press Enter to retry or Ctrl+Q to quit.</text>
        </box>
      );
    }
    if (step === "preview") {
      return (
        <PreviewStep
          failureNames={failureNames}
          outputPath={options.output}
          previewContent={previewContent}
          previewError={previewError}
          previewStatus={previewStatus}
          selectedCount={selectedIds.size}
          stdout={options.stdout}
        />
      );
    }
    if (step === "done") {
      return (
        <box
          border
          borderColor={C.green}
          flexDirection="column"
          flexGrow={1}
          padding={1}
          title="Done"
        >
          <text fg={C.green}>{doneMessage ?? "Generation complete."}</text>
          <text fg={C.dim}>
            Press Enter to exit.
            {options.stdout ? " Output will be printed after exit." : ""}
          </text>
        </box>
      );
    }
    return (
      <MultiSelectStep
        cursor={clampCursorIndex(cursor, filteredItems.length)}
        items={filteredItems}
        searchQuery={searchQuery}
        selectedCount={selectedIds.size}
        selectedIds={selectedIds}
        terminalHeight={height}
        terminalWidth={width}
        totalItems={allTemplates.length}
      />
    );
  })();

  return (
    <box flexDirection="column" flexGrow={1} padding={1}>
      <box flexDirection="column" flexShrink={0} marginBottom={1}>
        <text attributes={TextAttributes.BOLD} fg={C.accent}>
          Ignore Hub
        </text>
        <text fg={C.dim}>
          Source: <span fg={C.muted}>github/gitignore</span> (Root + Global)
        </text>
        <text fg={C.dim}>
          Cache: <span fg={C.muted}>{resolveCacheFilePath()}</span>
        </text>
      </box>

      {body}

      <box
        border
        borderColor={C.dimBorder}
        flexShrink={0}
        marginTop={1}
        padding={1}
      >
        <text fg={C.dim}>{statusMessage}</text>
      </box>
    </box>
  );
}
