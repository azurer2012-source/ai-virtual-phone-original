import { kvGet, kvSetAsync, registerKvMigration } from "./kv-db";
import type { ChatMessage } from "./chat-storage";
import { isMediaStoreRef, loadMediaBlob } from "./media-cache-storage";

export const CHAT_FAVORITES_KEY = "ai_phone_chat_favorites_v1";
export const CHAT_FAVORITES_UPDATED = "chat-favorites-updated";
registerKvMigration(CHAT_FAVORITES_KEY);
export type FavoriteMessage = Pick<ChatMessage, "id" | "role" | "content" | "createdAt" | "mediaType" | "mediaData" | "mediaUrl"> & { senderName: string };
export type ChatFavorite = { id: string; createdAt: string; sessionId: string; folderId?: string; title: string; mode: "online" | "offline"; messages: FavoriteMessage[] };

export function groupChatFavorites(items: ChatFavorite[], legacyFolder: (sessionId: string) => string | undefined) {
  const groups = new Map<string, { id: string; title: string; items: ChatFavorite[] }>();
  for (const item of items) {
    const id = item.folderId || legacyFolder(item.sessionId) || `session:${item.sessionId}`;
    let group = groups.get(id);
    if (!group) { group = { id, title: item.title, items: [] }; groups.set(id, group); }
    group.items.push(item);
  }
  return [...groups.values()];
}

export function loadChatFavorites(): ChatFavorite[] {
  try {
    const value: unknown = JSON.parse(kvGet(CHAT_FAVORITES_KEY) || "[]");
    return Array.isArray(value) ? value.filter((v): v is ChatFavorite => v && typeof v.id === "string" && typeof v.title === "string" && Array.isArray(v.messages)) : [];
  } catch { return []; }
}
async function persist(items: ChatFavorite[]) {
  await kvSetAsync(CHAT_FAVORITES_KEY, JSON.stringify(items));
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHAT_FAVORITES_UPDATED));
}
export async function addChatFavorite(input: Omit<ChatFavorite, "id" | "createdAt">): Promise<void> {
  if (!input.messages.length) throw new Error("请先选择消息");
  const item = structuredClone({ ...input, id: `favorite_${crypto.randomUUID()}`, createdAt: new Date().toISOString() });
  for (const message of item.messages) {
    if (!message.mediaUrl || !isMediaStoreRef(message.mediaUrl)) continue;
    const media = await loadMediaBlob(message.mediaUrl);
    if (!media) throw new Error("原消息附件已丢失");
    message.mediaUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(media.blob);
    });
  }
  await persist([item, ...loadChatFavorites()]);
}
export async function removeChatFavorite(id: string): Promise<void> {
  await persist(loadChatFavorites().filter(item => item.id !== id));
}
