import React from 'react';

interface MarkdownViewProps {
  content: string;
  className?: string;
}

/**
 * Renders formatted agricultural advice markdown with crisp typography,
 * bold headers, styled bullet lists, and paragraphs matching the Loumi chat UI design.
 */
export default function MarkdownView({ content, className = '' }: MarkdownViewProps) {
  const blocks = parseMarkdownBlocks(content);

  return (
    <div className={`space-y-3 text-sm sm:text-[15px] leading-relaxed text-forest-950 ${className}`}>
      {blocks.map((block, idx) => {
        if (block.type === 'heading') {
          const Tag = (block.level === 1 ? 'h2' : block.level === 2 ? 'h3' : 'h4') as 'h2' | 'h3' | 'h4';
          const sizeClass =
            block.level === 1
              ? 'text-lg font-bold text-forest-900 mt-2 mb-1'
              : block.level === 2
              ? 'text-base font-semibold text-forest-900 mt-2 mb-1'
              : 'text-sm font-semibold text-forest-900 mt-1.5 mb-1';
          return (
            <Tag key={idx} className={sizeClass}>
              {renderInline(block.content)}
            </Tag>
          );
        }

        if (block.type === 'bullet-list') {
          return (
            <ul key={idx} className="space-y-2.5 my-2.5 pl-0">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx} className="flex items-start gap-2.5 text-forest-900">
                  <span className="select-none text-forest-600 font-bold text-base leading-none mt-1 shrink-0">
                    •
                  </span>
                  <div className="flex-1 leading-relaxed">
                    {renderInline(item)}
                  </div>
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === 'numbered-list') {
          return (
            <ol key={idx} className="space-y-2.5 my-2.5 pl-0">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx} className="flex items-start gap-2 text-forest-900">
                  <span className="select-none font-semibold text-forest-700 text-sm mt-0.5 shrink-0 min-w-[1.25rem]">
                    {itemIdx + 1}.
                  </span>
                  <div className="flex-1 leading-relaxed">
                    {renderInline(item)}
                  </div>
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === 'blockquote') {
          return (
            <blockquote
              key={idx}
              className="border-l-4 border-forest-300 bg-forest-50/60 pl-3.5 py-1.5 rounded-r-lg my-2 text-forest-800 italic"
            >
              {renderInline(block.content)}
            </blockquote>
          );
        }

        // Standard paragraph
        return (
          <p key={idx} className="leading-relaxed">
            {renderInline(block.content)}
          </p>
        );
      })}
    </div>
  );
}

type MarkdownBlock =
  | { type: 'paragraph'; content: string }
  | { type: 'heading'; level: number; content: string }
  | { type: 'bullet-list'; items: string[] }
  | { type: 'numbered-list'; items: string[] }
  | { type: 'blockquote'; content: string };

function parseMarkdownBlocks(text: string): MarkdownBlock[] {
  if (!text) return [];

  const rawLines = text.split(/\r?\n/);
  const blocks: MarkdownBlock[] = [];
  let currentList: { type: 'bullet-list' | 'numbered-list'; items: string[] } | null = null;
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length > 0) {
      const pText = paragraphBuffer.join(' ').trim();
      if (pText) {
        blocks.push({ type: 'paragraph', content: pText });
      }
      paragraphBuffer = [];
    }
  };

  const flushList = () => {
    if (currentList) {
      blocks.push({ type: currentList.type, items: currentList.items });
      currentList = null;
    }
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    // Check heading: #, ##, ###
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        content: headingMatch[2],
      });
      continue;
    }

    // Check blockquote: >
    if (trimmed.startsWith('>')) {
      flushParagraph();
      flushList();
      blocks.push({
        type: 'blockquote',
        content: trimmed.replace(/^>\s*/, ''),
      });
      continue;
    }

    // Check bullet list: *, -, +, or •
    const bulletMatch = trimmed.match(/^([*\-+•])\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      if (!currentList || currentList.type !== 'bullet-list') {
        flushList();
        currentList = { type: 'bullet-list', items: [] };
      }
      currentList.items.push(bulletMatch[2]);
      continue;
    }

    // Check numbered list: 1., 2., etc.
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      flushParagraph();
      if (!currentList || currentList.type !== 'numbered-list') {
        flushList();
        currentList = { type: 'numbered-list', items: [] };
      }
      currentList.items.push(numberedMatch[2]);
      continue;
    }

    // If we're inside a list and the next line is indented or continuation of item
    if (currentList && (line.startsWith('   ') || line.startsWith('\t'))) {
      const lastIdx = currentList.items.length - 1;
      if (lastIdx >= 0) {
        currentList.items[lastIdx] += ' ' + trimmed;
        continue;
      }
    }

    // Regular line: flush any active list and buffer for paragraph
    flushList();
    paragraphBuffer.push(trimmed);
  }

  flushParagraph();
  flushList();

  return blocks;
}

/**
 * Parses inline formatting like **bold**, *italic*, and `code`.
 */
function renderInline(text?: string): React.ReactNode {
  if (!text) return null;

  // Split tokens by bold (**...** or __...__), italic (*...* or _..._), code (`...`)
  const regex = /(\*\*.*?\*\*|__.*?__|`.*?`|\*.*?\*|_.*?_)/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (!part) return null;

    // Bold **text** or __text__
    if ((part.startsWith('**') && part.endsWith('**') && part.length >= 4) ||
        (part.startsWith('__') && part.endsWith('__') && part.length >= 4)) {
      return (
        <strong key={index} className="font-semibold text-forest-950">
          {part.slice(2, -2)}
        </strong>
      );
    }

    // Inline code `code`
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={index}
          className="rounded bg-forest-100/80 px-1.5 py-0.5 font-mono text-xs text-forest-900 border border-forest-200/50"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // Italic *text* or _text_
    if ((part.startsWith('*') && part.endsWith('*') && part.length >= 2) ||
        (part.startsWith('_') && part.endsWith('_') && part.length >= 2)) {
      return (
        <em key={index} className="italic text-forest-900">
          {part.slice(1, -1)}
        </em>
      );
    }

    // Regular text
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}
