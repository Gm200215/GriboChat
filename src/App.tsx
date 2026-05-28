import { Image, Loader2, Menu, ArrowUp, ArrowDown, Plus, FileUp, Paperclip, X, FileText, Sliders, Settings, Sparkles, Check, Copy, Pencil, Download, ChevronDown, ChevronUp, Square, Link2 } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SettingsModal } from './components/SettingsModal';
import { Sidebar } from './components/Sidebar';
import { APIConfig, ChatSession, generateImage, Message, streamChat } from './lib/api';
import { getBackgroundImage, saveBackgroundImage, clearBackgroundImage, getSessionsFromDB, saveSessionsToDB, getActiveIdFromDB, saveActiveIdToDB } from './lib/bgStorage';
import { parseImportText } from './lib/importExport';

const DEFAULT_CONFIG: APIConfig = {
  baseUrl: 'https://www.gribo.top/v1',
  apiKey: '',
  chatModel: 'gpt-5.5',
  imageModel: 'gpt-image-2',
};

const STORAGE_KEY_CONFIG = 'gribo_config';
const STORAGE_KEY_SESSIONS = 'gribo_sessions';
const STORAGE_KEY_ACTIVE = 'gribo_active_session';

function CodeBlock({ className, children }: { className?: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const lang = match ? match[1] : '';
  const codeContent = String(children || '').replace(/\n$/, '');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code: ', err);
    }
  };

  const isMultiline = codeContent.includes('\n') || !!lang;

  if (isMultiline) {
    return (
      <div className="my-4 rounded-xl overflow-hidden border border-black/5 dark:border-white/10 shadow-md bg-gray-950 text-sm">
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-900 text-xs text-gray-400 select-none border-b border-white/5 font-sans">
          <span className="font-semibold uppercase tracking-wider text-[10px] text-gray-300">{lang || 'code'}</span>
          <button
            onClick={handleCopy}
            className="flex items-center justify-center p-1.5 rounded-lg bg-white/5 hover:bg-white/10 active:bg-white/15 text-gray-300 hover:text-white transition-all cursor-pointer"
            title={copied ? "已复制" : "复制代码"}
          >
            {copied ? (
              <Check size={12} className="text-green-400" strokeWidth={3} />
            ) : (
              <Copy size={12} />
            )}
          </button>
        </div>
        {/* Code Content */}
        <pre className="p-4 overflow-x-auto text-gray-200 max-h-[480px] custom-scrollbar leading-relaxed font-mono">
          <code className={className}>{codeContent}</code>
        </pre>
      </div>
    );
  }

  // Pure inline code
  return (
    <code className="font-mono text-sm px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/15 text-rose-500 dark:text-rose-400 font-medium border border-black/5 dark:border-white/5 break-all">
      {children}
    </code>
  );
}

function extractCommand(text: string): { cleanText: string; imagePrompt?: string } {
  const match = text.match(/\[IMAGINE:\s*(.*?)\]/i);
  if (match) {
    const prompt = match[1];
    const cleanText = text.replace(match[0], '').trim();
    return { cleanText, imagePrompt: prompt };
  }
  return { cleanText: text };
}

function generateNewSession(): ChatSession {
  return {
    id: Date.now().toString(),
    title: '新对话',
    messages: [],
    updatedAt: Date.now()
  };
}

function renderMiniAspectIcon(type: string, active: boolean) {
  const baseColor = active ? 'border-[#7D9878]' : 'border-current/50';
  switch (type) {
    case 'auto':
      return (
        <div className={`w-[13px] h-[13px] border-[1.5px] ${baseColor} rounded-[3px] flex items-center justify-center p-[1px]`}>
          <div className={`w-full h-full border border-dashed ${active ? 'border-[#7D9878]/60' : 'border-current/30'} rounded-[0.5px]`} />
        </div>
      );
    case '1:1':
      return <div className={`w-[13px] h-[13px] border-[1.5px] ${baseColor} rounded-[3px]`} />;
    case '3:4':
      return <div className={`w-[11px] h-[14px] border-[1.5px] ${baseColor} rounded-[2.5px]`} />;
    case '9:16':
      return <div className={`w-[9px] h-[15px] border-[1.5px] ${baseColor} rounded-[2px]`} />;
    case '4:3':
      return <div className={`w-[14px] h-[11px] border-[1.5px] ${baseColor} rounded-[2.5px]`} />;
    case '16:9':
      return <div className={`w-[15px] h-[9px] border-[1.5px] ${baseColor} rounded-[2px]`} />;
    default:
      return null;
  }
}

