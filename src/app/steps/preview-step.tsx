const C = {
  accent: "#66b395",
  green: "#66b395",
  yellow: "#e2c97e",
  red: "#e47474",
  redSoft: "#f48484",
  dim: "#999999",
  dimBorder: "#444444",
};

interface PreviewStepProps {
  failureNames: string[];
  outputPath: string;
  previewContent: string;
  previewError: string | null;
  previewStatus: "idle" | "loading" | "ready" | "error";
  selectedCount: number;
  stdout: boolean;
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
      flexDirection="column"
      flexGrow={1}
      overflow="hidden"
      padding={1}
      title="Preview + Generate"
    >
      <text>
        <span fg={C.green}>{`${selectedCount}`}</span>
        <span fg={C.dim}>{" template(s) selected | Output: "}</span>
        <span fg={C.accent}>{stdout ? "stdout" : outputPath}</span>
      </text>

      {previewStatus === "idle" ? (
        <text content="Preparing preview..." fg={C.yellow} />
      ) : null}
      {previewStatus === "loading" ? (
        <text content="Fetching selected templates..." fg={C.yellow} />
      ) : null}
      {previewStatus === "error" ? (
        <box flexDirection="column">
          <text content={previewError ?? "Preview failed."} fg={C.red} />
          {failureNames.length > 0 ? (
            <text
              content={`Failed: ${failureNames.join(", ")}`}
              fg={C.redSoft}
            />
          ) : null}
          <text content="Enter to retry | Backspace to go back" fg={C.dim} />
        </box>
      ) : null}

      {previewStatus === "ready" ? (
        <box
          flexDirection="column"
          flexGrow={1}
          marginTop={1}
          overflow="hidden"
        >
          <text
            content={
              "Enter to generate | Backspace to go back | \u2191/\u2193 scroll"
            }
            fg={C.dim}
            flexShrink={0}
          />
          <scrollbox flexGrow={1} focused marginTop={1}>
            {previewContent
              .split("\n")
              .reduce<
                Array<{ key: string; line: string; fg: string | undefined }>
              >((rows, line) => {
                const count = rows.length + 1;
                const trimmed = line.trim();
                const isSectionHeader = trimmed.startsWith("###");
                const isComment = trimmed.startsWith("#");
                const content = line.length === 0 ? " " : line;
                let fg: string | undefined;
                if (isSectionHeader) {
                  fg = C.accent;
                } else if (isComment) {
                  fg = C.dim;
                }

                rows.push({
                  key: `${content}-${count}`,
                  line: content,
                  fg,
                });
                return rows;
              }, [])
              .map(({ key, line: rowLine, fg }) => (
                <text content={rowLine} fg={fg} key={key} />
              ))}
          </scrollbox>
        </box>
      ) : null}
    </box>
  );
}
