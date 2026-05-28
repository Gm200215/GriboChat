import { FileUp, MessageSquare, Plus, Trash2, Settings, Pencil, Link2, X, Pin } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { ChatSession } from '../lib/api';
import { parseImportFile, parseImportText } from '../lib/importExport';

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  onImportSessions: (sessions: ChatSession[]) => void;
  onOpenSettings: () => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onOpenImportModal: () => void;
  onTogglePinSession: (id: string) => void;
  hasBg?: boolean;
  bgTheme?: 'light' | 'dark';
}

export function Sidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onImportSessions,
  onOpenSettings,
  onRenameSession,
  onOpenImportModal,
  onTogglePinSession,
  hasBg = false,
  bgTheme = 'light',
}: SidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  // JS Event States for hover fallback in sandbox environment
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredPencilId, setHoveredPencilId] = useState<string | null>(null);
  const [hoveredTrashId, setHoveredTrashId] = useState<string | null>(null);
  const [hoveredPinId, setHoveredPinId] = useState<string | null>(null);
  const [isNewHovered, setIsNewHovered] = useState(false);
  const [isImportHovered, setIsImportHovered] = useState(false);
  const [isLinkImportHovered, setIsLinkImportHovered] = useState(false);
  const [isSettingsHovered, setIsSettingsHovered] = useState(false);

  const startEdit = (e: React.MouseEvent, session: ChatSession) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditTitle(session.title || '新对话');
  };

  const submitEdit = (id: string) => {
    if (editTitle.trim()) {
      onRenameSession(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const importedSessions = await parseImportFile(file);
      onImportSessions(importedSessions);
      alert(`成功导入 ${importedSessions.length} 条对话记录！`);
    } catch (error: any) {
      alert(`导入失败: ${error.message}`);
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={hasBg
      ? bgTheme === 'dark'
        ? "w-64 h-full bg-[#121212]/30 backdrop-blur-md border-r border-white/10 flex flex-col font-sans"
        : "w-64 h-full bg-white/45 backdrop-blur-md border-r border-[#E8E1D5]/40 flex flex-col font-sans"
      : "w-64 h-full bg-[#FDFBFA]/90 backdrop-blur-md border-r border-[#E8E1D5] flex flex-col font-sans"
    }>
      <div className="p-4 flex items-center justify-between mt-1 mb-2">
        <span className={hasBg
          ? bgTheme === 'dark'
            ? "text-xs font-bold text-white/50 uppercase tracking-wider pl-1 font-sans"
            : "text-xs font-bold text-gray-500 uppercase tracking-wider pl-1 font-sans"
          : "text-xs font-bold text-gray-500 uppercase tracking-wider pl-1 font-sans"
        }>
          历史会话
        </span>
        <button
          onClick={onNewSession}
          onMouseEnter={() => setIsNewHovered(true)}
          onMouseLeave={() => setIsNewHovered(false)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-white rounded-full transition-all duration-200 border cursor-pointer ${
            isNewHovered 
              ? 'bg-[#6b8566] border-[#6b8566] shadow-[0_4px_12px_rgba(107,133,102,0.35)] -translate-y-0.5 scale-105' 
              : 'bg-[#7D9878] border-[#7D9878]/35 shadow-sm scale-100'
          }`}
          title="新对话"
        >
          <Plus size={15} strokeWidth={2.5} />
          <span className="text-[13px] font-medium pr-0.5">新建</span>
        </button>
      </div>

      <div className="flex-1 custom-scrollbar px-3 space-y-2 py-2 overflow-y-auto">
        {(() => {
          const sorted = [...sessions].sort((a, b) => {
            const pinA = !!a.isPinned;
            const pinB = !!b.isPinned;
            if (pinA && !pinB) return -1;
            if (!pinA && pinB) return 1;
            return b.updatedAt - a.updatedAt;
          });
          return sorted.map((session) => {
            const isActive = activeSessionId === session.id;
            const isHovered = hoveredId === session.id;
            
            let itemBgClass = '';
            if (isActive) {
              itemBgClass = hasBg
                ? bgTheme === 'dark'
                  ? 'bg-[#7D9878]/40 border-[#7D9878]/70 text-white font-semibold scale-[1.02] -translate-y-0.5 shadow-md'
                  : 'bg-[#7D9878]/25 border-[#7D9878]/60 text-[#2b3e27] font-semibold scale-[1.02] -translate-y-0.5 shadow-sm'
                : 'bg-[#7D9878]/15 border-[#7D9878]/60 text-[#3b4e36] font-semibold scale-[1.02] -translate-y-0.5 shadow-sm';
            } else if (isHovered) {
              itemBgClass = hasBg
                ? bgTheme === 'dark'
                  ? 'bg-white/12 border-white/20 text-white scale-[1.02] -translate-y-0.5 shadow-xs'
                  : 'bg-white/60 border-[#D4B996] text-[#2b3e27] font-medium scale-[1.02] -translate-y-0.5 shadow-xs bg-white/60'
                : 'bg-white border-[#D4B996]/80 text-[#2b3e27] font-medium scale-[1.02] -translate-y-0.5 shadow-[0_4px_12px_rgba(212,185,150,0.15)]';
            } else if (session.isPinned) {
              itemBgClass = hasBg
                ? bgTheme === 'dark'
                  ? 'bg-[#7D9878]/10 border-[#7D9878]/30 text-white/90 font-medium scale-100 shadow-[0_2px_6px_rgba(0,0,0,0.06)]'
                  : 'bg-[#7D9878]/6 border-[#7D9878]/25 text-[#3b4e36] font-medium scale-100 shadow-[0_2px_6px_rgba(0,0,0,0.02)]'
                : 'bg-[#7D9878]/5 border-[#7D9878]/20 text-[#3e5239] font-medium scale-100 shadow-sm';
            } else {
              itemBgClass = hasBg
                ? bgTheme === 'dark'
                  ? 'bg-black/15 border-white/5 text-white/75 scale-100 translate-y-0'
                  : 'bg-white/35 border-[#E8E1D5]/40 text-gray-700 scale-100 translate-y-0'
                : 'bg-white border-[#E8E1D5] text-gray-600 scale-100 translate-y-0 shadow-[0_1px_3px_rgba(0,0,0,0.03)]';
            }

            return (
              <div
                key={session.id}
                onClick={() => { if (editingId !== session.id) onSelectSession(session.id); }}
                onMouseEnter={() => setHoveredId(session.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={`group flex items-center justify-between px-3.5 py-3 rounded-xl cursor-pointer transition-all duration-200 border ${itemBgClass}`}
              >
                {editingId === session.id ? (
                  <div className="flex-1 flex items-center gap-2 overflow-hidden px-1">
                    <input
                      autoFocus
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={() => submitEdit(session.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitEdit(session.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className={hasBg && bgTheme === 'dark'
                        ? "w-full text-[13px] bg-black/45 border border-white/15 rounded px-2 py-1 outline-none text-white focus:border-[#7D9878]"
                        : "w-full text-[13px] bg-white border border-[#E8E1D5] rounded px-2 py-1 outline-none text-[#222222] focus:border-[#7D9878]"
                      }
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 overflow-hidden pr-2">
                      <span className="truncate text-[13px]">
                        {session.title || '新对话'}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1 transition-all duration-200">
                      {/* Pin toggle button: always visible if session is pinned, otherwise visible on active/hovered */}
                      {(session.isPinned || isActive || isHovered) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onTogglePinSession(session.id);
                          }}
                          onMouseEnter={() => setHoveredPinId(session.id)}
                          onMouseLeave={() => setHoveredPinId(null)}
                          className={`p-1.5 rounded-md transition-all duration-200 cursor-pointer ${
                            session.isPinned
                              ? 'text-[#7D9878] scale-100 hover:scale-110'
                              : hoveredPinId === session.id
                                ? hasBg && bgTheme === 'dark'
                                  ? 'bg-white/10 text-white scale-110'
                                  : 'bg-[#7D9878]/10 text-[#7D9878] scale-110'
                                : 'text-gray-400 opacity-60 hover:opacity-100'
                          }`}
                          title={session.isPinned ? "取消置顶" : "置顶对话"}
                        >
                          <Pin 
                            size={14} 
                            className={`transition-transform duration-300 ${session.isPinned ? 'fill-[#7D9878] rotate-45' : ''}`} 
                          />
                        </button>
                      )}

                      {/* Edit and Delete action controls show up on hovered or active */}
                      {(isActive || isHovered) && (
                        <>
                          <button
                            onClick={(e) => startEdit(e, session)}
                            onMouseEnter={() => setHoveredPencilId(session.id)}
                            onMouseLeave={() => setHoveredPencilId(null)}
                            className={`p-1.5 rounded-md transition-all duration-200 cursor-pointer ${
                              hoveredPencilId === session.id 
                                ? hasBg && bgTheme === 'dark'
                                  ? 'bg-[#7D9878]/35 text-white shadow-sm scale-110'
                                  : 'bg-[#7D9878]/15 text-[#3b4e36] shadow-sm scale-110' 
                                : 'bg-transparent text-gray-400 scale-100'
                            }`}
                            title="重命名"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteSession(session.id);
                            }}
                            onMouseEnter={() => setHoveredTrashId(session.id)}
                            onMouseLeave={() => setHoveredTrashId(null)}
                            className={`p-1.5 rounded-md transition-all duration-200 cursor-pointer ${
                              hoveredTrashId === session.id 
                                ? 'bg-red-500 text-white shadow-md scale-110' 
                                : 'bg-transparent text-gray-400 scale-100'
                            }`}
                            title="删除"
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          });
        })()}
      </div>

      <div className={hasBg
        ? bgTheme === 'dark'
          ? "p-3 border-t border-white/10 space-y-2 bg-transparent"
          : "p-3 border-t border-[#E8E1D5]/40 space-y-2 bg-transparent"
        : "p-3 border-t border-[#E8E1D5] space-y-2 bg-[#FDFBFA]"
      }>
        <input
          type="file"
          accept=".json"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          onMouseEnter={() => setIsImportHovered(true)}
          onMouseLeave={() => setIsImportHovered(false)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 text-[13px] rounded-xl transition-all duration-300 font-medium group cursor-pointer ${
            isImportHovered 
              ? hasBg
                ? bgTheme === 'dark'
                  ? 'bg-white/10 text-white scale-[1.02] -translate-y-0.5 shadow-sm'
                  : 'bg-black/5 text-[#2b3e27] scale-[1.02] -translate-y-0.5 shadow-xs'
                : 'bg-[#7D9878]/10 text-[#2b3e27] scale-[1.02] -translate-y-0.5 shadow-sm' 
              : hasBg
              ? bgTheme === 'dark'
                ? 'bg-transparent text-white/70 scale-100 translate-y-0'
                : 'bg-transparent text-gray-700 scale-100 translate-y-0'
              : 'bg-transparent text-gray-600 scale-100 translate-y-0'
          }`}
        >
          <FileUp size={16} className={`transition-all duration-300 ${
            isImportHovered 
              ? 'text-[#7D9878] scale-110' 
              : hasBg && bgTheme === 'dark'
              ? 'text-white/60'
              : 'text-gray-500'
          }`} />
          导入记录 (文件)
        </button>
        <button
          onClick={onOpenImportModal}
          onMouseEnter={() => setIsLinkImportHovered(true)}
          onMouseLeave={() => setIsLinkImportHovered(false)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 text-[13px] rounded-xl transition-all duration-300 font-medium group cursor-pointer ${
            isLinkImportHovered 
              ? hasBg
                ? bgTheme === 'dark'
                  ? 'bg-white/10 text-white scale-[1.02] -translate-y-0.5 shadow-sm'
                  : 'bg-black/5 text-[#2b3e27] scale-[1.02] -translate-y-0.5 shadow-xs'
                : 'bg-[#7D9878]/10 text-[#2b3e27] scale-[1.02] -translate-y-0.5 shadow-sm' 
              : hasBg
              ? bgTheme === 'dark'
                ? 'bg-transparent text-white/70 scale-100 translate-y-0'
                : 'bg-transparent text-gray-700 scale-100 translate-y-0'
              : 'bg-transparent text-gray-600 scale-100 translate-y-0'
          }`}
        >
          <Link2 size={16} className={`transition-all duration-300 ${
            isLinkImportHovered 
              ? 'text-[#7D9878] scale-110' 
              : hasBg && bgTheme === 'dark'
              ? 'text-white/60'
              : 'text-gray-500'
          }`} />
          从链接导入
        </button>
        <button
          onClick={onOpenSettings}
          onMouseEnter={() => setIsSettingsHovered(true)}
          onMouseLeave={() => setIsSettingsHovered(false)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 text-[13px] rounded-xl transition-all duration-300 font-medium group cursor-pointer ${
            isSettingsHovered 
              ? hasBg
                ? bgTheme === 'dark'
                  ? 'bg-white/10 text-white scale-[1.02] -translate-y-0.5 shadow-sm'
                  : 'bg-black/5 text-[#2b3e27] scale-[1.02] -translate-y-0.5 shadow-xs'
                : 'bg-[#7D9878]/10 text-[#2b3e27] scale-[1.02] -translate-y-0.5 shadow-sm' 
              : hasBg
              ? bgTheme === 'dark'
                ? 'bg-transparent text-white/70 scale-100 translate-y-0'
                : 'bg-transparent text-gray-750 scale-100 translate-y-0'
              : 'bg-transparent text-gray-600 scale-100 translate-y-0'
          }`}
        >
          <Settings size={16} className={`transition-all duration-300 ${
            isSettingsHovered 
              ? 'text-[#7D9878] rotate-45' 
              : hasBg && bgTheme === 'dark'
              ? 'text-white/60'
              : 'text-gray-500'
          }`} />
          设置
        </button>
      </div>
    </div>
  );
}
