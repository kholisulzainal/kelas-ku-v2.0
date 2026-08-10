import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Trash2,
  User,
  Lightbulb,
  Archive,
  ArchiveRestore,
  RotateCcw,
  Edit2,
  MessageSquare,
  X,
  ShieldCheck,
  PanelRight,
  PanelRightClose,
  Plus,
  Search
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  status: 'active' | 'archived' | 'deleted';
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

interface AiTutorGuruViewProps {
  currentUserId?: string;
}

const createInitialWelcomeSession = (userId: string): ChatSession => {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const isoStr = now.toISOString();

  return {
    id: `session-${Date.now()}`,
    userId: userId,
    title: 'Obrolan Baru',
    status: 'active',
    createdAt: isoStr,
    updatedAt: isoStr,
    messages: [
      {
        id: `welcome-${Date.now()}`,
        role: 'model',
        text: `Halo Bapak/Ibu Guru!\nSaya AI Tutor Guru, siap menjadi sahabat diskusi dan rekan berpikir Bapak/Ibu dalam mengajar. Ada yang bisa saya bantu hari ini?`,
        timestamp: timeStr
      }
    ]
  };
};

export function AiTutorGuruView({ currentUserId = 'guru_default' }: AiTutorGuruViewProps) {
  const storageKey = `ai_tutor_sessions_v2_${currentUserId}`;

  // Load user-isolated sessions
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed: ChatSession[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error parsing AI Tutor session history:', e);
    }
    return [createInitialWelcomeSession(currentUserId)];
  });

  // Re-load when currentUserId changes (User Isolation)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed: ChatSession[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSessions(parsed);
          const firstActive = parsed.find(s => s.status === 'active') || parsed[0];
          setActiveSessionId(firstActive.id);
          return;
        }
      }
    } catch (e) {
      console.error('Error switching AI Tutor user:', e);
    }
    const newSession = createInitialWelcomeSession(currentUserId);
    setSessions([newSession]);
    setActiveSessionId(newSession.id);
  }, [currentUserId]);

  // Active Session ID
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const firstActive = sessions.find(s => s.status === 'active') || sessions[0];
    return firstActive ? firstActive.id : '';
  });

  // Sidebar expanded / collapsed mode (Gemini AI Style)
  const [isExpanded, setIsExpanded] = useState(false); // Default compact icon rail on desktop
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  // Active Tab Filter for History Drawer ('active' | 'archived' | 'deleted')
  const [viewFolder, setViewFolder] = useState<'active' | 'archived' | 'deleted'>('active');

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Input & UI States
  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Rename Session state
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const prevMsgCountRef = useRef<number>(0);

  // Save sessions to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(sessions));
    } catch (e) {
      console.error('Failed to save AI Tutor sessions:', e);
    }
  }, [sessions, storageKey]);

  // Get current active session
  const currentSession =
    sessions.find(s => s.id === activeSessionId) ||
    sessions[0] ||
    createInitialWelcomeSession(currentUserId);

  // Auto-scroll to bottom of chat container ONLY when new messages are added or loading
  useEffect(() => {
    const currentCount = currentSession?.messages?.length || 0;
    if (currentCount > prevMsgCountRef.current || isLoading) {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTo({
          top: chatContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
    prevMsgCountRef.current = currentCount;
  }, [currentSession?.id, currentSession?.messages?.length, isLoading]);

  // Handle Instant New Chat (Obrolan Baru)
  const handleStartNewChat = () => {
    const newSession = createInitialWelcomeSession(currentUserId);
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setViewFolder('active');
    setInputPrompt('');
    setShowMobileSidebar(false);
  };

  const quickPrompts = [
    {
      label: 'Ice Breaking 5 Menit',
      prompt: 'Berikan 3 ide ice breaking edukatif yang cepat dan seru untuk mencairkan suasana kelas sebelum mulai pelajaran.'
    },
    {
      label: 'Menghadapi Siswa Pasif',
      prompt: 'Bagaimana cara praktis mengajak siswa yang pasif dan pendiam agar aktif berpartisipasi dalam diskusi kelompok?'
    },
    {
      label: 'Pembelajaran Berdiferensiasi',
      prompt: 'Berikan contoh sederhana penerapan pembelajaran berdiferensiasi untuk kelas dengan tingkat pemahaman siswa yang beragam.'
    },
    {
      label: 'Rubrik Penilaian Sikap',
      prompt: 'Buatkan contoh rubrik observasi penilaian sikap dan kerja sama siswa dalam tugas kelompok.'
    },
    {
      label: 'Ide Project P5',
      prompt: 'Berikan ide tema proyek P5 (Profil Pelajar Pancasila) yang menarik dan mudah diterapkan siswa di sekolah.'
    }
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const messageText = (textToSend || inputPrompt).trim();
    if (!messageText || isLoading || !currentSession) return;

    const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: messageText,
      timestamp: timeStr
    };

    // Update active session with user message & update title if first prompt
    const isFirstUserMsg = currentSession.messages.filter(m => m.role === 'user').length === 0;
    const newTitle = isFirstUserMsg
      ? messageText.length > 35
        ? messageText.substring(0, 35) + '...'
        : messageText
      : currentSession.title;

    const updatedMessages = [...currentSession.messages, userMessage];

    setSessions(prev =>
      prev.map(s => {
        if (s.id === currentSession.id) {
          return {
            ...s,
            title: newTitle,
            updatedAt: new Date().toISOString(),
            messages: updatedMessages
          };
        }
        return s;
      })
    );

    if (!textToSend) setInputPrompt('');
    setIsLoading(true);

    try {
      const historyPayload = updatedMessages.map(m => ({
        role: m.role,
        text: m.text
      }));

      const res = await fetch('/api/ai/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: messageText,
          history: historyPayload
        })
      });

      const data = await res.json();

      if (data.success && data.reply) {
        const botMessage: ChatMessage = {
          id: `bot-${Date.now()}`,
          role: 'model',
          text: data.reply,
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        };

        setSessions(prev =>
          prev.map(s => {
            if (s.id === currentSession.id) {
              return {
                ...s,
                updatedAt: new Date().toISOString(),
                messages: [...s.messages, botMessage]
              };
            }
            return s;
          })
        );
      } else {
        const errorMessage: ChatMessage = {
          id: `err-${Date.now()}`,
          role: 'model',
          text: `⚠️ **Gagal terhubung ke AI Tutor**: ${data.error || 'Terjadi masalah jaringan.'}`,
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        };

        setSessions(prev =>
          prev.map(s => {
            if (s.id === currentSession.id) {
              return {
                ...s,
                messages: [...s.messages, errorMessage]
              };
            }
            return s;
          })
        );
      }
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'model',
        text: `⚠️ **Terjadi kesalahan**: ${err.message || 'Gagal memproses pertanyaan.'}`,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      };

      setSessions(prev =>
        prev.map(s => {
          if (s.id === currentSession.id) {
            return {
              ...s,
              messages: [...s.messages, errorMessage]
            };
          }
          return s;
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Archive Session
  const handleArchiveSession = (sessionId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSessions(prev =>
      prev.map(s => (s.id === sessionId ? { ...s, status: 'archived' } : s))
    );
  };

  // Unarchive / Restore Session
  const handleRestoreSession = (sessionId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    setSessions(prev =>
      prev.map(s => (s.id === sessionId ? { ...s, status: 'active' } : s))
    );
  };

  // Move to Trash (Delete)
  const handleMoveToTrash = (sessionId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    setSessions(prev =>
      prev.map(s => (s.id === sessionId ? { ...s, status: 'deleted' } : s))
    );
  };

  // Delete Permanently
  const handleDeletePermanently = (sessionId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();

    setSessions(prev => {
      const nextSessions = prev.filter(s => s.id !== sessionId);
      if (nextSessions.length === 0) {
        const fresh = createInitialWelcomeSession(currentUserId);
        setTimeout(() => setActiveSessionId(fresh.id), 0);
        return [fresh];
      }
      return nextSessions;
    });

    if (sessionId === activeSessionId) {
      const remaining = sessions.filter(s => s.id !== sessionId);
      if (remaining.length > 0) {
        const nextActive = remaining.find(s => s.status === 'active') || remaining[0];
        setActiveSessionId(nextActive.id);
      }
    }
  };

  // Empty Trash Completely
  const handleEmptyTrash = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();

    setSessions(prev => {
      const nextSessions = prev.filter(s => s.status !== 'deleted');
      if (nextSessions.length === 0) {
        const fresh = createInitialWelcomeSession(currentUserId);
        setTimeout(() => setActiveSessionId(fresh.id), 0);
        return [fresh];
      }
      return nextSessions;
    });

    const remaining = sessions.filter(s => s.status !== 'deleted');
    if (remaining.length > 0 && !remaining.some(s => s.id === activeSessionId)) {
      const nextActive = remaining.find(s => s.status === 'active') || remaining[0];
      setActiveSessionId(nextActive.id);
    }
  };

  // Start Editing Title
  const handleStartRename = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  };

  // Save Title
  const handleSaveRename = (sessionId: string) => {
    if (editingTitle.trim()) {
      setSessions(prev =>
        prev.map(s => (s.id === sessionId ? { ...s, title: editingTitle.trim() } : s))
      );
    }
    setEditingSessionId(null);
  };

  // Render Markdown Formatter
  const renderFormattedMarkdown = (text: string) => {
    const lines = text.split('\n');
    return (
      <div className="space-y-2 text-sm leading-relaxed">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={idx} className="h-1" />;

          if (
            trimmed.startsWith('### ') ||
            (trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.length < 80)
          ) {
            const headingText = trimmed
              .replace(/^###\s*/, '')
              .replace(/^\*\*/, '')
              .replace(/\*\*$/, '');
            return (
              <h4
                key={idx}
                className="font-bold text-slate-900 dark:text-white mt-2.5 mb-1 text-sm sm:text-base flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                {headingText}
              </h4>
            );
          }

          if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
            const bulletContent = trimmed.substring(2);
            return (
              <div key={idx} className="flex items-start gap-2 pl-2">
                <span className="text-blue-500 font-bold">•</span>
                <span dangerouslySetInnerHTML={{ __html: parseBoldText(bulletContent) }} />
              </div>
            );
          }

          if (/^\d+\.\s/.test(trimmed)) {
            const num = trimmed.match(/^\d+\./)?.[0] || '';
            const listContent = trimmed.replace(/^\d+\.\s*/, '');
            return (
              <div key={idx} className="flex items-start gap-2 pl-2">
                <span className="text-blue-600 dark:text-blue-400 font-bold shrink-0">{num}</span>
                <span dangerouslySetInnerHTML={{ __html: parseBoldText(listContent) }} />
              </div>
            );
          }

          return (
            <p key={idx} dangerouslySetInnerHTML={{ __html: parseBoldText(trimmed) }} />
          );
        })}
      </div>
    );
  };

  const parseBoldText = (str: string) => {
    return str.replace(
      /\*\*(.*?)\*\*/g,
      '<strong class="font-bold text-slate-900 dark:text-white">$1</strong>'
    );
  };

  const activeCount = sessions.filter(s => s.status === 'active').length;
  const archivedCount = sessions.filter(s => s.status === 'archived').length;
  const deletedCount = sessions.filter(s => s.status === 'deleted').length;

  const filteredSessions = sessions.filter(s => {
    const matchesStatus = s.status === viewFolder;
    const matchesQuery = searchQuery.trim()
      ? s.title.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    return matchesStatus && matchesQuery;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-3">
      {/* Top Header Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 sm:p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 text-white flex items-center justify-center shadow-xs shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>AI Tutor Guru</span>
              <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 text-[10px] font-black rounded-full border border-blue-200/60 dark:border-blue-800">
                Gemini AI
              </span>
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[200px] sm:max-w-xs md:max-w-md">
              {currentSession?.title || 'Obrolan Baru'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* User Privacy Indicator */}
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 rounded-xl border border-emerald-200/60 dark:border-emerald-800 text-[11px] font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Tersimpan Terpisah per Akun</span>
          </div>

          {/* Toggle Sidebar Button on the Right */}
          <button
            onClick={() => {
              if (window.innerWidth < 768) {
                setShowMobileSidebar(true);
              } else {
                setIsExpanded(!isExpanded);
              }
            }}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-all cursor-pointer relative flex items-center gap-2 group"
            title={isExpanded ? 'Sembunyikan Riwayat' : 'Buka Riwayat Percakapan'}
          >
            {isExpanded ? (
              <PanelRightClose className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            ) : (
              <PanelRight className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            )}
            <span className="hidden sm:inline text-xs font-semibold text-slate-700 dark:text-slate-300">
              {isExpanded ? 'Tutup Riwayat' : 'Riwayat'}
            </span>
            {archivedCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full" />
            )}
          </button>
        </div>
      </div>

      {/* Main Container Layout */}
      <div className="relative flex gap-3 h-[580px] sm:h-[640px]">
        {/* MAIN CHAT AREA (SPACIOUS & EXPANDABLE - PLACED FIRST/LEFT) */}
        <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden min-w-0">
          {/* Chat Messages Stream */}
          <div ref={chatContainerRef} className="flex-1 p-3.5 sm:p-6 overflow-y-auto space-y-4 bg-slate-50/60 dark:bg-slate-950/40">
            {currentSession?.messages?.map(msg => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2.5 sm:gap-3 ${
                    isUser ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold shadow-xs ${
                      isUser
                        ? 'bg-blue-600 text-white'
                        : 'bg-gradient-to-tr from-amber-500 to-orange-500 text-white'
                    }`}
                  >
                    {isUser ? <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                  </div>

                  <div
                    className={`max-w-[88%] sm:max-w-[82%] rounded-2xl px-3.5 sm:px-4 py-2.5 sm:py-3 shadow-2xs relative ${
                      isUser
                        ? 'bg-blue-600 text-white rounded-tr-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700/80 rounded-tl-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4 mb-1 text-[10px] opacity-75 font-semibold">
                      <span>{isUser ? 'Anda' : 'AI Tutor'}</span>
                      <span>{msg.timestamp}</span>
                    </div>

                    {isUser ? (
                      <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed font-medium">
                        {msg.text}
                      </p>
                    ) : (
                      renderFormattedMarkdown(msg.text)
                    )}

                    {!isUser && (
                      <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-end">
                        <button
                          onClick={() => handleCopyText(msg.id, msg.text)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer"
                          title="Salin jawaban"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                              <span className="text-emerald-600 font-bold">Tersalin</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Salin</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shrink-0 shadow-xs animate-pulse">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-tl-xs px-4 py-3 shadow-2xs flex items-center gap-2.5">
                  <RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    AI Tutor sedang mengetik jawaban...
                  </span>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Quick Suggestion Chips */}
          <div className="p-2 sm:p-2.5 bg-slate-100/70 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 overflow-x-auto">
            <div className="flex items-center gap-2 min-w-max">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 px-1">
                Contoh:
              </span>
              {quickPrompts.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(item.prompt)}
                  disabled={isLoading}
                  className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-xl text-[11px] sm:text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Input Text Box */}
          <div className="p-2.5 sm:p-3.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 sm:gap-2.5">
            <textarea
              value={inputPrompt}
              onChange={e => setInputPrompt(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Minta Gemini"
              rows={2}
              className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />

            <button
              onClick={() => handleSendMessage()}
              disabled={!inputPrompt.trim() || isLoading}
              className="h-10 sm:h-11 px-3.5 sm:px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span className="hidden sm:inline">Kirim</span>
                  <Send className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* DESKTOP COMPACT RAIL ON THE RIGHT (When collapsed on desktop) */}
        {!isExpanded && (
          <div className="hidden md:flex flex-col items-center py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs shrink-0 w-16 space-y-3 transition-all">
            <button
              onClick={() => setIsExpanded(true)}
              className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer relative"
              title="Buka Panel Riwayat Obrolan"
            >
              <PanelRight className="w-5 h-5" />
            </button>

            <div className="w-8 h-px bg-slate-200 dark:bg-slate-800" />

            <button
              onClick={handleStartNewChat}
              className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
              title="Mulai Obrolan Baru (+)"
            >
              <Plus className="w-5 h-5" />
            </button>

            <button
              onClick={() => {
                setViewFolder('active');
                setIsExpanded(true);
              }}
              className={`p-2.5 rounded-xl transition-all cursor-pointer relative ${
                viewFolder === 'active' && isExpanded
                  ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title={`Obrolan Aktif (${activeCount})`}
            >
              <MessageSquare className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 px-1 py-0.2 bg-blue-600 text-white text-[9px] font-extrabold rounded-full min-w-[16px] text-center">
                {activeCount}
              </span>
            </button>

            <button
              onClick={() => {
                setViewFolder('archived');
                setIsExpanded(true);
              }}
              className={`p-2.5 rounded-xl transition-all cursor-pointer relative ${
                viewFolder === 'archived' && isExpanded
                  ? 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 font-bold'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title={`Arsip Obrolan (${archivedCount})`}
            >
              <Archive className="w-5 h-5" />
              {archivedCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1 py-0.2 bg-amber-500 text-white text-[9px] font-extrabold rounded-full min-w-[16px] text-center">
                  {archivedCount}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setViewFolder('deleted');
                setIsExpanded(true);
              }}
              className={`p-2.5 rounded-xl transition-all cursor-pointer relative ${
                viewFolder === 'deleted' && isExpanded
                  ? 'bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 font-bold'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title={`Sampah (${deletedCount})`}
            >
              <Trash2 className="w-5 h-5" />
              {deletedCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1 py-0.2 bg-rose-500 text-white text-[9px] font-extrabold rounded-full min-w-[16px] text-center">
                  {deletedCount}
                </span>
              )}
            </button>
          </div>
        )}

        {/* EXPANDED DESKTOP SIDEBAR ON THE RIGHT */}
        {isExpanded && (
          <div className="hidden md:flex flex-col w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden transition-all shrink-0">
            {/* Drawer Header */}
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-950/40">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Riwayat Percakapan
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleStartNewChat}
                  className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                  title="Obrolan Baru"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 rounded-lg cursor-pointer"
                  title="Tutup Panel"
                >
                  <PanelRightClose className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Folder Filter Tabs (Aktif / Arsip / Sampah) */}
            <div className="grid grid-cols-3 p-1.5 bg-slate-100 dark:bg-slate-800/60 m-2.5 rounded-xl text-[11px] font-bold">
              <button
                onClick={() => setViewFolder('active')}
                className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  viewFolder === 'active'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs font-extrabold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <span>Aktif</span>
                <span className="px-1.5 py-0.2 bg-slate-200 dark:bg-slate-700 rounded-full text-[9px]">
                  {activeCount}
                </span>
              </button>

              <button
                onClick={() => setViewFolder('archived')}
                className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  viewFolder === 'archived'
                    ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-2xs font-extrabold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <span>Arsip</span>
                <span className="px-1.5 py-0.2 bg-slate-200 dark:bg-slate-700 rounded-full text-[9px]">
                  {archivedCount}
                </span>
              </button>

              <button
                onClick={() => setViewFolder('deleted')}
                className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  viewFolder === 'deleted'
                    ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-2xs font-extrabold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <span>Sampah</span>
                <span className="px-1.5 py-0.2 bg-slate-200 dark:bg-slate-700 rounded-full text-[9px]">
                  {deletedCount}
                </span>
              </button>
            </div>

            {/* Empty Trash button if viewing deleted folder */}
            {viewFolder === 'deleted' && deletedCount > 0 && (
              <div className="px-2.5 mb-2">
                <button
                  onClick={handleEmptyTrash}
                  className="w-full py-1.5 px-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Kosongkan Sampah ({deletedCount})</span>
                </button>
              </div>
            )}

            {/* Search Input inside History */}
            <div className="px-2.5 mb-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Cari percakapan..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Session List */}
            <div className="flex-1 overflow-y-auto px-2.5 space-y-1.5">
              {filteredSessions.length === 0 ? (
                <div className="text-center py-8 px-3 text-xs text-slate-400">
                  {viewFolder === 'active' && 'Belum ada obrolan aktif.'}
                  {viewFolder === 'archived' && 'Belum ada obrolan diarsipkan.'}
                  {viewFolder === 'deleted' && 'Sampah kosong.'}
                </div>
              ) : (
                filteredSessions.map(s => {
                  const isActive = s.id === activeSessionId;
                  const isEditing = editingSessionId === s.id;

                  return (
                    <div
                      key={s.id}
                      onClick={() => {
                        setActiveSessionId(s.id);
                      }}
                      className={`group relative p-2 rounded-xl border text-xs transition-all cursor-pointer flex items-center justify-between gap-2 ${
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-950/70 border-blue-300 dark:border-blue-800 font-bold text-blue-900 dark:text-blue-100 shadow-2xs'
                          : 'bg-white dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <MessageSquare
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'
                          }`}
                        />

                        {isEditing ? (
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={e => setEditingTitle(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleSaveRename(s.id);
                            }}
                            onBlur={() => handleSaveRename(s.id)}
                            autoFocus
                            className="w-full bg-white dark:bg-slate-900 border border-blue-500 rounded px-1.5 py-0.5 text-xs text-slate-900 dark:text-white"
                          />
                        ) : (
                          <span className="truncate">{s.title}</span>
                        )}
                      </div>

                      {/* Action buttons (Always visible in deleted tab or on hover) */}
                      <div className={`flex items-center gap-1 shrink-0 ${viewFolder === 'deleted' ? 'opacity-100' : 'sm:opacity-0 group-hover:opacity-100'} transition-opacity`}>
                        {viewFolder === 'active' && (
                          <>
                            <button
                              type="button"
                              onClick={e => handleStartRename(s, e)}
                              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 rounded cursor-pointer"
                              title="Ubah Nama"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={e => handleArchiveSession(s.id, e)}
                              className="p-1 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-600 rounded cursor-pointer"
                              title="Arsipkan Chat"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={e => handleMoveToTrash(s.id, e)}
                              className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 rounded cursor-pointer"
                              title="Hapus ke Sampah"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}

                        {viewFolder === 'archived' && (
                          <>
                            <button
                              type="button"
                              onClick={e => handleRestoreSession(s.id, e)}
                              className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 rounded cursor-pointer"
                              title="Keluarkan dari Arsip"
                            >
                              <ArchiveRestore className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={e => handleMoveToTrash(s.id, e)}
                              className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 rounded cursor-pointer"
                              title="Hapus ke Sampah"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}

                        {viewFolder === 'deleted' && (
                          <>
                            <button
                              type="button"
                              onClick={e => handleRestoreSession(s.id, e)}
                              className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded cursor-pointer"
                              title="Pulihkan Chat"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={e => handleDeletePermanently(s.id, e)}
                              className="p-1.5 hover:bg-rose-200 dark:hover:bg-rose-900/80 text-rose-700 dark:text-rose-300 rounded bg-rose-100 dark:bg-rose-950/80 transition-all cursor-pointer shadow-xs"
                              title="Hapus Permanen"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* MOBILE SLIDE-OVER SIDEBAR / OVERLAY DRAWER */}
        {showMobileSidebar && (
          <div className="md:hidden fixed inset-0 z-50 flex justify-end">
            <div
              onClick={() => setShowMobileSidebar(false)}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            />
            <div className="relative w-80 max-w-[85%] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col z-10 h-full shadow-2xl">
              <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Riwayat Percakapan
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleStartNewChat}
                    className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                    title="Obrolan Baru"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setShowMobileSidebar(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Folder Tabs */}
              <div className="grid grid-cols-3 p-1.5 bg-slate-100 dark:bg-slate-800/60 m-3 rounded-xl text-[11px] font-bold">
                <button
                  onClick={() => setViewFolder('active')}
                  className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all ${
                    viewFolder === 'active'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 font-extrabold shadow-2xs'
                      : 'text-slate-500'
                  }`}
                >
                  <span>Aktif</span>
                  <span className="px-1.5 py-0.2 bg-slate-200 dark:bg-slate-700 rounded-full text-[9px]">
                    {activeCount}
                  </span>
                </button>
                <button
                  onClick={() => setViewFolder('archived')}
                  className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all ${
                    viewFolder === 'archived'
                      ? 'bg-white dark:bg-slate-900 text-amber-600 font-extrabold shadow-2xs'
                      : 'text-slate-500'
                  }`}
                >
                  <span>Arsip</span>
                  <span className="px-1.5 py-0.2 bg-slate-200 dark:bg-slate-700 rounded-full text-[9px]">
                    {archivedCount}
                  </span>
                </button>
                <button
                  onClick={() => setViewFolder('deleted')}
                  className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all ${
                    viewFolder === 'deleted'
                      ? 'bg-white dark:bg-slate-900 text-rose-600 font-extrabold shadow-2xs'
                      : 'text-slate-500'
                  }`}
                >
                  <span>Sampah</span>
                  <span className="px-1.5 py-0.2 bg-slate-200 dark:bg-slate-700 rounded-full text-[9px]">
                    {deletedCount}
                  </span>
                </button>
              </div>

              {/* Empty Trash button in mobile view */}
              {viewFolder === 'deleted' && deletedCount > 0 && (
                <div className="px-3 mb-2">
                  <button
                    onClick={handleEmptyTrash}
                    className="w-full py-1.5 px-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Kosongkan Sampah ({deletedCount})</span>
                  </button>
                </div>
              )}

              {/* Search */}
              <div className="px-3 mb-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Cari percakapan..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-3 space-y-1.5">
                {filteredSessions.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400">
                    Kosong.
                  </div>
                ) : (
                  filteredSessions.map(s => (
                    <div
                      key={s.id}
                      onClick={() => {
                        setActiveSessionId(s.id);
                        setShowMobileSidebar(false);
                      }}
                      className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                        s.id === activeSessionId
                          ? 'bg-blue-50 dark:bg-blue-950/70 border-blue-300 dark:border-blue-800 font-bold text-blue-900 dark:text-blue-100'
                          : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                        <MessageSquare className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="truncate">{s.title}</span>
                      </div>

                      {/* Action buttons on mobile */}
                      <div className="flex items-center gap-1 shrink-0">
                        {viewFolder === 'active' && (
                          <button
                            onClick={e => handleMoveToTrash(s.id, e)}
                            className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 rounded"
                            title="Hapus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {viewFolder === 'archived' && (
                          <button
                            onClick={e => handleRestoreSession(s.id, e)}
                            className="p-1 text-blue-600 rounded"
                            title="Keluarkan dari Arsip"
                          >
                            <ArchiveRestore className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {viewFolder === 'deleted' && (
                          <>
                            <button
                              onClick={e => handleRestoreSession(s.id, e)}
                              className="p-1 text-emerald-600 rounded"
                              title="Pulihkan"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={e => handleDeletePermanently(s.id, e)}
                              className="p-1 text-rose-600 rounded"
                              title="Hapus Permanen"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