export default function App() {
  const [config, setConfig] = useState<APIConfig>(DEFAULT_CONFIG);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  
  const [input, setInput] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [typingSessionId, setTypingSessionId] = useState<string | null>(null);
  const isTyping = !!typingSessionId && typingSessionId === activeSessionId;
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Custom states for file attachment & drag & drop
  const [attachments, setAttachments] = useState<Array<{ id: string; name: string; type: 'image' | 'document'; url: string; size: string; content?: string }>>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<{ id: string; name: string; type: 'image' | 'document'; url: string; size: string; content?: string } | null>(null);
  const [bgTheme, setBgTheme] = useState<'light' | 'dark'>('light');
  const [imageSize, setImageSize] = useState<string>(() => {
    return localStorage.getItem('gribo_image_size') || '1024x1024_auto';
  });
  const [imageQuality, setImageQuality] = useState<string>(() => {
    return localStorage.getItem('gribo_image_quality') || 'standard';
  });
  const [imageStyle, setImageStyle] = useState<string>(() => {
    return localStorage.getItem('gribo_image_style') || 'vivid';
  });
  const [isImageSettingsOpen, setIsImageSettingsOpen] = useState(false);

  // States for Global Viewport-Centered Import Modal
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [directJsonText, setDirectJsonText] = useState('');
  const [isUrlImporting, setIsUrlImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'url' | 'text'>('url');

  // State for session deletion confirmation modal
  const [sessionToDeleteId, setSessionToDeleteId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('gribo_image_size', imageSize);
  }, [imageSize]);

  useEffect(() => {
    localStorage.setItem('gribo_image_quality', imageQuality);
  }, [imageQuality]);

  useEffect(() => {
    localStorage.setItem('gribo_image_style', imageStyle);
  }, [imageStyle]);

  // Dynamic Image Brightness analysis to automatically adjust theme
  useEffect(() => {
    if (!config.bgImageUrl) {
      setBgTheme('light');
      return;
    }

    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = config.bgImageUrl;
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, 16, 16);
          const { data } = ctx.getImageData(0, 0, 16, 16);
          let luminanceSum = 0;
          let samples = 0;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            if (a > 50) { // Only count non-transparent pixels
              luminanceSum += (0.299 * r + 0.587 * g + 0.114 * b) / 255;
              samples++;
            }
          }
          const averageLuminance = samples > 0 ? (luminanceSum / samples) : 0.5;
          setBgTheme(averageLuminance > 0.52 ? 'light' : 'dark');
        } else {
          setBgTheme('light');
        }
      } catch (err) {
        console.warn('CORS or Canvas error reading image pixels, falling back to light overlay theme styles:', err);
        setBgTheme('light');
      }
    };
    img.onerror = () => {
      setBgTheme('light');
    };
  }, [config.bgImageUrl]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const imageSettingsTimeoutRef = useRef<any>(null);
  const imageSettingsRef = useRef<HTMLDivElement>(null);

  const [hoveredImageOption, setHoveredImageOption] = useState<string | null>(null);
  const [isSendHovered, setIsSendHovered] = useState(false);
  const [isGenImageHovered, setIsGenImageHovered] = useState(false);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [expandedUserMessageIds, setExpandedUserMessageIds] = useState<Record<string, boolean>>({});
  
  const abortedSessionsRef = useRef<Record<string, boolean>>({});

  const handleStopTyping = () => {
    if (activeSessionId) {
      abortedSessionsRef.current[activeSessionId] = true;
    }
    setTypingSessionId(null);
  };
  
  const handleScroll = () => {
    if (!mainScrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = mainScrollRef.current;
    // Show jump to bottom button if user scrolled > 300px from the bottom
    setShowScrollBottomBtn(scrollHeight - scrollTop - clientHeight > 300);
  };
  const activeSession = sessions.find(s => s.id === activeSessionId);
  const messages = activeSession?.messages || [];

  // Load from local storage and IndexedDB
  useEffect(() => {
    const initApp = async () => {
      try {
        const savedConfig = localStorage.getItem(STORAGE_KEY_CONFIG);
        let parsedConfig: APIConfig;
        if (savedConfig) {
          parsedConfig = JSON.parse(savedConfig);
          // Auto-migrate old default configurations to the new requested models and endpoints
          if (parsedConfig.chatModel === 'gpt-4o' || parsedConfig.chatModel === 'gpt5.5') parsedConfig.chatModel = 'gpt-5.5';
          if (parsedConfig.imageModel === 'dall-e-3' || parsedConfig.imageModel === 'image-2') parsedConfig.imageModel = 'gpt-image-2';
          if (parsedConfig.baseUrl === 'https://www.gribo.top') parsedConfig.baseUrl = 'https://www.gribo.top/v1';
        } else {
          parsedConfig = { ...DEFAULT_CONFIG };
        }
        
        // Retrieve full-resolution uncompressed background image from IndexedDB
        if (parsedConfig.bgImageUrl === 'indexeddb' || parsedConfig.bgImageUrl) {
          const bgData = await getBackgroundImage();
          if (bgData) {
            parsedConfig.bgImageUrl = bgData;
          } else if (parsedConfig.bgImageUrl === 'indexeddb') {
            parsedConfig.bgImageUrl = ''; // fallback if database clean
          }
        }
        setConfig(parsedConfig);

        // Load sessions and active ID from SESSIONS_STORE in IndexedDB, falling back to localStorage
        let loadedSessions: ChatSession[] = await getSessionsFromDB();
        let loadedActiveId: string | null = await getActiveIdFromDB();

        if (!loadedSessions || loadedSessions.length === 0) {
          const savedSessions = localStorage.getItem(STORAGE_KEY_SESSIONS);
          loadedSessions = savedSessions ? JSON.parse(savedSessions) : [];
        }

        if (!loadedActiveId) {
          loadedActiveId = localStorage.getItem(STORAGE_KEY_ACTIVE);
        }

        if (loadedSessions.length > 0) {
          // Filter out old English default messages from loaded sessions
          const cleanedSessions = loadedSessions.map((session: ChatSession) => ({
            ...session,
            messages: session.messages.filter(m => !m.content.includes('Hello! I am Gribo, your creative AI assistant'))
          }));
          setSessions(cleanedSessions);
          
          const targetId = (loadedActiveId && cleanedSessions.some((s: ChatSession) => s.id === loadedActiveId)) ? loadedActiveId : cleanedSessions[0].id;
          const targetSession = cleanedSessions.find((s: ChatSession) => s.id === targetId);
          if (targetSession) {
            setInput(targetSession.draftText || '');
            setAttachments(targetSession.draftAttachments || []);
          }
          setActiveSessionId(targetId);
        } else {
          const newSession = generateNewSession();
          setSessions([newSession]);
          setActiveSessionId(newSession.id);
          setIsSettingsOpen(true);
        }
      } catch (e) {
        console.error('Failed to load state', e);
      }
    };
    initApp();
  }, []);

  // Save config safely without bloating local storage limit
  useEffect(() => {
    try {
      const configToSave = { ...config };
      if (configToSave.bgImageUrl) {
        configToSave.bgImageUrl = 'indexeddb';
      }
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(configToSave));
    } catch (err) {
      console.error('Failed to save state to localStorage', err);
    }
  }, [config]);

  // Save sessions & active session smoothly
  useEffect(() => {
    const saveState = async () => {
      if (sessions.length > 0) {
        // Save using IndexedDB which has ample quota and executes asynchronously.
        await saveSessionsToDB(sessions);
      }
      if (activeSessionId) {
        await saveActiveIdToDB(activeSessionId);
        try {
          localStorage.setItem(STORAGE_KEY_ACTIVE, activeSessionId);
        } catch (e) {
          console.warn('LocalStorage quota exceeded. ActiveSessionID saved in IndexedDB!', e);
        }
      }
    };
    saveState();
  }, [sessions, activeSessionId]);

  // Click outside to close aspect ratio popover
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (imageSettingsRef.current && !imageSettingsRef.current.contains(event.target as Node)) {
        setIsImageSettingsOpen(false);
      }
    }
    if (isImageSettingsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isImageSettingsOpen]);

  // Auto-resize textarea when text content changes
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; // Reset height
      const scrollHeight = textareaRef.current.scrollHeight;
      // We set height dynamically, with a lower bound of 40px and higher bound of 320px
      textareaRef.current.style.height = `${Math.max(40, Math.min(scrollHeight, 320))}px`;
    }
  }, [input]);

  const handleFiles = (files: FileList) => {
    Array.from(files).forEach(file => {
      const id = Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
      const sizeStr = file.size > 1024 * 1024 
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
        : `${(file.size / 1024).toFixed(0)} KB`;

      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setAttachments(prev => [...prev, {
            id,
            name: file.name,
            type: 'image',
            url: e.target?.result as string,
            size: sizeStr
          }]);
        };
        reader.readAsDataURL(file);
      } else {
        // Check if it's text-based
        const isText = file.type.startsWith('text/') || 
                       file.name.endsWith('.md') || 
                       file.name.endsWith('.json') || 
                       file.name.endsWith('.js') || 
                       file.name.endsWith('.ts') || 
                       file.name.endsWith('.tsx') || 
                       file.name.endsWith('.csv') || 
                       file.name.endsWith('.xml') ||
                       file.name.endsWith('.css');
                       
        if (isText) {
          const reader = new FileReader();
          reader.onload = (e) => {
            setAttachments(prev => [...prev, {
              id,
              name: file.name,
              type: 'document',
              url: '',
              size: sizeStr,
              content: e.target?.result as string
            }]);
          };
          reader.readAsText(file);
        } else {
          // General fallback metadata-only
          setAttachments(prev => [...prev, {
            id,
            name: file.name,
            type: 'document',
            url: '',
            size: sizeStr,
            content: `[文件: ${file.name} | 大小: ${sizeStr}]`
          }]);
        }
      }
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we are actually leaving the viewport
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const updateSessionMessages = (sessionId: string, newMessages: Message[]) => {
    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        // Auto-generate title from first user message if it's "New Conversation"
        let title = s.title;
        if (title === '新对话' && newMessages.length > 1) {
          const firstUserMsg = newMessages.find(m => m.role === 'user');
          if (firstUserMsg) {
            title = firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '');
          }
        }
        return { ...s, messages: newMessages, title, updatedAt: Date.now() };
      }
      return s;
    }));
  };

  const selectSession = (id: string) => {
    if (id === activeSessionId) return;

    // Save drafts of the old session
    if (activeSessionId) {
      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          return { ...s, draftText: input, draftAttachments: attachments };
        }
        return s;
      }));
    }

    // Load drafts of the new session
    const targetSession = sessions.find(s => s.id === id);
    setInput(targetSession?.draftText || '');
    setAttachments(targetSession?.draftAttachments || []);
    setActiveSessionId(id);

    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const handleNewSession = () => {
    // Save draft of current active session
    if (activeSessionId) {
      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          return { ...s, draftText: input, draftAttachments: attachments };
        }
        return s;
      }));
    }

    const newSession = generateNewSession();
    setSessions(prev => [newSession, ...prev]);
    
    // Clear draft states for the new session
    setInput('');
    setAttachments([]);
    setActiveSessionId(newSession.id);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const handleDeleteSession = (id: string) => {
    setSessionToDeleteId(id);
  };

  const confirmDeleteSession = () => {
    if (!sessionToDeleteId) return;
    const id = sessionToDeleteId;
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== id);
      if (filtered.length === 0) {
        const newSession = generateNewSession();
        setInput('');
        setAttachments([]);
        setActiveSessionId(newSession.id);
        return [newSession];
      }
      if (activeSessionId === id) {
        // Load the drafts of the first available session that will become active
        const nextSession = filtered[0];
        setInput(nextSession.draftText || '');
        setAttachments(nextSession.draftAttachments || []);
        setActiveSessionId(nextSession.id);
      }
      return filtered;
    });
    setSessionToDeleteId(null);
  };

  // Automatically synchronize typing and document draft updates to the active session list on changes (debounced by 350ms to completely resolve keyboard input stuttering)
  useEffect(() => {
    if (!activeSessionId) return;
    const timer = setTimeout(() => {
      setSessions(prev => {
        const current = prev.find(s => s.id === activeSessionId);
        // Only trigger a state change if drafts are physically different to avoid rendering iterations
        const hasTextChanged = current && current.draftText !== input;
        const hasAttachmentsChanged = current && JSON.stringify(current.draftAttachments || []) !== JSON.stringify(attachments);
        
        if (current && (hasTextChanged || hasAttachmentsChanged)) {
          return prev.map(s => s.id === activeSessionId ? { ...s, draftText: input, draftAttachments: attachments } : s);
        }
        return prev;
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [input, attachments, activeSessionId]);

  const handleRenameSession = (id: string, newTitle: string) => {
    setSessions(prev =>
      prev.map(s => (s.id === id ? { ...s, title: newTitle, updatedAt: Date.now() } : s))
    );
  };

  const handleTogglePinSession = (id: string) => {
    setSessions(prev =>
      prev.map(s => (s.id === id ? { ...s, isPinned: !s.isPinned, updatedAt: Date.now() } : s))
    );
  };

  const extractJsonFromText = (text: string): string | null => {
    // Look for JSON arrays or objects containing chat data inside HTML/scripts
    const arrayMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (arrayMatch) return arrayMatch[0];
    
    // Check if there is an object with mapping or messages
    const messageMatch = text.match(/\{\s*"messages"\s*:[\s\S]*\}/);
    if (messageMatch) return messageMatch[0];

    const mappingMatch = text.match(/\{\s*"title"\s*:[\s\S]*"mapping"\s*:[\s\S]*\}/);
    if (mappingMatch) return mappingMatch[0];
    
    return null;
  };

  const triggerAutomaticSummary = async (sessionId: string, initialMessages: Message[]) => {
    setTypingSessionId(sessionId);
    const assistantId = `summary-${Date.now()}`;
    
    // Create an empty assistant message with isGenerating: true
    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        return {
          ...s,
          messages: [
            ...s.messages,
            { id: assistantId, role: 'assistant' as const, content: '', isGenerating: true }
          ]
        };
      }
      return s;
    }));

    if (!config.apiKey) {
      setSessions(prev => prev.map(s => {
        if (s.id === sessionId) {
          return {
            ...s,
            messages: s.messages.map(m => m.id === assistantId ? {
              ...m,
              content: '✨ **对话历史载入成功！**\n\n您的对话历史已成功拼入当前上下文，**记忆载入完成**。\n\n⚠️ *检测到您尚未在右上角「设置」中配置有效的 API Key，因此未能运行 AI 自动记忆复刻。等您配置好 API Key 并输入任何新消息后，助手便会自动联系此前所有的对话记忆为您服务！*',
              isGenerating: false
            } : m)
          };
        }
        return s;
      }));
      setTypingSessionId(null);
      return;
    }

    try {
      let accumulatedText = '';
      const stream = streamChat(initialMessages, config);
      for await (const chunk of stream) {
        if (abortedSessionsRef.current[sessionId]) {
          break;
        }
        accumulatedText += chunk;
        setSessions(prev => prev.map(s => {
          if (s.id === sessionId) {
            return {
              ...s,
              messages: s.messages.map(m => m.id === assistantId ? { ...m, content: accumulatedText } : m)
            };
          }
          return s;
        }));
      }

      setSessions(prev => prev.map(s => {
        if (s.id === sessionId) {
          return {
            ...s,
            messages: s.messages.map(m => m.id === assistantId ? { ...m, isGenerating: false } : m)
          };
        }
        return s;
      }));
    } catch (err: any) {
      console.error('Core memory summarization stream error:', err);
      setSessions(prev => prev.map(s => {
        if (s.id === sessionId) {
          return {
            ...s,
            messages: s.messages.map(m => m.id === assistantId ? {
              ...m,
              content: `✨ **对话历史载入成功！**\n\n已成功载入完整历史语境。您可以随时在下方消息框输入新消息继续对话。\n\n*(自动记忆复刻摘要生成失败: ${err.message || '网络连接超时'})*`,
              isGenerating: false,
              isError: true
            } : m)
          };
        }
        return s;
      }));
    } finally {
      setTypingSessionId(null);
    }
  };

  const handleImportSessions = (importedSessions: ChatSession[]) => {
    if (!importedSessions || importedSessions.length === 0) return;
    
    // Create new session based on the primary imported item
    const primary = importedSessions[0];
    const newSessionId = `fractal-${Date.now()}`;
    const triggerMessage: Message = {
      id: `trigger-${Date.now()}`,
      role: 'user',
      content: `请深度总结上述对话内容并复刻核心记忆。提取关键信息、角色语境及核心背景，为我们无缝继续对话做好准备。`,
    };

    const newSession: ChatSession = {
      id: newSessionId,
      title: `分型记忆: ${primary.title || '导入对话'}`,
      messages: [
        ...primary.messages,
        triggerMessage
      ],
      updatedAt: Date.now()
    };

    // Keep other imported chats if they exist
    const others = importedSessions.slice(1);

    setSessions(prev => [newSession, ...others, ...prev]);
    setActiveSessionId(newSessionId);
    setInput('');
    setAttachments([]);

    // Scroll to bottom and trigger background summary
    setTimeout(() => {
      triggerAutomaticSummary(newSessionId, [
        ...primary.messages,
        triggerMessage
      ]);
      if (mainScrollRef.current) {
        mainScrollRef.current.scrollTop = mainScrollRef.current.scrollHeight;
      }
    }, 450);
  };

  const handleUrlImportSubmit = async () => {
    if (!importUrl.trim()) return;
    setIsUrlImporting(true);
    setImportError(null);
    try {
      const response = await fetch(importUrl.trim());
      if (!response.ok) {
        throw new Error(`连接失败 (HTTP 状态码 ${response.status})`);
      }
      const rawText = await response.text();
      let parseText = rawText.trim();
      
      if (parseText.startsWith('<') || parseText.includes('<html')) {
        const extracted = extractJsonFromText(parseText);
        if (!extracted) {
          throw new Error('未能在网页中检测到有效的对话数据 JSON 结构。');
        }
        parseText = extracted;
      }
      
      const parsed = parseImportText(parseText);
      handleImportSessions(parsed);
      setImportUrl('');
      setIsUrlModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setImportError(err.message || '读取或解析该链接内容失败，请确保链接可公开访问且内容符合 JSON 格式。如果您需要粘贴直接获得的 JSON 格式文本，可以切换上方标签。');
    } finally {
      setIsUrlImporting(false);
    }
  };

  const handleTextImportSubmit = () => {
    if (!directJsonText.trim()) return;
    setImportError(null);
    try {
      const parsed = parseImportText(directJsonText.trim());
      handleImportSessions(parsed);
      setDirectJsonText('');
      setIsUrlModalOpen(false);
    } catch (err: any) {
      setImportError(err.message || '解析文本失败，请确保您在下方粘贴的是标准对话记录 JSON 文本。');
    }
  };

  const handleSaveConfig = async (newConfig: APIConfig) => {
    try {
      if (newConfig.bgImageUrl) {
        await saveBackgroundImage(newConfig.bgImageUrl);
      } else {
        await clearBackgroundImage();
      }
    } catch (e) {
      console.error('Failed to configure background image in database:', e);
    }
    setConfig(newConfig);
  };

  const handleCopyMessage = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(text);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleCopyImage = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          canvas.toBlob(async (pngBlob) => {
            if (pngBlob) {
              try {
                await navigator.clipboard.write([
                  new ClipboardItem({
                    'image/png': pngBlob
                  })
                ]);
                setCopiedMessageId(url);
                setTimeout(() => setCopiedMessageId(null), 2000);
              } catch (err) {
                console.error('Clipboard item write error:', err);
                await navigator.clipboard.writeText(url);
                setCopiedMessageId(url);
                setTimeout(() => setCopiedMessageId(null), 2000);
              }
            } else {
              await navigator.clipboard.writeText(url);
              setCopiedMessageId(url);
              setTimeout(() => setCopiedMessageId(null), 2000);
            }
          }, 'image/png');
        } else {
          navigator.clipboard.writeText(url).then(() => {
            setCopiedMessageId(url);
            setTimeout(() => setCopiedMessageId(null), 2000);
          });
        }
      };
      img.onerror = async () => {
        await navigator.clipboard.writeText(url);
        setCopiedMessageId(url);
        setTimeout(() => setCopiedMessageId(null), 2000);
      };
      img.src = url;
    } catch (err) {
      console.error('Failed to copy image blob, falling back to URL copy:', err);
      try {
        await navigator.clipboard.writeText(url);
        setCopiedMessageId(url);
        setTimeout(() => setCopiedMessageId(null), 2000);
      } catch (fallbackErr) {
        console.error('Text fallback copy failed:', fallbackErr);
      }
    }
  };

  const handleEditMessage = (text: string, imageUrls?: string[]) => {
    setInput(text);
    if (imageUrls && imageUrls.length > 0) {
      const imgAttachments = imageUrls.map((url, idx) => ({
        id: `edit_img_${idx}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: `图片_${idx + 1}.png`,
        type: 'image' as const,
        url: url,
        size: '未知大小',
      }));
      setAttachments(imgAttachments);
    } else {
      setAttachments([]);
    }
    
    if (textareaRef.current) {
      textareaRef.current.focus();
      // Auto-resize search input box
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 240)}px`;
    }
  };

  const handleDownloadImage = async (url: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `ai-image-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.warn('Blob download failed, falling back to direct link:', err);
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.download = `ai-image-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || !activeSessionId) return;
    if (isTyping && !isDrawMode) return;
    if (!config.apiKey) {
      alert('请在设置中配置 API Key。');
      setIsSettingsOpen(true);
      return;
    }

    if (isDrawMode) {
      await handleGenerateImageDirectly();
      return;
    }

    const currentSessionId = activeSessionId;
    if (currentSessionId) {
      abortedSessionsRef.current[currentSessionId] = false;
    }
    
    // Process text content based on document attachments
    let textContent = input.trim();
    const docAttachments = attachments.filter(a => a.type === 'document' && a.content);
    if (docAttachments.length > 0) {
      const docContents = docAttachments.map(d => `[文件附件: ${d.name}]\n${d.content}`).join('\n\n');
      if (textContent) {
        textContent = `${textContent}\n\n---\n${docContents}`;
      } else {
        textContent = `以下是上传的文件内容：\n\n${docContents}`;
      }
    }

    const imageUrls = attachments.filter(a => a.type === 'image').map(a => a.url);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: textContent,
      imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
    };

    const newMessages = [...messages, userMessage];
    updateSessionMessages(currentSessionId, newMessages);
    setInput('');
    setAttachments([]); // Clear attachments
    setTypingSessionId(currentSessionId);

    if (textareaRef.current) {
      textareaRef.current.style.height = '40px';
    }

    const assistantId = (Date.now() + 1).toString();
    const workingMessages = [...newMessages, { id: assistantId, role: 'assistant' as const, content: '', isGenerating: true }];
    updateSessionMessages(currentSessionId, workingMessages);

    try {
      let accumulatedText = '';
      
      const stream = streamChat(newMessages, config);
      for await (const chunk of stream) {
        if (currentSessionId && abortedSessionsRef.current[currentSessionId]) {
          break;
        }
        accumulatedText += chunk;
        const displayContent = accumulatedText.replace(/\[IMAGINE:[\s\S]*/i, '*(正在准备生成图片...)*');
        
        setSessions(prev => prev.map(s => {
          if (s.id === currentSessionId) {
            return {
              ...s,
              messages: s.messages.map(m => m.id === assistantId ? { ...m, content: displayContent } : m)
            };
          }
          return s;
        }));
      }

      if (currentSessionId && abortedSessionsRef.current[currentSessionId]) {
        setSessions(prev => prev.map(s => {
          if (s.id === currentSessionId) {
            return {
              ...s,
              messages: s.messages.map(m => m.id === assistantId ? { ...m, isGenerating: false } : m)
            };
          }
          return s;
        }));
        return;
      }

      const { cleanText, imagePrompt } = extractCommand(accumulatedText);
      
      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          return {
            ...s,
            messages: s.messages.map(m => m.id === assistantId
              ? { ...m, content: cleanText || (imagePrompt ? '正在生成图片...' : ''), isGenerating: !!imagePrompt }
              : m)
          };
        }
        return s;
      }));

      if (imagePrompt) {
        try {
          const apiSize = imageSize === '1024x1024_auto' ? '1024x1024' : imageSize;
          const imageUrl = await generateImage(imagePrompt, config, apiSize, imageQuality, imageStyle, imageUrls);
          setSessions(prev => prev.map(s => {
            if (s.id === currentSessionId) {
              return {
                ...s,
                messages: s.messages.map(m => m.id === assistantId
                  ? { ...m, content: cleanText || '这是您需要的图片：', imageUrls: [imageUrl], isGenerating: false }
                  : m)
              };
            }
            return s;
          }));
        } catch (imgError: any) {
          console.error(imgError);
          setSessions(prev => prev.map(s => {
            if (s.id === currentSessionId) {
              return {
                ...s,
                messages: s.messages.map(m => m.id === assistantId
                  ? { ...m, content: cleanText ? cleanText + `\n\n*(图片生成失败: ${imgError.message})*` : `抱歉，图片生成失败: ${imgError.message}`, isGenerating: false, isError: true }
                  : m)
              };
            }
            return s;
          }));
        }
      } else {
        setSessions(prev => prev.map(s => {
          if (s.id === currentSessionId) {
            return { ...s, messages: s.messages.map(m => m.id === assistantId ? { ...m, isGenerating: false } : m) };
          }
          return s;
        }));
      }
    } catch (error: any) {
      console.error(error);
      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          return { ...s, messages: s.messages.map(m => m.id === assistantId ? { ...m, content: '错误: ' + error.message, isGenerating: false, isError: true } : m) };
        }
        return s;
      }));
    } finally {
      setTypingSessionId(null);
    }
  };

  const handleGenerateImageDirectly = async () => {
    if ((!input.trim() && attachments.length === 0) || !activeSessionId) return;
    if (!config.apiKey) {
      alert('请您先在设置中填写“接口设置”以配置 API 密钥 (API Key)。');
      setIsSettingsOpen(true);
      return;
    }

    const currentSessionId = activeSessionId;
    const promptText = input.trim();

    const imageUrls = attachments.filter(a => a.type === 'image').map(a => a.url);
    const docAttachments = attachments.filter(a => a.type === 'document');

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: promptText || '生成一幅画作',
      imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
    };

    const newMessagesForUI = [...messages, userMessage];
    updateSessionMessages(currentSessionId, newMessagesForUI);
    setInput('');
    setAttachments([]); // Clear attachments

    if (textareaRef.current) {
      textareaRef.current.style.height = '36px';
    }

    const assistantId = (Date.now() + 1).toString();
    const workingMessages = [...newMessagesForUI, { id: assistantId, role: 'assistant' as const, content: '正在生成更精致的图片，请稍候...', isGenerating: true, isDrawing: true }];
    updateSessionMessages(currentSessionId, workingMessages);

    try {
      const finalPrompt = promptText || 'A professional high-quality artistic masterpiece, highly detailed, realistic, UHD resolution';

      // Directly call our image generator endpoint
      const apiSize = imageSize === '1024x1024_auto' ? '1024x1024' : imageSize;
      const imageUrl = await generateImage(finalPrompt, config, apiSize, imageQuality, imageStyle, imageUrls);
      
      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          const completionContent = `✨ **为您绘制的创意画面已成功生成！**\n\n**原始输入：** ${promptText || '（参考输入）'}`;
          return {
            ...s,
            messages: s.messages.map(m => m.id === assistantId
              ? { ...m, content: completionContent, imageUrls: [imageUrl], isGenerating: false, isDrawing: false }
              : m)
          };
        }
        return s;
      }));
    } catch (imgError: any) {
      console.error(imgError);
      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          return {
            ...s,
            messages: s.messages.map(m => m.id === assistantId
              ? { ...m, content: `抱歉，调用绘图模型失败: ${imgError.message}`, isGenerating: false, isError: true, isDrawing: false }
              : m)
          };
        }
        return s;
      }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isTyping) {
        handleStopTyping();
      } else {
        handleSend();
      }
    }
  };

  return (
    <div 
      className={`flex h-screen font-sans overflow-hidden relative select-none transition-colors duration-500 ${
        config.bgImageUrl && bgTheme === 'dark' ? 'text-white/95' : 'text-[#222222]'
      }`}
      style={{ 
        backgroundColor: config.bgImageUrl 
          ? (bgTheme === 'dark' ? '#0d0d0e' : '#FAF8F5') 
          : '#FAF8F5' 
      }}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag and Drop Visual Overlay */}
      {isDragging && (
        <div 
          className="absolute inset-0 bg-[#7D9878]/15 backdrop-blur-[3px] border-4 border-dashed border-[#7D9878]/70 z-50 flex flex-col items-center justify-center transition-all duration-300 pointer-events-auto"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="bg-white/95 p-8 rounded-2xl shadow-2xl flex flex-col items-center space-y-4 border border-[#E8E1D5] pointer-events-none transform scale-105 transition-transform duration-300">
            <div className="w-16 h-16 bg-[#7D9878]/10 text-[#7D9878] rounded-full flex items-center justify-center animate-bounce">
              <FileUp size={32} />
            </div>
            <p className="font-semibold text-lg text-gray-800">释放鼠标以导入文件</p>
            <p className="text-xs text-gray-500">支持导入图片、TXT、Markdown、JSON 等文件</p>
          </div>
        </div>
      )}

      {/* Dynamic Theme Background */}
      {config.bgImageUrl && (
        <div
          className="absolute inset-0 pointer-events-none z-0 transition-all duration-500 overflow-hidden"
          style={{
            backgroundImage: `url(${config.bgImageUrl})`,
            backgroundSize: config.bgFit ?? 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            opacity: config.bgOpacity ?? 0.5,
            filter: config.bgBlur ? `blur(${config.bgBlur}px)` : 'none',
            transform: config.bgBlur ? 'scale(1.05)' : 'scale(1)',
          }}
        />
      )}

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-20 md:hidden transition-opacity" 
          onClick={() => setIsSidebarOpen(false)} 
        />
      )}

      {/* Sidebar Layout */}
      <div className={`fixed inset-y-0 left-0 z-30 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={selectSession}
          onNewSession={handleNewSession}
          onDeleteSession={handleDeleteSession}
          onRenameSession={handleRenameSession}
          onImportSessions={handleImportSessions}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenImportModal={() => setIsUrlModalOpen(true)}
          onTogglePinSession={handleTogglePinSession}
          hasBg={!!config.bgImageUrl}
          bgTheme={bgTheme}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative h-full w-full z-10">
        {/* Header */}
        <header className="flex-none flex items-center justify-between px-4 sm:px-6 py-3 md:hidden z-10 sticky top-0 pointer-events-none">
          <div className="flex items-center gap-3 pointer-events-auto">
            {!isSidebarOpen && (
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className={`p-2 -ml-2 rounded-xl transition-all focus:outline-none backdrop-blur-sm ${
                  config.bgImageUrl && bgTheme === 'dark'
                    ? 'text-white hover:text-[#7D9878] hover:bg-white/10'
                    : 'text-gray-500 hover:text-[#7D9878] hover:bg-white/50'
                }`}
              >
                <Menu size={20} />
              </button>
            )}
            <div className={`font-semibold text-lg drop-shadow-sm ${!isSidebarOpen ? '' : 'hidden'} ${
              config.bgImageUrl && bgTheme === 'dark' ? 'text-white' : 'text-[#222222]'
            }`}>
              Gribo
            </div>
          </div>
        </header>

        {/* Scrollable Messages */}
        <main 
          ref={mainScrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto custom-scrollbar px-4 sm:px-6 py-6 pb-44 relative"
        >
          <div className="max-w-3xl mx-auto space-y-8 mt-4 md:mt-10">
            {messages.length === 0 && (
              <div className={`flex flex-col items-center justify-center h-full space-y-4 mt-20 transition-all ${
                config.bgImageUrl && bgTheme === 'dark' ? 'text-white/70' : 'text-gray-400'
              }`}>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-2 shadow-xs border transition-colors ${
                  config.bgImageUrl && bgTheme === 'dark' 
                    ? 'bg-black/20 border-white/10 text-white' 
                    : 'bg-[#E8E1D5]/50 border-transparent text-[#222222]'
                }`}>
                  <span className="text-2xl font-bold opacity-85 block">G</span>
                </div>
                <p className={`text-sm font-medium tracking-wide ${
                  config.bgImageUrl && bgTheme === 'dark' ? 'text-white/60' : 'text-gray-500'
                }`}>发送消息以开始对话</p>
              </div>
            )}
            
            {messages.map((msg) => {
              const userBubbleClass = config.bgImageUrl
                ? bgTheme === 'dark'
                  ? 'bg-black/35 text-white rounded-2xl border border-white/10 shadow-sm backdrop-blur-md select-text'
                  : 'bg-[#FAF8F5]/90 text-[#222222] rounded-2xl border border-[#E8E1D5]/40 shadow-sm backdrop-blur-md select-text'
                : 'bg-[#E8E1D5]/80 text-[#222222] rounded-2xl shadow-xs select-text';

              // If assistant message, strip bubble wrapper (background/border/shadow) completely as requested
              const isAssistant = msg.role === 'assistant';
              const assistantBubbleClass = msg.isError
                ? 'bg-red-50/90 border border-red-100 text-red-800 rounded-xl px-5 py-4 shadow-sm'
                : `w-full max-w-full rounded-none px-0 py-1 border-none shadow-none bg-transparent ${
                    config.bgImageUrl && bgTheme === 'dark' ? 'text-white' : 'text-[#222222]'
                  }`;

              return (
                <div
                  key={msg.id}
                  className={`flex w-full select-none ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'user' ? (
                    <div className="flex flex-col items-end gap-2 max-w-[85%] select-none group/user">
                      {/* Separate Images Container above the text box */}
                      {msg.imageUrls && msg.imageUrls.length > 0 && (
                        <div className="flex flex-wrap gap-2 justify-end mb-1 select-none">
                          {msg.imageUrls.map((imgUrl, idx) => (
                            <img 
                              key={idx} 
                              src={imgUrl} 
                              alt="User attachment" 
                              className="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-2xl border border-black/5 dark:border-white/5 hover:scale-[1.03] transition-transform duration-200 cursor-pointer shadow-md"
                              onClick={() => setExpandedImageUrl(imgUrl)}
                              referrerPolicy="no-referrer"
                            />
                          ))}
                        </div>
                      )}

                      {/* Text Dialog Box underneath images */}
                      {msg.content && (() => {
                        const isLongText = msg.content.length > 200 || msg.content.split('\n').length > 4;
                        const isExpanded = !!expandedUserMessageIds[msg.id];
                        
                        return (
                          <div className={`px-4 py-2.5 rounded-2xl relative ${userBubbleClass} ${isLongText ? 'pb-8 pr-6' : ''}`}>
                            <div className="flex flex-col">
                              <div className={`text-[14.5px] sm:text-[15px] leading-relaxed select-text whitespace-pre-wrap break-words transition-all duration-300 ${isLongText && !isExpanded ? 'max-h-[140px] overflow-hidden' : ''}`}>
                                {msg.content}
                              </div>
                              {isLongText && (
                                <button
                                  type="button"
                                  onClick={() => setExpandedUserMessageIds(prev => ({ ...prev, [msg.id]: !isExpanded }))}
                                  className="absolute bottom-2 right-2 w-7 h-7 rounded-full flex items-center justify-center bg-black/5 dark:bg-white/10 text-gray-500 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/20 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-xs"
                                  title={isExpanded ? "收起" : "展开全部"}
                                >
                                  {isExpanded ? (
                                    <ChevronUp size={14} strokeWidth={2.5} />
                                  ) : (
                                    <ChevronDown size={14} strokeWidth={2.5} />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                      
                      {/* Copy & Edit Action Buttons Aligned Under the Speech Bubble */}
                      <div className="flex items-center gap-2 mt-2 select-none">
                        <button
                          type="button"
                          onClick={() => handleCopyMessage(msg.content)}
                          className={`flex items-center justify-center p-2 rounded-lg text-xs font-semibold cursor-pointer transition-all border shadow-xs ${
                            config.bgImageUrl && bgTheme === 'dark'
                              ? 'bg-black/55 border-white/15 text-white/85 hover:text-white hover:bg-black/75 hover:scale-105 hover:border-white/25'
                              : 'bg-white border-gray-200/90 text-gray-650 hover:text-gray-900 hover:bg-gray-50 hover:border-gray-300 hover:scale-105'
                          }`}
                          title={copiedMessageId === msg.content ? "已复制" : "复制"}
                        >
                          {copiedMessageId === msg.content ? (
                            <Check size={14} className="text-green-550 animate-fade-in" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditMessage(msg.content, msg.imageUrls)}
                          className={`flex items-center justify-center p-2 rounded-lg text-xs font-semibold cursor-pointer transition-all border shadow-xs ${
                            config.bgImageUrl && bgTheme === 'dark'
                              ? 'bg-black/55 border-white/15 text-white/85 hover:text-white hover:bg-black/75 hover:scale-105 hover:border-white/25'
                              : 'bg-white border-gray-200/90 text-gray-650 hover:text-gray-900 hover:bg-gray-50 hover:border-gray-300 hover:scale-105'
                          }`}
                          title="编辑消息"
                        >
                          <Pencil size={14} strokeWidth={2.2} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={assistantBubbleClass}>
                      {msg.content && !(msg.isDrawing && msg.isGenerating) && (!msg.imageUrls || msg.imageUrls.length === 0) && (
                        <div className="text-[15px] sm:text-base leading-relaxed select-text flex flex-col items-start gap-1.5">
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={{
                              p: ({node, ...props}) => <p className="mb-4 last:mb-0 leading-relaxed break-words" {...props} />,
                              a: ({node, ...props}) => {
                                const linkColorClass = config.bgImageUrl && bgTheme === 'dark'
                                  ? 'text-[#a2cca0] hover:text-[#afd5aa]'
                                  : 'text-[#7D9878] hover:text-[#5a7255]';
                                return <a className={`${linkColorClass} hover:underline font-medium break-all`} {...props} />;
                              },
                              strong: ({node, ...props}) => <strong className="font-bold text-inherit" {...props} />,
                              ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-1" {...props} />,
                              ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-4 space-y-1" {...props} />,
                              li: ({node, ...props}) => <li className="leading-relaxed" {...props} />,
                              blockquote: ({node, ...props}) => (
                                <blockquote className="border-l-4 border-[#7D9878]/50 pl-4 py-1 my-4 italic opacity-85 bg-black/5 dark:bg-white/5 rounded-r" {...props} />
                              ),
                              table: ({node, ...props}) => (
                                <div className="w-full my-5 overflow-x-auto rounded-lg border border-black/10 dark:border-white/10 custom-scrollbar select-text bg-white/40 dark:bg-black/20">
                                  <table className="w-full text-sm border-collapse" {...props} />
                                </div>
                              ),
                              thead: ({node, ...props}) => <thead className="bg-[#E8E1D5]/20 dark:bg-white/10 font-semibold" {...props} />,
                              tbody: ({node, ...props}) => <tbody className="divide-y divide-black/5 dark:divide-white/5" {...props} />,
                              tr: ({node, ...props}) => <tr className="odd:bg-black/[0.01] dark:odd:bg-white/[0.01]" {...props} />,
                              th: ({node, ...props}) => <th className="px-4 py-3 text-left font-semibold border-r border-black/5 dark:border-white/5 last:border-r-0" {...props} />,
                              td: ({node, ...props}) => <td className="px-4 py-2.5 border-r border-black/5 dark:border-white/5 last:border-r-0 font-normal" {...props} />,
                              code: ({className, children, ...props}: any) => {
                                return <CodeBlock className={className} children={children} {...props} />;
                              },
                              img: ({src, alt, ...props}) => (
                                <div className="my-4 rounded-xl overflow-hidden shadow-md border border-[#E8E1D5]/35 bg-black/5 dark:bg-white/5 max-w-sm">
                                  <img src={src} alt={alt || "图片"} className="max-w-full h-auto mx-auto object-contain max-h-[320px]" referrerPolicy="no-referrer" {...props} />
                                </div>
                              ),
                              h1: ({node, ...props}) => <h1 className="text-2xl font-bold mt-6 mb-3 tracking-tight text-inherit select-text" {...props} />,
                              h2: ({node, ...props}) => <h2 className="text-xl font-bold mt-5 mb-2.5 tracking-tight text-inherit select-text" {...props} />,
                              h3: ({node, ...props}) => <h3 className="text-lg font-semibold mt-4 mb-2 text-inherit select-text" {...props} />,
                              h4: ({node, ...props}) => <h4 className="text-base font-semibold mt-3 mb-1.5 text-inherit select-text" {...props} />,
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>

                          {/* One-click copy button below text */}
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(msg.content)}
                            className={`flex items-center justify-center p-2 rounded-lg text-xs font-semibold cursor-pointer transition-all border shadow-xs mt-2 select-none ${
                              config.bgImageUrl && bgTheme === 'dark'
                                ? 'bg-black/55 border-white/15 text-white/85 hover:text-white hover:bg-black/75 hover:scale-105 hover:border-white/25'
                                : 'bg-white border-gray-200/90 text-gray-650 hover:text-gray-900 hover:bg-gray-50 hover:border-gray-300 hover:scale-105'
                            }`}
                            title={copiedMessageId === msg.content ? "已复制" : "复制"}
                          >
                            {copiedMessageId === msg.content ? (
                              <Check size={14} className="text-green-550 animate-fade-in" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                        </div>
                      )}
                      
                       {msg.isDrawing && msg.isGenerating && (
                        <div className="flex flex-col gap-2 my-1.5 w-fit select-none">
                          <div className={`text-xs font-semibold ${
                            config.bgImageUrl && bgTheme === 'dark' ? 'text-white/80' : 'text-[#222222]'
                          }`}>
                            <div className="flex items-center gap-1.5 mt-1 text-[#7D9878]">
                              <Sparkles size={11.5} className="animate-spin" style={{ animationDuration: '4s' }} />
                              <span className="text-[11.5px] tracking-wide font-medium">正在准备生成图片，请稍等...</span>
                            </div>
                          </div>

                          {/* Shrunk Pattern Card loader matches user request perfectly for maximum visual density */}
                          <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden flex items-center justify-center relative border transition-all duration-300 mt-1 ${
                            config.bgImageUrl && bgTheme === 'dark'
                              ? 'bg-black/45 border-white/10'
                              : 'bg-[#E8E1D5]/20 border-[#E8E1D5]/50 shadow-xs'
                          }`}>
                            <div className="absolute inset-x-0 inset-y-0 opacity-25 bg-[radial-gradient(#7D9878_1px,transparent_1px)] [background-size:6px_6px]" />
                            <div className="flex space-x-1 items-center justify-center relative z-10 text-[#7D9878]">
                              <span className="w-1.5 h-1.5 bg-[#7D9878] rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                              <span className="w-1.5 h-1.5 bg-[#7D9878] rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                              <span className="w-1.5 h-1.5 bg-[#7D9878] rounded-full animate-bounce"></span>
                            </div>
                          </div>
                        </div>
                      )}

                      {msg.isGenerating && msg.role === 'assistant' && !msg.isDrawing && !msg.content && (
                        <div className={`flex items-center gap-2 text-sm mt-3 font-medium select-none ${
                          config.bgImageUrl && bgTheme === 'dark' ? 'text-[#a1bfa0]' : 'text-[#7D9878]'
                        }`}>
                          <Loader2 size={15} className="animate-spin" />
                          <span>正在处理...</span>
                        </div>
                      )}

                      {msg.imageUrls && msg.imageUrls.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-4 select-none">
                          {msg.imageUrls.map((url, i) => {
                            // Find out ratio from local URL path string pattern matching or use standard config ratio
                            const isWidescreen = url.includes('1792x1024') || imageSize === '1792x1024';
                            const isPortrait = url.includes('1024x1792') || imageSize === '1024x1792';
                            
                            let sizeClass = "w-full max-w-[250px] sm:max-w-[280px] aspect-square";
                            if (isWidescreen) {
                              sizeClass = "w-full max-w-[280px] sm:max-w-[340px] aspect-[16/9]";
                            } else if (isPortrait) {
                              sizeClass = "w-full max-w-[180px] sm:max-w-[220px] aspect-[9/16]";
                            }
                            
                            return (
                              <div key={i} className="flex flex-col gap-2 mt-1">
                                <div 
                                  className={`relative group rounded-xl overflow-hidden shadow-sm border border-[#E8E1D5]/30 cursor-zoom-in ${sizeClass} ${
                                    config.bgImageUrl && bgTheme === 'dark'
                                      ? 'bg-black/30 border-white/5'
                                      : 'bg-[#FAF8F5]/80'
                                  } transition-all duration-300 hover:shadow-md`}
                                  onClick={() => setExpandedImageUrl(url)}
                                >
                                  <img 
                                    src={url} 
                                    alt="AI生成的图像" 
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.015]"
                                    loading="lazy"
                                    referrerPolicy="no-referrer"
                                  />
                                  
                                  {/* Hover toolbar buttons overlay */}
                                  <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-3">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDownloadImage(url);
                                      }}
                                      className="w-9 h-9 bg-white text-gray-800 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-md cursor-pointer hover:bg-[#7D9878] hover:text-white"
                                      title="下载原图"
                                    >
                                      <Download size={15} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setExpandedImageUrl(url);
                                      }}
                                      className="w-9 h-9 bg-white text-gray-800 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-md cursor-pointer hover:bg-[#7D9878] hover:text-white"
                                      title="放大查看"
                                    >
                                      <Image size={15} />
                                    </button>
                                  </div>
                                </div>

                                {/* Persistent download and copy buttons directly below the image for fast accesses */}
                                <div className="flex items-center gap-2 select-none self-start mt-2">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDownloadImage(url);
                                    }}
                                    className={`flex items-center justify-center p-2 rounded-lg text-xs font-semibold cursor-pointer transition-all border shadow-xs ${
                                      config.bgImageUrl && bgTheme === 'dark'
                                        ? 'bg-black/55 border-white/15 text-white/85 hover:text-white hover:bg-black/75 hover:scale-105 hover:border-white/25'
                                        : 'bg-white border-gray-200/90 text-gray-650 hover:text-gray-900 hover:bg-gray-50 hover:border-gray-300 hover:scale-105'
                                    }`}
                                    title="下载原图"
                                  >
                                    <Download size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopyImage(url);
                                    }}
                                    className={`flex items-center justify-center p-2 rounded-lg text-xs font-semibold cursor-pointer transition-all border shadow-xs ${
                                      config.bgImageUrl && bgTheme === 'dark'
                                        ? 'bg-black/55 border-white/15 text-white/85 hover:text-white hover:bg-black/75 hover:scale-105 hover:border-white/25'
                                        : 'bg-white border-gray-200/90 text-gray-650 hover:text-gray-900 hover:bg-gray-50 hover:border-gray-300 hover:scale-105'
                                    }`}
                                    title="复制图片"
                                  >
                                    {copiedMessageId === url ? (
                                      <Check size={14} className="text-green-550 animate-fade-in" />
                                    ) : (
                                      <Copy size={14} />
                                    )}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </main>

        {/* Floating jump to bottom button */}
        {showScrollBottomBtn && (
          <button
            onClick={scrollToBottom}
            className={`absolute bottom-[130px] left-1/2 -translate-x-1/2 z-30 flex items-center justify-center w-10 h-10 rounded-full border shadow-lg hover:scale-110 active:scale-95 transition-all duration-300 cursor-pointer ${
              config.bgImageUrl && bgTheme === 'dark'
                ? 'bg-black/80 hover:bg-black/90 border-white/10 text-white'
                : 'bg-white hover:bg-gray-50 border-[#E8E1D5] text-[#7D9878] hover:text-[#5a7255]'
            }`}
            title="一键回到底部"
          >
            <ArrowDown size={18} className="animate-bounce" />
          </button>
        )}

        {/* Input Area */}
        <div className={config.bgImageUrl
          ? bgTheme === 'dark'
            ? "absolute bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-black/50 via-black/25 to-transparent pointer-events-none"
            : "absolute bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-white/50 via-white/20 to-transparent pointer-events-none"
          : "absolute bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-[#FAF8F5] via-[#FAF8F5]/95 to-transparent pointer-events-none"
        }>
          <div className="max-w-xl md:max-w-[620px] mx-auto pointer-events-auto relative">
            
            {/* Custom Interactive GPT Image 2 Parameters Panel removed in favor of hover-activated mini aspect popover */}

            <div className={config.bgImageUrl
              ? bgTheme === 'dark'
                ? "relative bg-black/45 border border-white/20 focus-within:border-[#7D9878]/80 focus-within:ring-1 focus-within:ring-[#7D9878]/30 transition-all duration-300 shadow-lg flex flex-col overflow-visible backdrop-blur-md rounded-[24px]"
                : "relative bg-white/80 border border-[#E8E1D5] focus-within:border-[#7D9878] focus-within:ring-1 focus-within:ring-[#7D9878]/30 transition-all duration-300 shadow-md flex flex-col overflow-visible backdrop-blur-md rounded-[24px]"
              : "relative bg-white border border-[#E8E1D5] rounded-[24px] focus-within:border-[#7D9878] focus-within:ring-1 focus-within:ring-[#7D9878]/30 transition-all duration-300 shadow-md flex flex-col overflow-visible"
            }>
              
              {/* Hidden file input for file uploading */}
              <input 
                ref={fileInputRef}
                type="file" 
                multiple 
                className="hidden" 
                onChange={(e) => {
                  if (e.target.files) {
                    handleFiles(e.target.files);
                    e.target.value = ''; // Reset selection
                  }
                }}
                accept="image/*,.txt,.md,.json,.js,.ts,.tsx,.csv,.xml,.css,.pdf,.docx"
              />

              {/* Attachments Preview Slider inside the input box (above textarea) */}
              {attachments.length > 0 && (
                <div className={config.bgImageUrl
                  ? bgTheme === 'dark'
                    ? "flex flex-row items-center gap-3.5 px-5 py-2.5 border-b border-white/10 bg-black/25 overflow-x-auto scrollbar-none h-[64px] flex-nowrap shrink-0 select-none rounded-t-[23px]"
                    : "flex flex-row items-center gap-3.5 px-5 py-2.5 border-b border-[#E8E1D5]/35 bg-white/30 overflow-x-auto scrollbar-none h-[64px] flex-nowrap shrink-0 select-none rounded-t-[23px]"
                  : "flex flex-row items-center gap-3.5 px-5 py-2.5 border-b border-[#E8E1D5]/35 bg-gray-50/40 overflow-x-auto scrollbar-none h-[64px] flex-nowrap shrink-0 select-none rounded-t-[23px]"
                }>
                  {attachments.map((file) => (
                    <div 
                      key={file.id} 
                      onClick={() => setPreviewAttachment(file)}
                      className={config.bgImageUrl
                        ? bgTheme === 'dark'
                          ? "relative w-11 h-11 rounded-lg border border-white/15 bg-black/35 flex-shrink-0 group hover:border-[#7D9878]/80 hover:shadow-xs transition-all duration-200 cursor-pointer"
                          : "relative w-11 h-11 rounded-lg border border-[#E8E1D5] bg-white/70 flex-shrink-0 group hover:border-[#7D9878]/60 hover:shadow-xs transition-all duration-200 cursor-pointer"
                        : "relative w-11 h-11 rounded-lg border border-[#E8E1D5] shadow-xs flex-shrink-0 bg-white group hover:border-[#7D9878]/60 hover:shadow-xs transition-all duration-200 cursor-pointer"
                      }
                      title="点击预览"
                    >
                      {file.type === 'image' ? (
                        <div className="w-full h-full rounded-lg overflow-hidden bg-gray-50 pointer-events-none">
                          <img src={file.url} alt="上传预览" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className={`w-full h-full rounded-lg flex flex-col items-center justify-center gap-0 pointer-events-none ${
                          config.bgImageUrl && bgTheme === 'dark'
                            ? 'bg-white/10 text-white/90'
                            : 'bg-[#7D9878]/10 text-[#7D9878]'
                        }`}>
                          <FileText size={16} />
                          <span className="text-[8px] font-bold font-mono px-0.5 uppercase truncate max-w-[40px]">
                            {file.name.split('.').pop() || 'doc'}
                          </span>
                        </div>
                      )}
                      
                      {/* Black absolute cross button in top right overlapping the corner */}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setAttachments(prev => prev.filter(a => a.id !== file.id));
                        }}
                        className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 bg-black/85 text-white hover:bg-black rounded-full flex items-center justify-center cursor-pointer shadow-md transform hover:scale-110 active:scale-95 transition-all duration-150 z-10 animate-fade-in"
                        title="移除附件"
                      >
                        <X size={9} strokeWidth={3} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Textarea Block */}
              <div className="w-full px-1.5">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={(e) => {
                    const clipboardFiles = e.clipboardData.files;
                    if (clipboardFiles && clipboardFiles.length > 0) {
                      e.preventDefault();
                      handleFiles(clipboardFiles);
                    }
                  }}
                  placeholder="在此输入您的提示词，或进行对话..."
                  className={`w-full bg-transparent px-2.5 pt-2.5 pb-1 resize-none outline-none placeholder-gray-400 disabled:opacity-50 text-[14px] sm:text-[15px] leading-relaxed min-h-[36px] select-text custom-scrollbar ${
                    config.bgImageUrl && bgTheme === 'dark' ? 'text-white' : 'text-[#222222]'
                  }`}
                  disabled={false}
                  rows={1}
                  style={{ height: '36px', maxHeight: '240px' }}
                />
              </div>

              {/* Bottom Actions Row */}
              <div className="flex items-center justify-between px-4 pb-3 pt-0.5 bg-transparent select-none">
                {/* Left Action: Upload File & Generate Image */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-9 h-9 rounded-full flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-all duration-200 ${
                      config.bgImageUrl
                        ? bgTheme === 'dark'
                          ? 'bg-white/10 hover:bg-white/20 border border-white/15 text-white/85 hover:text-white'
                          : 'bg-white/60 hover:bg-white/80 border border-[#E8E1D5] text-gray-600 hover:text-[#222222]'
                        : 'bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-500 hover:text-gray-800'
                    }`}
                    title="上传图片或文件"
                  >
                    <Plus size={18} strokeWidth={2.5} />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsDrawMode(!isDrawMode);
                    }}
                    onMouseOver={() => setIsGenImageHovered(true)}
                    onMouseOut={() => setIsGenImageHovered(false)}
                    disabled={false}
                    className={`w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 border ${
                      isDrawMode
                        ? 'bg-[#7D9878] border-[#7D9878] text-white shadow-sm scale-105'
                        : config.bgImageUrl && bgTheme === 'dark'
                          ? isGenImageHovered
                            ? 'bg-white/15 border-white/20 text-white shadow-xs'
                            : 'bg-white/5 border-white/10 text-white/60'
                          : isGenImageHovered
                            ? 'bg-[#7D9878]/15 border-[#7D9878]/30 text-[#7D9878] shadow-xs'
                            : 'bg-[#E8E1D5]/35 border-transparent text-[#222222]/70'
                    } ${
                      config.bgImageUrl && bgTheme === 'dark'
                        ? 'disabled:bg-white/5 disabled:border-white/10 disabled:text-white/35'
                        : 'disabled:bg-gray-100 disabled:border-gray-200 disabled:text-gray-400'
                    } disabled:scale-100 disabled:shadow-none disabled:cursor-not-allowed`}
                    title={isDrawMode ? "关闭绘图模式" : "开启绘图模式"}
                  >
                    <Sparkles 
                      size={14} 
                      className={`transition-all duration-300 ${isDrawMode || isGenImageHovered ? 'rotate-12 scale-110 text-white' : ''}`}
                    />
                  </button>
                </div>

                 {/* Right Actions: Advanced parameters popover + Send Button */}
                 <div className="flex items-center gap-2">
                   {/* Aspect Ratio Selector Container with Click-Only Control and Ref */}
                   <div 
                     ref={imageSettingsRef}
                     className="relative"
                   >
                     <button
                       type="button"
                       onClick={() => setIsImageSettingsOpen(!isImageSettingsOpen)}
                       className={`flex items-center gap-1.5 px-2.5 py-1.5 border rounded-full text-[11px] font-bold cursor-pointer transition-all duration-200 select-none ${
                         isImageSettingsOpen
                           ? 'bg-[#7D9878] border-[#7D9878] text-white shadow-md scale-105'
                           : config.bgImageUrl
                             ? bgTheme === 'dark'
                               ? 'bg-[#2E2E30]/65 hover:bg-[#3E3E40]/90 border-white/10 text-white/90 hover:text-white'
                               : 'bg-white/85 hover:bg-white border-[#E8E1D5] text-gray-700 hover:text-gray-950 shadow-xs'
                             : 'bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 hover:text-gray-900 shadow-xs'
                       }`}
                       title="选择生成图片的宽高比"
                     >
                       <Sliders size={11} className={isImageSettingsOpen ? 'rotate-90 transition-transform duration-200' : 'opacity-85'} />
                       <span>
                         {imageSize === '1024x1024_auto' ? '自动' :
                          imageSize === '1024x1024' ? '方形 1:1' :
                          imageSize === '1792x1024' ? '宽屏 16:9' :
                          imageSize === '1024x1792' ? '故事 9:16' :
                          imageSize === '1024x768' ? '横版 4:3' :
                          imageSize === '768x1024' ? '竖版 3:4' : '比例'}
                       </span>
                       <span className="text-[7px] opacity-70">
                         {isImageSettingsOpen ? '▲' : '▼'}
                       </span>
                     </button>

                     {/* Highly Compact & Beautiful Popover Menu */}
                     {isImageSettingsOpen && (
                       <div className={`absolute bottom-[calc(100%+8px)] right-0 w-[150px] p-1 rounded-xl shadow-xl backdrop-blur-xl border transition-all duration-200 z-50 animate-in fade-in slide-in-from-bottom-1 ${
                         config.bgImageUrl
                           ? bgTheme === 'dark'
                             ? 'bg-[#18181B]/95 border-white/10 text-white'
                             : 'bg-[#FAF8F5]/98 border-[#E8E1D5] text-[#222222]'
                           : 'bg-white border-[#E8E1D5] text-[#222222]'
                       }`}>
                         {/* Title header */}
                         <div className="px-2 py-1 text-[10px] font-bold opacity-60 uppercase tracking-wider text-center select-none border-b border-current/10 mb-1">
                           选择图片宽高比
                         </div>
                         <div className="flex flex-col gap-0.5">
                           {[
                             { value: '1024x1024_auto', label: '自动', sub: 'AUTO', icon: 'auto' },
                             { value: '1024x1024', label: '方形', sub: '1:1', icon: '1:1' },
                             { value: '768x1024', label: '竖版', sub: '3:4', icon: '3:4' },
                             { value: '1024x1792', label: '故事版', sub: '9:16', icon: '9:16' },
                             { value: '1024x768', label: '横版', sub: '4:3', icon: '4:3' },
                             { value: '1792x1024', label: '宽屏', sub: '16:9', icon: '16:9' }
                           ].map(item => {
                             const isSelected = imageSize === item.value;
                             const isHovered = hoveredImageOption === item.value;
                             return (
                               <button
                                 key={item.value}
                                 type="button"
                                 onMouseOver={() => setHoveredImageOption(item.value)}
                                 onMouseOut={() => setHoveredImageOption(null)}
                                 onClick={() => {
                                   setImageSize(item.value);
                                   setIsImageSettingsOpen(false);
                                 }}
                                 className={`flex items-center justify-between px-2 py-1.5 rounded-lg transition-all duration-150 cursor-pointer text-left w-full group ${
                                   isSelected
                                     ? config.bgImageUrl && bgTheme === 'dark'
                                       ? 'bg-white/15 text-white font-semibold'
                                       : 'bg-black/[0.05] text-[#222222] font-semibold'
                                     : isHovered
                                       ? config.bgImageUrl && bgTheme === 'dark'
                                         ? 'bg-white/10 text-white translate-x-1'
                                         : 'bg-black/[0.03] text-gray-900 translate-x-1'
                                       : config.bgImageUrl && bgTheme === 'dark'
                                         ? 'bg-transparent text-white/70'
                                         : 'bg-transparent text-gray-500'
                                 }`}
                               >
                                 <div className="flex items-center gap-2">
                                   {/* Minimalist Visual Aspect Ratio Icon */}
                                   <div className="w-[15px] h-[15px] flex items-center justify-center">
                                     {renderMiniAspectIcon(item.icon, isSelected || isHovered)}
                                   </div>
                                   <span className="text-[11.5px] tracking-wide flex items-baseline gap-1">
                                     <span>{item.label}</span>
                                     {item.sub && (
                                       <span className={`text-[9px] font-mono opacity-50 ${isSelected ? 'text-[#7D9878]' : ''}`}>
                                         {item.sub}
                                       </span>
                                     )}
                                   </span>
                                 </div>
                                 {isSelected && (
                                   <Check size={11} className="text-[#7D9878] mr-0.5" strokeWidth={3} />
                                 )}
                               </button>
                             );
                           })}
                         </div>
                       </div>
                     )}
                   </div>

                   <button
                     onClick={isTyping ? handleStopTyping : handleSend}
                     onMouseOver={() => setIsSendHovered(true)}
                     onMouseOut={() => setIsSendHovered(false)}
                     disabled={!isTyping && !input.trim() && attachments.length === 0}
                     className={`w-9 h-9 text-white rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 border ${
                       isTyping 
                         ? config.bgImageUrl && bgTheme === 'dark'
                           ? 'bg-red-500/85 border-red-500/40 hover:bg-red-500 hover:scale-105'
                           : 'bg-red-600 border-red-600 hover:bg-red-700 hover:scale-105 shadow-sm shadow-red-500/20'
                         : config.bgImageUrl && bgTheme === 'dark'
                           ? isSendHovered
                             ? 'bg-[#6b8566] border-[#7D9878]/35 shadow-md scale-105'
                             : 'bg-[#7D9878] border-[#7D9878]/25'
                           : isSendHovered
                             ? 'bg-black border-black shadow-md scale-105'
                             : 'bg-[#1c1c1e] border-[#1c1c1e]'
                     } disabled:bg-[#E8E1D5] disabled:text-[#F4F0E8] disabled:border-[#E8E1D5] disabled:scale-100 disabled:shadow-none disabled:cursor-not-allowed`}
                     title={isTyping ? "停止回答" : "发送"}
                   >
                     {isTyping ? (
                       <Square size={13} className="fill-current text-white" />
                     ) : (
                       <ArrowUp 
                         size={16} 
                         strokeWidth={2.5} 
                         className={`transition-transform duration-200 ${isSendHovered && !isTyping ? '-translate-y-0.5' : ''}`}
                       />
                     )}
                   </button>
                 </div>
              </div>

            </div>
            <div className="text-center mt-3 drop-shadow-xs">
              <span className={`text-xs font-medium tracking-wide px-2.5 py-1 rounded-full transition-colors ${
                config.bgImageUrl
                  ? bgTheme === 'dark'
                    ? 'text-white/45 bg-black/25'
                    : 'text-gray-500 bg-white/45'
                  : 'text-gray-500 bg-[#FAF8F5]/60'
              }`}>AI 可能会犯错，请核实重要信息。</span>
            </div>
          </div>
        </div>
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onSave={handleSaveConfig}
        bgTheme={bgTheme}
      />

      {/* Attachment Preview Lightbox Modal */}
      {previewAttachment && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-[6px] z-[999] flex items-center justify-center p-4 transition-all duration-300"
          onClick={() => setPreviewAttachment(null)}
        >
          <div 
            className="bg-[#FAF8F5] w-full max-w-2xl rounded-[20px] shadow-2xl overflow-hidden border border-[#E8E1D5] flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8E1D5]/60 bg-white">
              <div className="flex items-center gap-2.5 overflow-hidden mr-4">
                {previewAttachment.type === 'image' ? (
                  <div className="w-8 h-8 rounded-lg bg-[#7D9878]/10 text-[#7D9878] flex items-center justify-center flex-shrink-0 font-medium">
                    <Image size={18} />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-[#7D9878]/10 text-[#7D9878] flex items-center justify-center flex-shrink-0 font-medium font-mono">
                    <FileText size={18} />
                  </div>
                )}
                <div className="flex flex-col overflow-hidden">
                  <h3 className="font-semibold text-[13px] sm:text-sm text-gray-800 truncate leading-snug">{previewAttachment.name}</h3>
                  <span className="text-[10px] text-gray-400 font-mono tracking-tight">{previewAttachment.size}</span>
                </div>
              </div>
              <button 
                onClick={() => setPreviewAttachment(null)}
                className="w-8 h-8 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 flex-1 overflow-y-auto custom-scrollbar bg-[#FAF8F5] flex items-center justify-center min-h-[250px]">
              {previewAttachment.type === 'image' ? (
                <div className="relative max-w-full max-h-[60vh] flex items-center justify-center rounded-xl overflow-hidden border border-[#E8E1D5]/40 shadow-xs bg-white p-1">
                  <img 
                    src={previewAttachment.url} 
                    alt={previewAttachment.name} 
                    className="max-w-full max-h-[55vh] object-contain rounded-lg"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : (
                <div className="w-full h-full min-h-[220px] flex flex-col">
                  {previewAttachment.content ? (
                    <pre className="w-full p-4 bg-white border border-[#E8E1D5] rounded-xl text-xs text-gray-700 font-mono overflow-auto max-h-[50vh] whitespace-pre-wrap leading-relaxed select-text">
                      {previewAttachment.content}
                    </pre>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400">
                      <FileText size={36} className="text-[#E8E1D5] mb-3" />
                      <p className="text-sm font-medium text-gray-600">非文本格式文件预览暂时不可用</p>
                      <p className="text-xs text-gray-400 mt-1">此文件将被作为附件直接附带于会话请求中</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 border-t border-[#E8E1D5]/60 bg-white flex justify-end gap-3 text-xs">
              <button 
                onClick={() => {
                  setAttachments(prev => prev.filter(a => a.id !== previewAttachment.id));
                  setPreviewAttachment(null);
                }}
                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors font-medium border border-[#E8E1D5]/50 hover:border-red-200 cursor-pointer"
              >
                删除此附件
              </button>
              <button 
                onClick={() => setPreviewAttachment(null)}
                className="px-4 py-2 bg-[#1c1c1e] hover:bg-black text-white rounded-xl transition-colors font-medium cursor-pointer"
              >
                关闭预览
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generated Image Lightbox Zoom Modal */}
      {expandedImageUrl && (
        <div 
          className="fixed inset-0 bg-black/92 backdrop-blur-[6px] z-[9999] flex flex-col justify-between p-4 sm:p-6 select-none transition-all duration-300"
          onClick={() => setExpandedImageUrl(null)}
        >
          {/* Top Header Controls Bar */}
          <div className="w-full max-w-7xl mx-auto flex items-center justify-between py-2 z-10" onClick={(e) => e.stopPropagation()}>
            <span className="text-white/60 text-xs sm:text-sm font-mono">AI 创意图放大预览</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleDownloadImage(expandedImageUrl)}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white transition-all cursor-pointer shadow-lg backdrop-blur-md"
                title="下载原图"
              >
                <Download size={16} />
              </button>
              <button
                onClick={() => handleCopyImage(expandedImageUrl)}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white transition-all cursor-pointer shadow-lg backdrop-blur-md"
                title="复制图片"
              >
                {copiedMessageId === expandedImageUrl ? (
                  <Check size={16} className="text-green-500 animate-fade-in" />
                ) : (
                  <Copy size={16} />
                )}
              </button>
              <button
                onClick={() => setExpandedImageUrl(null)}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white transition-all cursor-pointer shadow-lg backdrop-blur-md"
                title="关闭"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Main Image Stage */}
          <div className="flex-1 flex items-center justify-center relative p-1 sm:p-4">
            <img 
              src={expandedImageUrl} 
              alt="Expanded AI Illustration" 
              className="max-w-full max-h-[82vh] object-contain rounded-2xl shadow-2xl border border-white/5 transition-transform duration-500 cursor-zoom-out select-all"
              onClick={() => setExpandedImageUrl(null)}
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Bottom Info Bar */}
          <div className="text-center text-white/45 text-[11px] mb-2 font-sans tracking-wider">
            点击画面任意区域即可返回对话
          </div>
        </div>
      )}

      {isUrlModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
          <div 
            className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl flex flex-col gap-5 animate-fade-in transition-all duration-300 ${
              config.bgImageUrl && bgTheme === 'dark'
                ? 'bg-[#121212]/95 border-white/10 text-white'
                : 'bg-white border-gray-150 text-gray-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold flex items-center gap-2 tracking-tight font-sans">
                <Link2 size={18} className="text-[#7D9878] animate-pulse" />
                分型对话导入 & 记忆复刻
              </h3>
              <button 
                onClick={() => {
                  setIsUrlModalOpen(false);
                  setImportError(null);
                }}
                className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-gray-400 hover:text-gray-650 dark:hover:text-white transition-colors"
                title="关闭"
              >
                <X size={16} />
              </button>
            </div>

            {/* TAB SELECTOR */}
            <div className="flex border-b border-gray-100 dark:border-white/5">
              <button
                onClick={() => { setActiveTab('url'); setImportError(null); }}
                className={`flex-1 pb-3 text-[13px] font-bold border-b-2 text-center transition-all cursor-pointer ${
                  activeTab === 'url'
                    ? 'border-[#7D9878] text-[#7D9878]'
                    : 'border-transparent text-gray-400 hover:text-gray-650 dark:hover:text-white'
                }`}
              >
                链接读取
              </button>
              <button
                onClick={() => { setActiveTab('text'); setImportError(null); }}
                className={`flex-1 pb-3 text-[13px] font-bold border-b-2 text-center transition-all cursor-pointer ${
                  activeTab === 'text'
                    ? 'border-[#7D9878] text-[#7D9878]'
                    : 'border-transparent text-gray-400 hover:text-gray-650 dark:hover:text-white'
                }`}
              >
                粘贴文本内容
              </button>
            </div>

            {/* TABS CONTAINER */}
            <div className="flex flex-col gap-4">
              {activeTab === 'url' ? (
                <div className="flex flex-col gap-4">
                  <input
                    type="url"
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    placeholder="请输入对话 JSON 链接或标准分享网页地址..."
                    className={`w-full px-4 py-3 text-xs border rounded-2xl outline-none transition-all ${
                      config.bgImageUrl && bgTheme === 'dark'
                        ? 'bg-black/40 border-white/10 text-white focus:border-[#7D9878]'
                        : 'bg-gray-55 border-gray-150 text-gray-850 focus:border-[#7D9878]'
                    }`}
                  />
                  <button
                    onClick={handleUrlImportSubmit}
                    disabled={isUrlImporting || !importUrl.trim()}
                    className={`w-full py-3 text-xs font-bold rounded-2xl text-white transition-all duration-200 cursor-pointer ${
                      isUrlImporting || !importUrl.trim()
                        ? 'bg-gray-300 dark:bg-white/10 cursor-not-allowed opacity-55'
                        : 'bg-[#7D9878] hover:bg-[#6b8566] hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-[#7D9878]/15 font-sans'
                    }`}
                  >
                    {isUrlImporting ? '正在连接读取...' : '自动导入并复刻记忆'}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <textarea
                    value={directJsonText}
                    onChange={(e) => setDirectJsonText(e.target.value)}
                    placeholder="请在此直接粘贴您复制的对话 JSON 结构内容..."
                    rows={6}
                    className={`w-full px-4 py-3 text-xs border rounded-2xl outline-none resize-none transition-colors font-mono ${
                      config.bgImageUrl && bgTheme === 'dark'
                        ? 'bg-black/40 border-white/10 text-white focus:border-[#7D9878]'
                        : 'bg-gray-55 border-gray-150 text-gray-850 focus:border-[#7D9878]'
                    }`}
                  />
                  <button
                    onClick={handleTextImportSubmit}
                    disabled={!directJsonText.trim()}
                    className={`w-full py-3 text-xs font-bold rounded-2xl text-white transition-all duration-200 cursor-pointer ${
                      !directJsonText.trim()
                        ? 'bg-gray-300 dark:bg-white/10 cursor-not-allowed opacity-55'
                        : 'bg-[#7D9878] hover:bg-[#6b8566] hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-[#7D9878]/15 font-sans'
                    }`}
                  >
                    读取并自动复刻记忆
                  </button>
                </div>
              )}

              {importError && (
                <div className="p-3 text-[11px] rounded-xl bg-red-500/10 border border-red-500/15 text-red-500 leading-normal select-text">
                  {importError}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {sessionToDeleteId && (() => {
        const targetSession = sessions.find(s => s.id === sessionToDeleteId);
        return (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
            <div 
              className={`w-full max-w-xs p-6 rounded-3xl border shadow-2xl flex flex-col gap-4 animate-fade-in transition-all duration-300 ${
                config.bgImageUrl && bgTheme === 'dark'
                  ? 'bg-[#121212]/95 border-white/10 text-white'
                  : 'bg-white border-gray-150 text-gray-800'
              }`}
            >
              <div className="flex flex-col items-center text-center gap-2">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-550 mb-1">
                  <X size={20} strokeWidth={3} />
                </div>
                <h3 className="text-sm font-bold tracking-tight font-sans">
                  确认要删除此对话吗？
                </h3>
                <p className="text-[11px] text-gray-400 dark:text-gray-400 leading-relaxed max-w-[240px]">
                  即将删除：<span className="text-gray-700 dark:text-gray-200 font-semibold">“{targetSession?.title || '新对话'}”</span><br />
                  一旦删除，该对话的历史记录与模型记忆都将永久丢失。
                </p>
              </div>

              <div className="flex gap-2.5 mt-1">
                <button
                  onClick={() => setSessionToDeleteId(null)}
                  className={`flex-1 py-2 text-xs font-bold rounded-2xl border transition-all duration-200 cursor-pointer ${
                    config.bgImageUrl && bgTheme === 'dark'
                      ? 'bg-white/5 border-white/10 text-white hover:bg-white/10 active:scale-95'
                      : 'bg-gray-50 border-gray-150 text-gray-650 hover:bg-gray-100 active:scale-95'
                  }`}
                >
                  取消
                </button>
                <button
                  onClick={confirmDeleteSession}
                  className="flex-1 py-2 text-xs font-bold rounded-2xl bg-red-500 hover:bg-red-600 active:scale-95 text-white transition-all duration-200 cursor-pointer shadow-md shadow-red-500/15"
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
