import React from 'react';
import { AlertCircle, CheckCircle2, ShieldAlert, Sprout, AlertOctagon } from 'lucide-react';

interface MarkdownViewProps {
  content: string;
  className?: string;
}

type BlockType =
  | { type: 'heading'; level: number; content: string }
  | { type: 'bullet-list'; items: string[] }
  | { type: 'numbered-list'; items: string[] }
  | { type: 'blockquote'; content: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'paragraph'; content: string };

/**
 * Parses inline markdown: **bold**, *italic*, and `code`.
 */
function renderInline(text: string): React.ReactNode[] {
  if (!text) return [];

  // Match bold (**...**), italic (*...*), and code (`...`)
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (!part) return null;

    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      const boldContent = part.slice(2, -2);
      // Special evidence badge check
      if (boldContent.includes('Evidence Status') || boldContent.includes('प्रमाण स्थिति')) {
        return (
          <span
            key={index}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
            {boldContent}
          </span>
        );
      }
      if (boldContent.includes('Caution') || boldContent.includes('सावधानी')) {
        return (
          <span
            key={index}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
            {boldContent}
          </span>
        );
      }
      return (
        <strong key={index} className="font-bold text-emerald-950">
          {boldContent}
        </strong>
      );
    }

    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return (
        <em key={index} className="italic text-gray-800">
          {part.slice(1, -1)}
        </em>
      );
    }

    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={index}
          className="bg-emerald-50 border border-emerald-200/80 text-emerald-800 px-1.5 py-0.5 rounded text-xs font-mono"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    return <span key={index}>{part}</span>;
  });
}

function parseBlocks(rawText: string): BlockType[] {
  const lines = rawText.split(/\r?\n/);
  const blocks: BlockType[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // 1. Table Detection (starts and ends with '|')
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        const splitRow = (rowStr: string) =>
          rowStr
            .slice(1, -1)
            .split('|')
            .map((cell) => cell.trim());

        const headers = splitRow(tableLines[0]);
        const dataRows: string[][] = [];

        // Check if second row is separator like | --- | --- |
        let startIndex = 1;
        if (tableLines[1].replace(/[\s|:-]/g, '') === '') {
          startIndex = 2;
        }

        for (let r = startIndex; r < tableLines.length; r++) {
          dataRows.push(splitRow(tableLines[r]));
        }

        blocks.push({ type: 'table', headers, rows: dataRows });
        continue;
      }
    }

    // 2. Headings (#, ##, ###, ####)
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        content: headingMatch[2],
      });
      i++;
      continue;
    }

    // 3. Blockquote (> ...)
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s*/, ''));
        i++;
      }
      blocks.push({
        type: 'blockquote',
        content: quoteLines.join(' '),
      });
      continue;
    }

    // 4. Numbered list (1. ...)
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ type: 'numbered-list', items });
      continue;
    }

    // 5. Bullet list (-, *, •)
    if (/^[-*•]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*•]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'bullet-list', items });
      continue;
    }

    // 6. Regular Paragraph
    const paragraphLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('>') &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !/^[-*•]\s+/.test(lines[i].trim()) &&
      !(lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|'))
    ) {
      paragraphLines.push(lines[i].trim());
      i++;
    }
    blocks.push({
      type: 'paragraph',
      content: paragraphLines.join(' '),
    });
  }

  return blocks;
}

export const MarkdownView: React.FC<MarkdownViewProps> = ({ content, className = '' }) => {
  const blocks = parseBlocks(content);

  return (
    <div className={`space-y-3 text-sm sm:text-base leading-relaxed text-gray-900 ${className}`}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'heading': {
            const isInvalidHeading = block.content.includes('INVALID');
            if (block.level <= 3) {
              return (
                <h3
                  key={idx}
                  className={`text-base sm:text-lg font-bold pt-2 pb-1 border-b flex items-center gap-2 ${
                    isInvalidHeading
                      ? 'text-red-950 border-red-200'
                      : 'text-emerald-950 border-emerald-100'
                  }`}
                >
                  {isInvalidHeading ? (
                    <AlertOctagon className="w-5 h-5 text-red-600 flex-shrink-0" />
                  ) : (
                    <Sprout className="w-5 h-5 text-emerald-700 flex-shrink-0" />
                  )}
                  <span>{renderInline(block.content)}</span>
                </h3>
              );
            }
            return (
              <h4
                key={idx}
                className="text-sm sm:text-base font-bold text-emerald-900 pt-1.5 flex items-center gap-1.5"
              >
                <span>{renderInline(block.content)}</span>
              </h4>
            );
          }

          case 'bullet-list': {
            return (
              <ul key={idx} className="space-y-1.5 my-2 pl-1">
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="flex items-start gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 flex-shrink-0 mt-2" />
                    <span className="text-gray-800 flex-1 leading-relaxed">{renderInline(item)}</span>
                  </li>
                ))}
              </ul>
            );
          }

          case 'numbered-list': {
            return (
              <ol key={idx} className="space-y-2 my-2 pl-1">
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5 shadow-2xs">
                      {itemIdx + 1}
                    </span>
                    <span className="text-gray-800 flex-1 leading-relaxed">{renderInline(item)}</span>
                  </li>
                ))}
              </ol>
            );
          }

          case 'blockquote': {
            const isCaution =
              block.content.toLowerCase().includes('caution') ||
              block.content.includes('सावधानी') ||
              block.content.includes('महत्वपूर्ण');

            return (
              <div
                key={idx}
                className={`my-2.5 p-3.5 rounded-2xl text-xs sm:text-sm flex items-start gap-3 border shadow-2xs ${
                  isCaution
                    ? 'bg-amber-50/90 border-amber-300/80 text-amber-950'
                    : 'bg-emerald-50/70 border-emerald-200/80 text-emerald-950'
                }`}
              >
                {isCaution ? (
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="leading-relaxed flex-1">{renderInline(block.content)}</div>
              </div>
            );
          }

          case 'table': {
            return (
              <div key={idx} className="my-3 overflow-x-auto rounded-2xl border border-emerald-200 shadow-2xs">
                <table className="w-full text-xs sm:text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-emerald-100/80 text-emerald-950 border-b border-emerald-200">
                      {block.headers.map((h, hIdx) => (
                        <th key={hIdx} className="px-3.5 py-2.5 font-bold">
                          {renderInline(h)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className={`border-b border-emerald-100/60 hover:bg-emerald-50/50 transition-colors ${
                          rIdx % 2 === 0 ? 'bg-white' : 'bg-emerald-50/30'
                        }`}
                      >
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="px-3.5 py-2 text-gray-800">
                            {renderInline(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }

          case 'paragraph': {
            return (
              <p key={idx} className="text-gray-800 leading-relaxed">
                {renderInline(block.content)}
              </p>
            );
          }

          default:
            return null;
        }
      })}
    </div>
  );
};

export default MarkdownView;
