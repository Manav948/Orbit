import type { ReactNode } from "react";

const inlinePattern = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*]+\*)/g;

function renderInline(text: string): ReactNode[] {
  return text.split(inlinePattern).filter(Boolean).map((part, index) => {
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index} className="rounded bg-black/20 px-1 text-amber-200">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function parseTableCells(line: string): string[] {
  return line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
}

function isTableDivider(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-{2,}:?$/.test(cell));
}

function isTableHeader(cells: string[]): boolean {
  return cells.some((cell) => /^(source|publisher|title|details|summary|topic|headline)$/i.test(cell));
}

export function AnswerContent({ content }: { content: string }) {
  const lines = content
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/\r/g, "")
    .split("\n");
  const nodes: ReactNode[] = [];
  let tableRows: string[][] = [];

  const flushTable = () => {
    if (tableRows.length === 0) return;
    const rows = tableRows.filter((cells) => !isTableDivider(cells));
    const dataRows = isTableHeader(rows[0] ?? []) ? rows.slice(1) : rows;
    nodes.push(
      <div key={`table-${nodes.length}`} className="space-y-1.5 rounded-lg border border-white/[0.08] bg-black/20 p-2">
        {dataRows.map((cells, rowIndex) => (
          <div key={rowIndex} className="rounded-md bg-white/[0.03] px-2 py-1.5">
            {cells.map((cell, cellIndex) => (
              <span key={cellIndex} className={cellIndex === 0 ? "block font-semibold text-amber-200" : "block text-neutral-300"}>
                {renderInline(cell)}
              </span>
            ))}
          </div>
        ))}
      </div>,
    );
    tableRows = [];
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (/^\|.*\|$/.test(line)) {
      tableRows.push(parseTableCells(line));
      return;
    }
    flushTable();
    if (!line) return;

    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      nodes.push(<h3 key={index} className="pt-1 font-semibold text-white">{renderInline(heading[1])}</h3>);
      return;
    }
    const bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.+)$/);
    if (bullet) {
      nodes.push(
        <p key={index} className="pl-3 before:mr-2 before:text-amber-300 before:content-['•']">
          {renderInline(bullet[1])}
        </p>,
      );
      return;
    }
    nodes.push(<p key={index}>{renderInline(line)}</p>);
  });
  flushTable();

  return <div className="space-y-1.5">{nodes}</div>;
}
