"use client";
import { useEffect, useState } from "react";
import { Bookmark, ChevronLeft } from "lucide-react";
import { CHAT_FAVORITES_UPDATED, groupChatFavorites, loadChatFavorites, removeChatFavorite, type ChatFavorite } from "@/lib/chat-favorites";
import { loadChatContacts, loadChatSessions } from "@/lib/chat-storage";
import { loadCharacters } from "@/lib/character-storage";
import { FavoriteContent, favoritePreview } from "./favorite-content";
import { FavoriteAudio } from "./favorite-audio";

export function ChatFavoritesApp({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<ChatFavorite[]>([]);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [selected, setSelected] = useState<ChatFavorite | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const refresh = () => setItems(loadChatFavorites());
    refresh(); window.addEventListener(CHAT_FAVORITES_UPDATED, refresh);
    return () => window.removeEventListener(CHAT_FAVORITES_UPDATED, refresh);
  }, []);
  const sessions = loadChatSessions();
  const characters = loadCharacters();
  const contacts = loadChatContacts();
  const bookCharacter = (book: { id: string; items: ChatFavorite[] }) => {
    const session = sessions.find(s => s.id === book.items[0]?.sessionId);
    if (session?.isGroup || book.id.startsWith("group:")) return undefined;
    const contactId = session?.contactId || (book.id.startsWith("character:") ? book.id.slice(10) : "");
    const characterId = contacts.find(c => c.id === contactId)?.characterId || contactId;
    return characters.find(c => c.id === characterId);
  };
  const folders = groupChatFavorites(items, id => {
    const session = sessions.find(s => s.id === id);
    return session ? session.isGroup ? `group:${session.id}` : `character:${session.contactId}` : undefined;
  });
  const folder = folders.find(f => f.id === folderId);
  const back = () => { setError(""); if (selected) setSelected(null); else if (folderId) setFolderId(null); else onBack(); };
  return <section className="diary-app chat-favorites-app">
    <header className="diary-app-header"><button className="diary-icon-btn" onClick={back} aria-label="返回"><ChevronLeft size={20} /></button><div><h1>{selected ? "收藏详情" : folder ? folder.title : "收藏"}</h1><p>{selected ? `${selected.messages.length} 条消息 · ${selected.mode === "offline" ? "线下" : "线上"}` : folder ? `共 ${folder.items.length} 条收藏` : "先选角色，再翻阅收藏"}</p></div><span className="diary-header-spacer" /></header>
    <main className="diary-entry-main">
      {error && <p role="alert">{error}</p>}
      {selected ? <div style={{ padding: 12 }}><h2>{selected.title}</h2>{selected.messages.map((message, i) => <article key={`${message.id}-${i}`} style={{ margin: "18px 0", padding: 16, borderRadius: 12, background: "var(--c-card, #fff)" }}>
        <strong style={{ fontSize: "calc(12px * var(--app-text-scale, 1))" }}>{message.senderName}</strong>{message.mediaType !== "audio" && <FavoriteContent mode={selected.mode} text={message.content || (message.mediaType ? `[${message.mediaType}]` : "（空消息）")} />}
        {message.mediaUrl && message.mediaType === "image" && <img src={message.mediaUrl} alt="收藏的图片" style={{ maxWidth: "100%", borderRadius: 8 }} />}
        {message.mediaType === "sticker" && message.mediaData?.stickerUrl && <img src={message.mediaData.stickerUrl} alt={message.mediaData.label || "表情"} style={{ maxWidth: 180 }} />}
        {message.mediaType === "audio" && <FavoriteAudio message={message} />}
        {message.mediaUrl && message.mediaType === "video" && <video controls src={message.mediaUrl} style={{ maxWidth: "100%" }} />}
        <small style={{ fontSize: "calc(11px * var(--app-text-scale, 1))", opacity: 0.65 }}>{new Date(message.createdAt).toLocaleString()}</small>
      </article>)}<button className="ui-btn" onClick={async () => { if (!window.confirm("取消这条收藏？原聊天不会删除。")) return; try { await removeChatFavorite(selected.id); setSelected(null); } catch { setError("取消收藏失败，请重试。"); } }}>取消收藏</button></div> : folder ? <div className="diary-entry-list">
        {folder.items.map(item => <button className="diary-entry-card" key={item.id} onClick={() => { setError(""); setSelected(item); }}>
          <span className="diary-entry-card-kicker">FAVORITE</span><strong>{item.title}</strong><span className="diary-entry-card-text">{favoritePreview(item.messages[0]?.content || "媒体消息")}</span><span className="diary-entry-card-meta">{item.messages.length} 条 · {item.mode === "offline" ? "线下" : "线上"} · {new Date(item.createdAt).toLocaleString()}</span>
        </button>)}
      </div> : <>
        {!folders.length && <p className="diary-entry-empty-line">还没有收藏。在聊天气泡菜单中选择“收藏”，也可以多选后合并收藏。</p>}
        <div className="diary-shelf">{[0, 1].map(column => <div className="diary-shelf-column" key={column}>{folders.filter((_, i) => i % 2 === column).map((book, i) => <button key={book.id} type="button" className="diary-book" data-cover={i % 6} onClick={() => { setError(""); setFolderId(book.id); }}>
          <span className="diary-book-spine" aria-hidden="true" /><span className="diary-book-frame" aria-hidden="true" /><span className="diary-book-label"><span className="diary-book-avatar">{bookCharacter(book)?.avatar ? <img src={bookCharacter(book)!.avatar!} alt="" /> : <Bookmark size={20} />}</span><strong>{bookCharacter(book)?.name || book.title}</strong><em>的收藏夹</em></span><span className="diary-book-meta"><span>{book.items.length} 条收藏</span></span>
        </button>)}</div>)}</div>
      </>}
    </main>
  </section>;
}
