"use client";
import { useEffect, useState } from "react";
import DOMPurify from "dompurify";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeRaw from "rehype-raw";
import { favoriteDisplayText } from "@/lib/favorite-display-text";

/** Previews stay plain text; full entries render only sanitized formatting. */
export function favoritePreview(text: string): string {
  return favoriteDisplayText(text).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "").replace(/<br\s*\/?\s*>/gi, "\n").replace(/<\/?[a-z][^>]*>/gi, "").slice(0, 120);
}
export function FavoriteContent({ text, mode }: { text: string; mode: "online" | "offline" }) {
  const [safe, setSafe] = useState("");
  useEffect(() => {
    setSafe(DOMPurify.sanitize(favoriteDisplayText(text), {
      ALLOWED_TAGS: ["span", "div", "p", "br", "strong", "b", "em", "i", "u", "s", "blockquote", "ul", "ol", "li", "pre", "code", "h1", "h2", "h3", "h4", "hr", "a", "table", "thead", "tbody", "tr", "th", "td"],
      ALLOWED_ATTR: ["href", "title"],
    }));
  }, [text]);
  return <div className="chat-markdown chat-favorite-content" style={{ overflowWrap: "anywhere", fontSize: "14px", lineHeight: 1.7, margin: "10px 0" }}><ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} rehypePlugins={[rehypeRaw]}>{safe}</ReactMarkdown></div>;
}
