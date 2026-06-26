import "katex/dist/katex.min.css";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { DiagramBlock } from "./DiagramBlock";
import { cn } from "@/lib/utils";

interface Props {
  children: string;
  className?: string;
}

/**
 * The single AI render path for the entire app.
 * Renders markdown + GFM tables + KaTeX (inline & block) + Mermaid diagrams.
 * Every AI surface (chat, lesson notes, whiteboard overlays, content library)
 * pipes through this so LaTeX + diagrams "just work" everywhere.
 */
export function SmartMarkdown({ children, className }: Props) {
  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none break-words",
        "prose-pre:bg-muted/60 prose-pre:text-foreground",
        "prose-code:before:content-none prose-code:after:content-none",
        "prose-headings:scroll-mt-20",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false, output: "html" }]]}
        components={{
          code(props) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { inline, className: cls, children: kids, ...rest } = props as any;
            const match = /language-(\w+)/.exec(cls || "");
            const lang = match?.[1];
            const value = String(kids ?? "").replace(/\n$/, "");

            if (!inline && lang === "mermaid") {
              return <DiagramBlock spec={value} />;
            }
            if (inline) {
              return (
                <code className="rounded bg-muted px-1 py-0.5 text-[0.9em]" {...rest}>
                  {kids}
                </code>
              );
            }
            return (
              <pre className="overflow-x-auto rounded-md border bg-muted/60 p-3 text-sm">
                <code className={cls} {...rest}>
                  {kids}
                </code>
              </pre>
            );
          },
          a(props) {
            return (
              <a
                {...props}
                target="_blank"
                rel="noreferrer noopener"
                className="text-primary underline-offset-2 hover:underline"
              />
            );
          },
          table(props) {
            return (
              <div className="my-3 overflow-x-auto rounded-md border">
                <table {...props} className="w-full text-sm" />
              </div>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
