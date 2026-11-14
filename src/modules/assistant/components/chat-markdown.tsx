"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/** Elemen markdown bergaya gelembung chat (token tema). HTML mentah tidak dirender. */
const components: Components = {
  p: ({ children }) => <p className="break-words [&:not(:first-child)]:mt-2">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  h1: ({ children }) => <h3 className="mt-3 text-sm font-bold first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-3 text-sm font-bold first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-2.5 text-sm font-semibold first:mt-0">{children}</h4>,
  h4: ({ children }) => <h4 className="mt-2.5 text-sm font-semibold first:mt-0">{children}</h4>,
  ul: ({ children }) => <ul className="mt-1.5 list-disc space-y-0.5 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="mt-1.5 list-decimal space-y-0.5 pl-5">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  hr: () => <hr className="border-border my-2.5" />,
  blockquote: ({ children }) => (
    <blockquote className="border-primary/40 bg-secondary/60 mt-2 rounded-r-md border-l-[3px] py-1.5 pr-2 pl-3 text-[13px]">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) =>
    href && /^https?:\/\//i.test(href) ? (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">
        {children}
      </a>
    ) : (
      <span>{children}</span>
    ),
  code: ({ children }) => (
    <code className="bg-secondary rounded px-1 py-0.5 font-mono text-[12px]">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="bg-secondary mt-2 overflow-x-auto rounded-md p-2 text-[12px]">{children}</pre>
  ),
  table: ({ children }) => (
    <div className="border-border mt-2 overflow-x-auto rounded-md border">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-secondary">{children}</thead>,
  th: ({ children, style }) => (
    <th
      style={style}
      className="border-border border-b px-2 py-1.5 text-left font-semibold whitespace-nowrap"
    >
      {children}
    </th>
  ),
  td: ({ children, style }) => (
    <td
      style={style}
      className="border-border border-b px-2 py-1.5 align-top last-of-type:border-b-0"
    >
      {children}
    </td>
  ),
};

export function ChatMarkdown({ content }: { content: string }) {
  return (
    <div className="text-sm leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
