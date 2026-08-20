import React, { useState, useRef, useEffect } from 'react';
import { db } from '../services/db';
import { callAiTutor, getStoredGeminiApiKey, setStoredGeminiApiKey, testGeminiApiKey } from '../services/geminiClient';
import {
  Send,
  Sparkles,
  Copy,
  Check,
  Trash2,
  User,
  RotateCcw,
  Plus,
  Search,
  Mic,
  MicOff,
  X,
  ExternalLink,
  Volume2,
  VolumeX,
  ThumbsUp,
  ChevronDown,
  FileText,
  PanelLeftClose,
  PanelLeft,
  ArrowUp,
  MessageSquare,
  Key,
  Settings,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff
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

interface UploadedFile {
  name: string;
  size: number;
  type: string;
  textContent: string;
}

const createInitialWelcomeSession = (userId: string): ChatSession => {
  const now = new Date();
  const isoStr = now.toISOString();

  return {
    id: `session-${Date.now()}`,
    userId: userId,
    title: 'Obrolan Baru',
    status: 'active',
    createdAt: isoStr,
    updatedAt: isoStr,
    messages: []
  };
};

export function AiTutorGuruView({ currentUserId = 'guru_default' }: AiTutorGuruViewProps) {
  const storageKey = `ai_tutor_sessions_v3_${currentUserId}`;

  // Helper to retrieve logged-in teacher name from database
  const getLoggedInGuruName = (): string => {
    try {
      const user = db.getCurrentUser();
      let nameToUse = user?.name;
      if (currentUserId && currentUserId !== 'guru_default') {
        const g = db.guru.getAll().find(item => item.id === currentUserId);
        if (g && g.namaGuru) {
          nameToUse = g.namaGuru;
        }
      }
      if (nameToUse) {
        // Strip academic titles like ", S.Pd.", ", M.Pd."
        let clean = nameToUse.split(',')[0].trim();
        const words = clean.split(' ').filter(Boolean);
        if (words.length > 0) {
          return words[0]; // First name / calling name e.g. "Kholisul"
        }
        return clean;
      }
    } catch (e) {
      console.error('Error fetching logged in teacher name:', e);
    }
    return 'Guru';
  };

  const loggedInName = getLoggedInGuruName();

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

  // Re-load when currentUserId changes
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

  // UI Drawer & Model Selector States
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<'flash' | 'pro'>('flash');
  const [searchQuery, setSearchQuery] = useState('');

  // API Key Quick Configuration Modal State
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(() => getStoredGeminiApiKey());
  const [showKeySecret, setShowKeySecret] = useState(false);
  const [apiKeyStatusMsg, setApiKeyStatusMsg] = useState<{ success: boolean; text: string } | null>(null);
  const [isTestingKey, setIsTestingKey] = useState(false);

  const handleSaveApiKey = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setStoredGeminiApiKey(apiKeyInput);
    setApiKeyStatusMsg({ success: true, text: 'API Key berhasil disimpan di peramban Anda!' });
    setTimeout(() => {
      setApiKeyStatusMsg(null);
      setShowApiKeyModal(false);
    }, 1500);
  };

  const handleTestKeyInModal = async () => {
    setIsTestingKey(true);
    setApiKeyStatusMsg(null);
    try {
      const res = await testGeminiApiKey(apiKeyInput);
      setApiKeyStatusMsg({ success: res.success, text: res.message });
    } catch (err: any) {
      setApiKeyStatusMsg({ success: false, text: err.message || 'Gagal menguji key.' });
    } finally {
      setIsTestingKey(false);
    }
  };

  // Speech & Attachment States
  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [likedMsgs, setLikedMsgs] = useState<Record<string, boolean>>({});

  const [attachment, setAttachment] = useState<UploadedFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Save sessions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(sessions));
    } catch (e) {
      console.error('Failed to save AI Tutor sessions:', e);
    }
  }, [sessions, storageKey]);

  // Active session helper
  const currentSession =
    sessions.find(s => s.id === activeSessionId) ||
    sessions[0] ||
    createInitialWelcomeSession(currentUserId);

  const hasMessages = currentSession && currentSession.messages.length > 0;

  // Auto scroll to bottom
  useEffect(() => {
    if (hasMessages && chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [currentSession?.messages?.length, isLoading, hasMessages]);

  // Handle New Chat
  const handleStartNewChat = () => {
    const newSession = createInitialWelcomeSession(currentUserId);
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setInputPrompt('');
    setAttachment(null);
    setIsSidebarOpen(false);
  };

  // Attachment upload handler
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    const isTextLike = file.type.includes('text') || 
      ['.txt', '.md', '.csv', '.json', '.html', '.js', '.ts'].some(ext => file.name.toLowerCase().endsWith(ext));

    if (isTextLike) {
      reader.onload = (evt) => {
        const text = (evt.target?.result as string) || '';
        setAttachment({
          name: file.name,
          size: file.size,
          type: file.type || 'text/plain',
          textContent: text
        });
      };
      reader.readAsText(file);
    } else {
      reader.onload = (evt) => {
        const buffer = evt.target?.result as ArrayBuffer;
        let extractedText = '';
        if (buffer) {
          const decoder = new TextDecoder('utf-8', { fatal: false });
          const rawText = decoder.decode(buffer);
          extractedText = rawText.replace(/[\x00-\x09\x0B-\x1F\x7F-\x9F]/g, ' ').replace(/\s+/g, ' ').trim();
          if (extractedText.length > 4000) {
            extractedText = extractedText.substring(0, 4000) + '... (sebagian isi berkas)';
          }
        }
        setAttachment({
          name: file.name,
          size: file.size,
          type: file.type || file.name.split('.').pop() || 'document',
          textContent: extractedText || `Berkas terlampir: ${file.name}`
        });
      };
      reader.readAsArrayBuffer(file);
    }
  };

  // Voice speech-to-text handler
  const handleVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Browser Anda belum mendukung input suara. Silakan gunakan Google Chrome atau MS Edge.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'id-ID';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0]?.transcript;
        if (transcript) {
          setInputPrompt(prev => prev ? `${prev} ${transcript}` : transcript);
        }
      };
      recognition.start();
    } catch (err) {
      console.error('Speech recognition error:', err);
      setIsListening(false);
    }
  };

  // Audio Speech synthesis
  const handleSpeak = (msgId: string, text: string) => {
    if (!('speechSynthesis' in window)) return;

    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'id-ID';
    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);
    setSpeakingMsgId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  // Send message
  const handleSendMessage = async (textToSend?: string) => {
    const rawText = (textToSend || inputPrompt).trim();
    if ((!rawText && !attachment) || isLoading || !currentSession) return;

    let fullText = rawText;
    if (attachment) {
      fullText = rawText 
        ? `${rawText}\n\n[DOKUMEN TERLAMPIR: "${attachment.name}"]\nContent:\n${attachment.textContent}`
        : `[DOKUMEN TERLAMPIR: "${attachment.name}"]\nContent:\n${attachment.textContent}`;
    }

    const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: rawText || `[Lampiran: ${attachment?.name}]`,
      timestamp: timeStr
    };

    const isFirstMsg = currentSession.messages.length === 0;
    const newTitle = isFirstMsg
      ? rawText.length > 30 ? rawText.substring(0, 30) + '...' : rawText || attachment?.name || 'Obrolan Baru'
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

    setInputPrompt('');
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsLoading(true);

    try {
      const historyPayload = currentSession.messages.map(m => ({
        role: m.role,
        text: m.text
      }));

      const data = await callAiTutor({
        prompt: fullText,
        history: historyPayload
      });

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
        const isKeyMissing = data.error?.toLowerCase().includes('gemini_api_key') || data.error?.toLowerCase().includes('api key');
        const errorMessage: ChatMessage = {
          id: `err-${Date.now()}`,
          role: 'model',
          text: `⚠️ **Gagal terhubung ke Gemini AI**: ${data.error || 'Terjadi masalah koneksi.'}${
            isKeyMissing 
              ? '\n\n👉 **Solusi Cepat**: Klik tombol **Kunci API** di kanan atas untuk memasukkan Gemini API Key gratis dari Google AI Studio.' 
              : ''
          }`,
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        };

        setSessions(prev =>
          prev.map(s => (s.id === currentSession.id ? { ...s, messages: [...s.messages, errorMessage] } : s))
        );
      }
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'model',
        text: `⚠️ **Terjadi kesalahan**: ${err.message || 'Gagal memproses.'}`,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      };
      setSessions(prev =>
        prev.map(s => (s.id === currentSession.id ? { ...s, messages: [...s.messages, errorMessage] } : s))
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Regenerate last response
  const handleRegenerate = async () => {
    if (isLoading || !currentSession) return;
    const msgs = currentSession.messages;
    if (msgs.length === 0) return;

    const lastUserIdx = msgs.reduce((lastIdx, m, idx) => (m.role === 'user' ? idx : lastIdx), -1);
    if (lastUserIdx === -1) return;

    const lastUserMsg = msgs[lastUserIdx];
    const trimmedMsgs = msgs.slice(0, lastUserIdx + 1);
    const historyPayload = msgs.slice(0, lastUserIdx).map(m => ({ role: m.role, text: m.text }));

    setSessions(prev =>
      prev.map(s => (s.id === currentSession.id ? { ...s, messages: trimmedMsgs } : s))
    );

    setIsLoading(true);

    try {
      const data = await callAiTutor({
        prompt: lastUserMsg.text,
        history: historyPayload
      });

      if (data.success && data.reply) {
        const botMessage: ChatMessage = {
          id: `bot-${Date.now()}`,
          role: 'model',
          text: data.reply,
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        };

        setSessions(prev =>
          prev.map(s => (s.id === currentSession.id ? { ...s, messages: [...s.messages, botMessage] } : s))
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Copy helper
  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Delete session
  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions(prev => {
      const remaining = prev.filter(s => s.id !== sessionId);
      if (remaining.length === 0) {
        const fresh = createInitialWelcomeSession(currentUserId);
        setTimeout(() => setActiveSessionId(fresh.id), 0);
        return [fresh];
      }
      return remaining;
    });

    if (sessionId === activeSessionId) {
      const remaining = sessions.filter(s => s.id !== sessionId);
      if (remaining.length > 0) {
        setActiveSessionId(remaining[0].id);
      }
    }
  };

  // Format Markdown
  const renderFormattedMarkdown = (text: string) => {
    const lines = text.split('\n');
    return (
      <div className="space-y-2.5 text-sm sm:text-base text-slate-800 dark:text-slate-100 leading-relaxed font-sans">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={idx} className="h-1.5" />;

          if (
            trimmed.startsWith('### ') ||
            (trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.length < 90)
          ) {
            const headingText = trimmed
              .replace(/^###\s*/, '')
              .replace(/^\*\*/, '')
              .replace(/\*\*$/, '');
            return (
              <h4
                key={idx}
                className="font-bold text-slate-900 dark:text-white mt-4 mb-1 text-base sm:text-lg flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                {headingText}
              </h4>
            );
          }

          if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
            const bulletContent = trimmed.substring(2);
            return (
              <div key={idx} className="flex items-start gap-2.5 pl-2">
                <span className="text-blue-500 font-bold mt-1 text-xs">•</span>
                <span dangerouslySetInnerHTML={{ __html: parseBoldText(bulletContent) }} />
              </div>
            );
          }

          if (/^\d+\.\s/.test(trimmed)) {
            const num = trimmed.match(/^\d+\./)?.[0] || '';
            const listContent = trimmed.replace(/^\d+\.\s*/, '');
            return (
              <div key={idx} className="flex items-start gap-2.5 pl-2">
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

  const quickPrompts = [
    {
      title: 'Ice Breaking 5 Menit',
      desc: 'Ide ice breaking seru mencairkan kelas',
      prompt: 'Berikan 3 ide ice breaking edukatif 5 menit yang seru untuk mencairkan kelas sebelum mulai pelajaran.'
    },
    {
      title: 'Modul Ajar Kurikulum Merdeka',
      desc: 'Contoh langkah modul ajar terstruktur',
      prompt: 'Buatkan draf Modul Ajar Kurikulum Merdeka lengkap dengan CP, TP, dan langkah pembelajaran berdiferensiasi.'
    },
    {
      title: 'Solusi Siswa Pasif',
      desc: 'Strategi mengajak diskusi berpasangan',
      prompt: 'Bagaimana strategi praktis untuk mengajak siswa pasif dan pendiam agar aktif dalam diskusi kelompok?'
    },
    {
      title: 'Soal HOTS & Rubrik',
      desc: 'Paket latihan tingkat tinggi',
      prompt: 'Buatkan 3 contoh soal HOTS Kurikulum Merdeka beserta kunci jawaban dan rubrik penilaian.'
    }
  ];

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const activeSessions = sessions.filter(s => s.status === 'active');
  const filteredSessions = activeSessions.filter(s =>
    searchQuery.trim() ? s.title.toLowerCase().includes(searchQuery.toLowerCase()) : true
  );

  return (
    <div className="relative h-[calc(100vh-95px)] sm:h-[calc(100vh-110px)] flex flex-col bg-gradient-to-b from-blue-50/40 via-slate-50/70 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
      
      {/* Gemini Header */}
      <header className="px-2.5 sm:px-4 py-2 sm:py-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between z-20 shrink-0 gap-1.5 sm:gap-2">
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1.5 sm:p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title="Menu Riwayat Obrolan"
          >
            {isSidebarOpen ? <PanelLeftClose className="w-4 h-4 sm:w-5 sm:h-5" /> : <PanelLeft className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>

          {/* Model Selector Dropdown */}
          <div className="relative inline-block shrink-0">
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value as 'flash' | 'pro')}
              className="appearance-none bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 text-[11px] sm:text-xs font-bold px-2 sm:px-3 py-1 sm:py-1.5 pr-5 sm:pr-7 rounded-full border border-slate-200 dark:border-slate-700 focus:outline-none cursor-pointer transition-all"
            >
              <option value="flash">Gemini 2.5 Flash</option>
              <option value="pro">Gemini 2.5 Pro</option>
            </select>
            <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500 absolute right-1.5 sm:right-2.5 top-2 sm:top-2.5 pointer-events-none" />
          </div>
        </div>

        {/* Right Action buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setShowApiKeyModal(true)}
            className="flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-bold border border-indigo-200/80 dark:border-indigo-800 transition-all cursor-pointer"
            title="Konfigurasi Kunci API Gemini (Opsional)"
          >
            <Key className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span className="hidden sm:inline">Kunci API</span>
          </button>

          {/* Direct Link to Gemini - Hidden on small mobile, visible on lg screens */}
          <a
            href="https://gemini.google.com/app"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/80 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full text-xs font-bold border border-blue-200/60 dark:border-blue-800 transition-all"
            title="Buka Google Gemini Langsung di Tab Baru"
          >
            <span>Google Gemini Langsung</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            onClick={handleStartNewChat}
            className="flex items-center gap-1 px-2.5 py-1 sm:px-3.5 sm:py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-full text-xs font-bold shadow-xs transition-all cursor-pointer shrink-0"
            title="Obrolan Baru"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Obrolan Baru</span>
            <span className="sm:hidden text-[11px]">Baru</span>
          </button>
        </div>
      </header>

      {/* Main Workspace with Drawer */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Left Drawer / History Rail */}
        <aside
          className={`absolute lg:relative z-30 h-full w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-300 ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:hidden'
          }`}
        >
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Riwayat Obrolan
            </h3>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search Box */}
          <div className="p-2.5 border-b border-slate-100 dark:border-slate-800">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Cari obrolan..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
              />
            </div>
          </div>

          {/* Session List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {filteredSessions.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-6">Belum ada riwayat</p>
            ) : (
              filteredSessions.map(session => {
                const isActive = session.id === activeSessionId;
                return (
                  <div
                    key={session.id}
                    onClick={() => {
                      setActiveSessionId(session.id);
                      setIsSidebarOpen(false);
                    }}
                    className={`group flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium cursor-pointer transition-all ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 font-bold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-60" />
                      <span className="truncate">{session.title}</span>
                    </div>
                    <button
                      onClick={e => handleDeleteSession(session.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950 text-slate-400 hover:text-rose-600 transition-all"
                      title="Hapus Obrolan"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Center Chat View */}
        <main className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden">
          
          {/* Chat Canvas */}
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto custom-scrollbar px-2.5 sm:px-8 py-3 sm:py-6 space-y-4 sm:space-y-6"
          >
            {!hasMessages ? (
              /* LANDING VIEW MATCHING GEMINI SCREENSHOT */
              <div className="max-w-2xl mx-auto min-h-[55vh] sm:min-h-[60vh] flex flex-col items-center justify-center text-center space-y-4 sm:space-y-8 my-auto px-1">
                
                {/* Greeting Title */}
                <div className="space-y-1.5 sm:space-y-2 px-1">
                  <h1 className="text-xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-snug break-words">
                    Apa berikutnya, {loggedInName}?
                  </h1>
                  <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-base leading-relaxed max-w-lg mx-auto">
                    Tanyakan strategi mengajar, modul ajar, ice breaking, atau analisis materi Kurikulum Merdeka.
                  </p>
                </div>

                {/* Central Gemini Search Pill */}
                <div className="w-full bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-2 sm:p-3 border border-slate-200/90 dark:border-slate-800 shadow-lg shadow-blue-500/5 space-y-2">
                  
                  {/* File Attachment Badge if present */}
                  {attachment && (
                    <div className="bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 rounded-xl sm:rounded-2xl p-1.5 sm:p-2 px-2.5 sm:px-3 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate text-[11px] sm:text-xs">{attachment.name}</span>
                        <span className="text-[10px] text-slate-400 shrink-0">({formatFileSize(attachment.size)})</span>
                      </div>
                      <button
                        onClick={() => setAttachment(null)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Input Row */}
                  <div className="flex items-center gap-1.5 sm:gap-2 px-1">
                    {/* Attachment + button */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                      title="Unggah Berkas PDF/Word/TXT"
                    >
                      <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.txt,.csv,.xlsx,.md"
                      onChange={handleFileSelect}
                      className="hidden"
                    />

                    {/* Input Field */}
                    <input
                      type="text"
                      value={inputPrompt}
                      onChange={e => setInputPrompt(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Minta Gemini..."
                      className="flex-1 bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs sm:text-base font-medium border-none focus:outline-none px-1 sm:px-2"
                    />

                    {/* Speech Mic */}
                    <button
                      type="button"
                      onClick={handleVoiceInput}
                      className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                        isListening
                          ? 'bg-rose-500 text-white animate-pulse'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                      title="Input Suara (Mikrofon)"
                    >
                      {isListening ? <MicOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Mic className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </button>

                    {/* Submit Arrow */}
                    <button
                      onClick={() => handleSendMessage()}
                      disabled={!inputPrompt.trim() && !attachment}
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-30 text-white flex items-center justify-center shrink-0 shadow-sm transition-all cursor-pointer"
                    >
                      <ArrowUp className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </div>
                </div>

                {/* Quick Suggestion Chips */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 w-full max-w-2xl pt-1 sm:pt-2">
                  {quickPrompts.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(q.prompt)}
                      className="text-left bg-white/90 dark:bg-slate-900/90 hover:bg-blue-50/80 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 transition-all shadow-2xs group cursor-pointer"
                    >
                      <h4 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 flex items-center justify-between gap-1">
                        <span className="truncate">{q.title}</span>
                        <Sparkles className="w-3.5 h-3.5 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </h4>
                      <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 sm:mt-1 line-clamp-1">{q.desc}</p>
                    </button>
                  ))}
                </div>

              </div>
            ) : (
              /* CONTINUOUS ACTIVE CHAT FEED */
              <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6 pb-28">
                {currentSession.messages.map(msg => {
                  const isUser = msg.role === 'user';
                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-2.5 sm:gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      {!isUser && (
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-1">
                          <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </div>
                      )}

                      <div className={`space-y-1.5 max-w-[90%] sm:max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
                        
                        <div
                          className={`rounded-2xl sm:rounded-3xl p-3 sm:p-5 ${
                            isUser
                              ? 'bg-slate-900 text-white dark:bg-blue-600 font-medium rounded-tr-xs shadow-xs'
                              : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-xs rounded-tl-xs'
                          }`}
                        >
                          {isUser ? (
                            <p className="text-xs sm:text-base leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                          ) : (
                            renderFormattedMarkdown(msg.text)
                          )}
                        </div>

                        {/* Model Action Toolbar */}
                        {!isUser && (
                          <div className="flex items-center gap-1.5 px-2 text-slate-400 text-xs pt-0.5">
                            {/* Copy button */}
                            <button
                              onClick={() => handleCopyText(msg.id, msg.text)}
                              className="p-1 sm:p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                              title="Salin Teks"
                            >
                              {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>

                            {/* Speak button */}
                            <button
                              onClick={() => handleSpeak(msg.id, msg.text)}
                              className="p-1 sm:p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                              title="Dengarkan Suara Audio"
                            >
                              {speakingMsgId === msg.id ? <VolumeX className="w-3.5 h-3.5 text-rose-500 animate-bounce" /> : <Volume2 className="w-3.5 h-3.5" />}
                            </button>

                            {/* Regenerate Coba Lagi */}
                            <button
                              onClick={handleRegenerate}
                              className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 transition-colors font-medium text-[10px] sm:text-[11px]"
                              title="Generasi ulang jawaban"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Coba Lagi</span>
                            </button>

                            {/* Like / Dislike feedback */}
                            <button
                              onClick={() => setLikedMsgs(p => ({ ...p, [msg.id]: true }))}
                              className={`p-1 sm:p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
                                likedMsgs[msg.id] ? 'text-blue-600' : ''
                              }`}
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {isUser && (
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 mt-1 font-bold text-xs">
                          <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Loading indicator */}
                {isLoading && (
                  <div className="flex items-center gap-2.5 sm:gap-3 text-slate-500 dark:text-slate-400 text-xs font-semibold py-2">
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-blue-600 text-white flex items-center justify-center animate-spin">
                      <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                    <span>Gemini sedang berpikir dan menyusun respon...</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Floating Bottom Input Bar when Chat Active */}
          {hasMessages && (
            <div className="absolute bottom-2 sm:bottom-4 left-0 right-0 px-2 sm:px-4 max-w-3xl mx-auto z-20">
              <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl sm:rounded-3xl p-2 sm:p-2.5 border border-slate-200 dark:border-slate-800 shadow-xl space-y-2">
                
                {attachment && (
                  <div className="bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 rounded-xl sm:rounded-2xl p-1.5 sm:p-2 px-2.5 sm:px-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="font-bold text-slate-800 dark:text-slate-200 truncate text-[11px] sm:text-xs">{attachment.name}</span>
                    </div>
                    <button onClick={() => setAttachment(null)} className="p-1 text-slate-400 hover:text-rose-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-1.5 sm:gap-2 px-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                    title="Unggah Berkas"
                  >
                    <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>

                  <input
                    type="text"
                    value={inputPrompt}
                    onChange={e => setInputPrompt(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Tanyakan lanjutan ke Gemini..."
                    className="flex-1 bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs sm:text-sm font-medium border-none focus:outline-none px-1 sm:px-2"
                  />

                  <button
                    type="button"
                    onClick={handleVoiceInput}
                    className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                      isListening ? 'bg-rose-500 text-white animate-pulse' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {isListening ? <MicOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Mic className="w-4 h-4 sm:w-5 sm:h-5" />}
                  </button>

                  <button
                    onClick={() => handleSendMessage()}
                    disabled={!inputPrompt.trim() && !attachment}
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-30 text-white flex items-center justify-center shrink-0 shadow-sm transition-all cursor-pointer"
                  >
                    <ArrowUp className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* API Key Modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-600 text-white rounded-xl">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white">Pengaturan Kunci API Gemini</h3>
                  <p className="text-[11px] text-slate-500">Koneksi langsung ke Google AI Studio untuk Guru AI</p>
                </div>
              </div>
              <button
                onClick={() => setShowApiKeyModal(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveApiKey} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Google Gemini API Key:
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showKeySecret ? 'text' : 'password'}
                    value={apiKeyInput}
                    onChange={e => setApiKeyInput(e.target.value)}
                    placeholder="Contoh: AIzaSy..."
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 pr-10 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeySecret(!showKeySecret)}
                    className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showKeySecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">
                  Belum punya API Key? Dapatkan gratis di{' '}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline inline-flex items-center gap-0.5"
                  >
                    Google AI Studio <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
              </div>

              {apiKeyStatusMsg && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                    apiKeyStatusMsg.success
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                  }`}
                >
                  {apiKeyStatusMsg.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{apiKeyStatusMsg.text}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleTestKeyInModal}
                  disabled={isTestingKey || !apiKeyInput.trim()}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {isTestingKey ? <RotateCcw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-indigo-500" />}
                  {isTestingKey ? 'Menguji...' : 'Uji Koneksi'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowApiKeyModal(false)}
                    className="px-3.5 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-all cursor-pointer"
                  >
                    Tutup
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    Simpan Key
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
