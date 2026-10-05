import { Fragment, type ReactNode } from "react";

interface MarkdownLiteProps {
  children: string;
  className?: string;
}

const inlinePattern = /(`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_)/g;

const renderInline = (text: string): ReactNode[] =>
  text.split(inlinePattern).filter(Boolean).map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">{part.slice(1, -1)}</code>;
    }
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) {
      return <strong key={index}>{renderInline(part.slice(2, -2))}</strong>;
    }
    if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) {
      return <em key={index}>{renderInline(part.slice(1, -1))}</em>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });

const MarkdownLite = ({ children, className = "" }: MarkdownLiteProps) => {
  const lines = children.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];

  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const content = renderInline(heading[2]);
      const headingClass = "font-semibold leading-snug";
      if (heading[1].length === 1) blocks.push(<h1 key={index} className={`${headingClass} text-lg`}>{content}</h1>);
      if (heading[1].length === 2) blocks.push(<h2 key={index} className={`${headingClass} text-base`}>{content}</h2>);
      if (heading[1].length === 3) blocks.push(<h3 key={index} className={`${headingClass} text-sm`}>{content}</h3>);
      index += 1;
      continue;
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      const listItems: ReactNode[] = [];
      const listType = unordered ? "unordered" : "ordered";
      while (index < lines.length) {
        const match = listType === "unordered"
          ? lines[index].match(/^\s*[-*]\s+(.+)$/)
          : lines[index].match(/^\s*\d+[.)]\s+(.+)$/);
        if (!match) break;
        listItems.push(<li key={index}>{renderInline(match[1])}</li>);
        index += 1;
      }
      blocks.push(listType === "unordered"
        ? <ul key={`list-${index}`} className="list-disc space-y-1 pl-5">{listItems}</ul>
        : <ol key={`list-${index}`} className="list-decimal space-y-1 pl-5">{listItems}</ol>);
      continue;
    }

    const paragraphLines = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim()
      && !/^(#{1,3})\s+/.test(lines[index])
      && !/^\s*(?:[-*]|\d+[.)])\s+/.test(lines[index])) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }
    blocks.push(<p key={`paragraph-${index}`}>{renderInline(paragraphLines.join(" "))}</p>);
  }

  return <div className={`space-y-2 text-sm leading-relaxed ${className}`.trim()}>{blocks}</div>;
};

export default MarkdownLite;
