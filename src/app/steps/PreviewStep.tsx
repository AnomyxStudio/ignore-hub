import { TextAttributes } from "@opentui/core";

const C = {
  accent: "#7aa2f7",
  green: "#7ef9d1",
  yellow: "#e0af68",
  red: "#ff7a7a",
  redSoft: "#ffb3b3",
  dim: "#565f89",
  dimBorder: "#3b4261",
};

interface PreviewStepProps {
  previewStatus: "idle" | "loading" | "ready" | "error";
  previewContent: string;
  selectedCount: number;
  outputPath: string;
  stdout: boolean;
  failureNames: string[];
  previewError: string | null;
}

export function PreviewStep({
  previewStatus,
  previewContent,
  selectedCount,
  outputPath,
  stdout,
  failureNames,
  previewError,
}: PreviewStepProps) {
  return (
    <box
      border
      borderColor={C.dimBorder}
      title="Preview + Generate"
      padding={1}
      flexDirection="column"
      flexGrow={1}
      overflow="hidden"
    >
      <text>
        <span fg={C.green}>{`${selectedCount}`}</span>
        <span fg={C.dim}>{" template(s) selected | Output: "}</span>
        <span fg={C.accent}>{stdout ? "stdout" : outputPath}</span>
      </text>

      {previewStatus === "idle" ? (
        <text fg={C.yellow} content="Preparing preview..." />
      ) : null}
      {previewStatus === "loading" ? (
        <text fg={C.yellow} content="Fetching selected templates..." />
      ) : null}
      {previewStatus === "error" ? (
        <box flexDirection="column">
          <text fg={C.red} content={previewError ?? "Preview failed."} />
          {failureNames.length > 0 ? (
            <text fg={C.redSoft} content={`Failed: ${failureNames.join(", ")}`} />
          ) : null}
          <text fg={C.dim} content="Enter to retry | Backspace to go back" />
        </box>
      ) : null}

      {previewStatus === "ready" ? (
        <box marginTop={1} flexDirection="column" flexGrow={1} overflow="hidden">
          <text fg={C.dim} flexShrink={0}
            content={`Enter to generate | Backspace to go back | \u2191/\u2193 scroll`}
          />
          <scrollbox focused flexGrow={1} marginTop={1}>
            {previewContent.split("\n").map((line, i) => {
              const trimmed = line.trim();
              const isSectionHeader = trimmed.startsWith("###");
              const isComment = trimmed.startsWith("#");
              const fg = isSectionHeader ? C.accent : isComment ? C.dim : undefined;
              return <text key={`l-${i}`} fg={fg} content={line.length === 0 ? " " : line} />;
            })}
          </scrollbox>
        </box>
      ) : null}
    </box>
  );
}
