import { ChatSession, Message } from './api';

export function parseImportText(text: string): ChatSession[] {
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error('JSON 格式不正确。已解析内容须为标准的 JSON 文本。');
  }

  const sessions: ChatSession[] = [];

  // Single chat export format
  if (data.messages && Array.isArray(data.messages)) {
    sessions.push({
      id: data.id || `imported-${Date.now()}`,
      title: data.title || 'Imported Chat',
      messages: data.messages,
      updatedAt: data.updatedAt || Date.now(),
    });
  } 
  // Array of chats format (OpenAI / Gemini json exports)
  else if (Array.isArray(data)) {
    for (const item of data) {
      // OpenAI ChatGPT format (conversations.json)
      if (item.title && item.mapping) {
        const messages: Message[] = [];
        const nodes = Object.values(item.mapping) as any[];
        // Sort by create_time to maintain order
        nodes.sort((a, b) => (a.message?.create_time || 0) - (b.message?.create_time || 0));
        
        for (const node of nodes) {
          const msg = node.message;
          if (msg?.author?.role && msg?.content?.parts && Array.isArray(msg.content.parts)) {
            const role = msg.author.role;
            const contentParts = msg.content.parts.filter((p: any) => typeof p === 'string');
            const content = contentParts.join('\n');
            if (content && (role === 'user' || role === 'assistant')) {
              messages.push({
                id: msg.id || Date.now().toString() + Math.random().toString(36).substring(7),
                role,
                content,
              });
            }
          }
        }
        if (messages.length > 0) {
          sessions.push({
            id: `imported-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            title: item.title,
            messages,
            updatedAt: (item.update_time || item.create_time) ? (item.update_time || item.create_time) * 1000 : Date.now(),
          });
        }
      } 
      // Generic format or Gemini format with "messages" array
      else if (item.messages && Array.isArray(item.messages)) {
        sessions.push({
          id: item.id || `imported-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          title: item.title || 'Imported Chat',
          messages: item.messages,
          updatedAt: item.updatedAt || Date.now()
        });
      }
    }
  }

  if (sessions.length === 0) {
    throw new Error('未在导出的数据中找到有效的对话历史。请确保它是有效的会话 JSON。');
  }

  return sessions;
}

export async function parseImportFile(file: File): Promise<ChatSession[]> {
  const text = await file.text();
  return parseImportText(text);
}
