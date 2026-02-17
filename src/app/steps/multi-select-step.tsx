import { TextAttributes } from "@opentui/core";
import type { TemplateKind, TemplateMeta } from "../../domain/types";

const C = {
  accent: "#66b395",
  green: "#66b395",
  yellow: "#e2c97e",
  dim: "#999999",
  dimBorder: "#444444",
  selectedName: "#f6f6f6",
  badge: {
    language: "#5fb5be",
    framework: "#ed9cc2",
    global: "#e7d38f",
  } as Record<TemplateKind, string>,
};

interface MultiSelectStepProps {
  cursor: number;
  items: TemplateMeta[];
  searchQuery: string;
  selectedCount: number;
  selectedIds: Set<string>;
  terminalHeight: number;
  terminalWidth: number;
  totalItems: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

const KIND_LABEL: Record<TemplateKind, string> = {
  language: "lang",
  framework: "fw",
  global: "global",
};

export function filterItems(
  items: TemplateMeta[],
  query: string
): TemplateMeta[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) {
    return items;
  }
  return items.filter((t) => {
    const haystack = `${t.name} ${t.id} ${t.path} ${t.kind}`.toLowerCase();
    return haystack.includes(q);
  });
}

function truncate(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  if (max <= 3) {
    return value.slice(0, max);
  }
  return `${value.slice(0, max - 3)}...`;
}

export function MultiSelectStep({
  items,
  totalItems,
  selectedCount,
  cursor,
  selectedIds,
  terminalHeight,
  terminalWidth,
  searchQuery,
}: MultiSelectStepProps) {
  const maxVisible = Math.max(3, terminalHeight - 21);
  const maxLineWidth = Math.max(20, terminalWidth - 8);

  const start = clamp(
    cursor - Math.floor(maxVisible / 2),
    0,
    Math.max(0, items.length - maxVisible)
  );
  const end = Math.min(items.length, start + maxVisible);
  const visibleItems = items.slice(start, end);

  function layoutItem(
    prefix: string,
    checkbox: string,
    name: string,
    kind: TemplateKind
  ) {
    const badge = KIND_LABEL[kind];
    const left = `${prefix} ${checkbox} ${name}`;
    // badge rendered as "lang" / "fw" / "global" - no brackets to keep it clean
    const availableForLeft = maxLineWidth - badge.length - 1;

    let truncatedLeft: string;
    if (left.length <= availableForLeft) {
      truncatedLeft = left;
    } else if (availableForLeft <= 3) {
      truncatedLeft = left.slice(0, availableForLeft);
    } else {
      truncatedLeft = `${left.slice(0, availableForLeft - 3)}...`;
    }

    const gap = maxLineWidth - truncatedLeft.length - badge.length;
    const padding = " ".repeat(Math.max(1, gap));
    return { truncatedLeft, badge, padding };
  }

  const countText = `${items.length}/${totalItems} templates`;

  return (
    <box
      border
      borderColor={C.dimBorder}
      flexDirection="column"
      flexGrow={1}
      overflow="hidden"
      padding={1}
      title="Select Templates"
    >
      {/* Search bar */}
      <text>
        <span fg={C.dim}>{"Search: "}</span>
        {searchQuery.length > 0 ? (
          <span attributes={TextAttributes.BOLD} fg={C.yellow}>
            {truncate(searchQuery, maxLineWidth - 8)}
          </span>
        ) : (
          <span fg={C.dim}>{"(type to filter)"}</span>
        )}
      </text>

      {/* Counts */}
      <text>
        <span fg={C.dim}>{countText}</span>
        <span
          fg={selectedCount > 0 ? C.green : C.dim}
        >{` | ${selectedCount} selected`}</span>
      </text>

      {/* Keys help - use content prop for plain dim text */}
      <text
        content={truncate(
          "\u2191/\u2193 move \u2022 type search \u2022 Space toggle \u2022 Enter confirm \u2022 Bksp del \u2022 ^R refresh",
          maxLineWidth
        )}
        fg={C.dim}
      />

      {/* Item list */}
      <box flexDirection="column" flexGrow={1} marginTop={1} overflow="hidden">
        {items.length === 0 ? (
          <text content="No templates match your search." fg={C.dim} />
        ) : (
          visibleItems.map((item, index) => {
            const absoluteIndex = start + index;
            const isCursor = absoluteIndex === cursor;
            const isSelected = selectedIds.has(item.id);
            const prefix = isCursor ? ">" : " ";
            const checkbox = isSelected ? "[x]" : "[ ]";
            const { truncatedLeft, badge, padding } = layoutItem(
              prefix,
              checkbox,
              item.name,
              item.kind
            );

            let nameFg: string | undefined;
            if (isCursor) {
              nameFg = C.green;
            } else if (isSelected) {
              nameFg = C.selectedName;
            }

            return (
              <text
                attributes={isCursor ? TextAttributes.BOLD : undefined}
                key={item.id}
              >
                <span fg={nameFg}>{truncatedLeft}</span>
                <span fg={C.dim}>{padding}</span>
                <span attributes={TextAttributes.DIM} fg={C.badge[item.kind]}>
                  {badge}
                </span>
              </text>
            );
          })
        )}
      </box>

      {/* Scroll indicator */}
      {items.length > maxVisible ? (
        <text
          content={`Showing ${start + 1}-${end} of ${items.length}`}
          fg={C.dim}
        />
      ) : null}
    </box>
  );
}
