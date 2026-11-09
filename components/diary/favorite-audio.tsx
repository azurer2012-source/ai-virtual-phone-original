"use client";
import { useState } from "react";
import type { FavoriteMessage } from "@/lib/chat-favorites";
import { FavoriteContent } from "./favorite-content";

export function FavoriteAudio({ message }: { message: FavoriteMessage }) {
  const [expanded, setExpanded] = useState(false);
  const text = message.mediaData?.label?.trim() || message.mediaData?.synthesizedFromText?.trim()
    || (/^\[(audio|语音)\]$/i.test(message.content.trim()) ? "" : message.content.trim());
  return <div style={{ margin: "10px 0" }}>
    {message.mediaUrl && <audio controls src={message.mediaUrl} style={{ maxWidth: "100%" }} />}
    <button className="ui-btn" style={{ display: "block", fontSize: 12, marginTop: 8 }} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? "收起文字" : "转文字"}</button>
    {expanded && <FavoriteContent mode="online" text={text || "这条语音未保存文字稿，暂时无法显示文字。"} />}
  </div>;
}
