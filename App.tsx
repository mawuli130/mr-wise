
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { processQuestions, rebrandImage } from './services/geminiService';
import { getTutorProfile, saveTutorProfile, subscribeToFirebaseLibrary, savePaperToFirebase, deletePaperFromFirebase } from './services/firebaseService';
import { ProcessingStatus, FormattingOptions, AppMode, ExamBoard, ProcessedItem, BulkOptions, MainTab, TutorProfile, AppUser } from './types';
import Button from './components/Button';
import WorksheetPreview from './components/WorksheetPreview';
import Logo from './components/Logo';
import NewsCenter from './components/NewsCenter';
import CommunityFeed from './components/CommunityFeed';
import AIAssistant from './components/AIAssistant';
import ChatSystem from './components/ChatSystem';
import Auth from './components/Auth';
import AdminDashboard from './components/AdminDashboard';

type ActiveTab = 'test' | 'answers' | 'guide';

interface RebrandItem {
  id: string;
  file: File;
  originalPreview: string;
  rebrandedPreview: string | null;
  status: 'idle' | 'processing' | 'done' | 'error';
  customSize?: string;
  customPosition?: string;
}

const App: React.FC = () => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [mainTab, setMainTab] = useState<MainTab>('community');
  const [mode, setMode] = useState<AppMode>('trial');
  const [year, setYear] = useState('2026');
  const [board, setBoard] = useState<ExamBoard>('WASSCE');
  const [subject, setSubject] = useState('');
  const [inputText, setInputText] = useState('');
  const [fileList, setFileList] = useState<{file: File, preview: string, isPdf: boolean}[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [processingLog, setProcessingLog] = useState('Initializing AI...');
  const [library, setLibrary] = useState<ProcessedItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('test');
  const [showWorksheet, setShowWorksheet] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLibraryVisible, setIsLibraryVisible] = useState(false);
  
  // Selection States
  const [selectedLibraryIds, setSelectedLibraryIds] = useState<string[]>([]);
  
  // Rebrand Tool State
  const [rebrandItems, setRebrandItems] = useState<RebrandItem[]>([]);
  const [isRebrandProcessing, setIsRebrandProcessing] = useState(false);
  const [globalSize, setGlobalSize] = useState('medium');
  const [globalPosition, setGlobalPosition] = useState('bottom center');

  const [showSettings, setShowSettings] = useState(false);
  const [profile, setProfile] = useState<TutorProfile>({
    name: 'Mr. Wise',
    phone: '+233 20 768 9520',
    location: 'Ghana',
    memory: ''
  });

  const [packOptions, setPackOptions] = useState<BulkOptions>({
    questions: true,
    solutions: false,
    guide: false
  });

  const [formatting, setFormatting] = useState<FormattingOptions>({
    useBold: true,
    useItalic: true,
    useStrikethrough: false,
    useBullets: true,
    useNumbers: true,
    autoRenumber: true 
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rebrandInputRef = useRef<HTMLInputElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

  // Hook relocation: rebrandStats must be before early returns
  const rebrandStats = useMemo(() => {
    const total = rebrandItems.length;
    const idle = rebrandItems.filter(i => i.status === 'idle').length;
    const processing = rebrandItems.filter(i => i.status === 'processing').length;
    const done = rebrandItems.filter(i => i.status === 'done').length;
    const error = rebrandItems.filter(i => i.status === 'error').length;
    const progress = total === 0 ? 0 : Math.round(((done + error) / total) * 100);
    return { total, idle, processing, done, error, progress };
  }, [rebrandItems]);

  useEffect(() => {
    if (user && user.role === 'admin') {
      const syncProfile = async () => {
        const cloudProfile = await getTutorProfile(user.uid);
        if (cloudProfile) setProfile(cloudProfile);
      };
      syncProfile();
    }
  }, [user]);

  useEffect(() => {
    if (user && user.role === 'admin') {
      const unsubscribe = subscribeToFirebaseLibrary(user.uid, (papers) => {
        setLibrary(papers);
      });
      return () => unsubscribe();
    }
  }, [user]);

  const handleUpdateProfile = async (newProfile: TutorProfile) => {
    setProfile(newProfile);
    if (user && user.role === 'admin') {
      await saveTutorProfile(user.uid, newProfile);
    }
  };

  if (!user) return <Auth onAuth={setUser} />;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    const newFiles = files.map(file => {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      return { 
        file, 
        preview: isPdf ? '' : URL.createObjectURL(file),
        isPdf
      };
    });
    setFileList(prev => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setFileList(prev => {
      const removed = prev[index];
      if (!removed.isPdf && removed.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  // REBRAND TOOL LOGIC
  const handleRebrandSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (rebrandItems.length + files.length > 50) {
      alert("Vault Capacity Warning: Batch limit is 50 images for stability.");
      return;
    }
    const newItems: RebrandItem[] = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      originalPreview: URL.createObjectURL(file),
      rebrandedPreview: null,
      status: 'idle'
    }));
    setRebrandItems(prev => [...prev, ...newItems]);
  };

  const handleRunRebrand = async (id: string) => {
    const item = rebrandItems.find(i => i.id === id);
    if (!item || item.status === 'processing') return;

    setRebrandItems(prev => prev.map(i => i.id === id ? { ...i, status: 'processing' } : i));

    try {
      const result = await rebrandImage(
        item.file, 
        profile.name, 
        profile.phone, 
        item.customSize || globalSize, 
        item.customPosition || globalPosition
      );
      setRebrandItems(prev => prev.map(i => i.id === id ? { ...i, status: 'done', rebrandedPreview: result } : i));
    } catch (e) {
      setRebrandItems(prev => prev.map(i => i.id === id ? { ...i, status: 'error' } : i));
    }
  };

  const handleRunAllRebrand = async () => {
    if (isRebrandProcessing) return;
    setIsRebrandProcessing(true);
    
    // Concurrency control: Process in chunks of 3 for API stability
    const CONCURRENCY = 3;
    const itemsToProcess = rebrandItems.filter(i => i.status === 'idle' || i.status === 'error');
    
    for (let i = 0; i < itemsToProcess.length; i += CONCURRENCY) {
      const chunk = itemsToProcess.slice(i, i + CONCURRENCY);
      await Promise.all(chunk.map(item => handleRunRebrand(item.id)));
    }
    
    setIsRebrandProcessing(false);
  };

  const removeRebrandItem = (id: string) => {
    setRebrandItems(prev => {
      const item = prev.find(i => i.id === id);
      if (item) URL.revokeObjectURL(item.originalPreview);
      return prev.filter(i => i.id !== id);
    });
  };

  const downloadImage = (base64: string, name: string) => {
    const link = document.createElement('a');
    link.href = base64;
    link.download = `MrWise-Legit-${name.replace(/\.[^/.]+$/, "")}.png`;
    link.click();
  };

  const downloadAllRebranded = () => {
    rebrandItems.forEach(item => {
      if (item.rebrandedPreview) downloadImage(item.rebrandedPreview, item.file.name);
    });
  };

  const shareImage = async (base64: string, name: string) => {
    try {
      const res = await fetch(base64);
      const blob = await res.blob();
      const file = new File([blob], `${name}.png`, { type: blob.type });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Mr. Wise Legit Paper',
          text: 'Check this legit exam material from Mr. Wise.',
        });
      } else {
        downloadImage(base64, name);
        const waUrl = `https://wa.me/?text=${encodeURIComponent("I am sharing a Mr. Wise Legit image with you. Check your downloads.")}`;
        window.open(waUrl, '_blank');
      }
    } catch (err) {
      console.error("Share failed", err);
      downloadImage(base64, name);
    }
  };

  const handleConvert = async () => {
    if (!user) return;
    if (!inputText.trim() && fileList.length === 0) {
      alert("Please snap a photo, upload a PDF, or paste text first.");
      return;
    }
    
    setStatus(ProcessingStatus.PROCESSING);
    setProcessingLog('Master AI is connecting...');

    const logs = [
      'Scanning images for questions...',
      'Applying strict renumbering logic...',
      'Formatting for the Legit Source...',
      'Simplifying solutions for students...',
      'Applying Mr. Wise branding...',
      'Finalizing your legit pack...'
    ];

    let logIdx = 0;
    const logInterval = setInterval(() => {
      setProcessingLog(logs[logIdx % logs.length]);
      logIdx++;
    }, 2500);

    try {
      const inputs: (File | string)[] = fileList.map(f => f.file);
      if (inputText.trim()) inputs.push(inputText);
      
      const data = await processQuestions(inputs, subject, formatting, mode, year, board);
      
      const now = Date.now();
      const newItem: Omit<ProcessedItem, 'id'> = {
        timestamp: now,
        updatedAt: now,
        mode, year, board,
        userId: user.uid,
        tutorSignature: `Prepared by ${profile.name} (${profile.phone})`,
        ...data
      };
      
      setProcessingLog('Syncing to Cloud Library...');
      const newId = await savePaperToFirebase(newItem);
      
      setSelectedItemId(newId);
      setStatus(ProcessingStatus.COMPLETED);
      setFileList([]);
      setInputText('');
      setSubject('');
      
      setTimeout(() => {
        setIsLibraryVisible(true);
        viewerRef.current?.scrollIntoView({ behavior: 'smooth' });
        setStatus(ProcessingStatus.IDLE);
      }, 2000);
    } catch (error) { 
      setStatus(ProcessingStatus.ERROR);
      setTimeout(() => setStatus(ProcessingStatus.IDLE), 5000);
      alert("AI was unable to process the files.");
    } finally {
      clearInterval(logInterval);
    }
  };

  const handleDeleteFromCloud = async (id: string) => {
    if (window.confirm("Are you sure you want to permanently delete this from your cloud library?")) {
      try {
        await deletePaperFromFirebase(id);
        setSelectedItemId(null);
      } catch (e) {
        alert("Failed to delete from cloud.");
      }
    }
  };

  const filteredLibrary = library.filter(i => {
    const subj = String(i.subject || "").toLowerCase();
    const brd = String(i.board || "").toLowerCase();
    return subj.includes(searchTerm.toLowerCase()) || brd.includes(searchTerm.toLowerCase());
  });
  
  const selectedItem = library.find(i => i.id === selectedItemId);

  const getFullPackContent = (item: ProcessedItem) => {
    let content = `*${String(item.board)} ${String(item.year)} - ${String(item.subject)}*\n\n`;
    if (packOptions.questions) content += `*TRIAL QUESTIONS:*\n${String(item.test)}\n\n`;
    if (packOptions.solutions) content += `*OFFICIAL SOLUTIONS:*\n${String(item.answers)}\n\n`;
    if (packOptions.guide) content += `*TUTOR GUIDE:*\n${String(item.tutorGuide)}\n\n`;
    content += `_${String(item.tutorSignature)}_`;
    return content;
  };

  const getCombinedContent = () => {
    const itemsToProcess = selectedLibraryIds.length > 0 
      ? library.filter(i => selectedLibraryIds.includes(i.id)) 
      : (selectedItem ? [selectedItem] : []);
    
    return itemsToProcess.map((item, index) => {
      let text = getFullPackContent(item);
      if (index < itemsToProcess.length - 1) {
        text += '\n----------------------------------------\n';
      }
      return text;
    }).join('\n');
  };

  const toggleLibrarySelection = (id: string) => {
    setSelectedLibraryIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const renderFormattedPreview = (text: string) => {
    const safeText = String(text || "");
    return safeText.split('\n').map((line, i) => {
      let content = line.replace(/\*(.*?)\*/g, '<strong class="font-black text-emerald-900">$1</strong>');
      return <p key={i} className="min-h-[1.5em]" dangerouslySetInnerHTML={{ __html: content || '&nbsp;' }} />;
    });
  };

  const formatTimestamp = (ts: number) => {
    if (!ts) return "N/A";
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(ts));
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center pb-48">
      
      {(status === ProcessingStatus.PROCESSING || status === ProcessingStatus.COMPLETED) && (
        <div className="fixed bottom-32 right-8 z-[100] w-80 bg-white rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(5,150,105,0.3)] border-4 border-emerald-500 p-6 animate-in slide-in-from-right-10 duration-500 overflow-hidden">
          {status === ProcessingStatus.PROCESSING ? (
            <div className="space-y-4">
               <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <div className="w-5 h-5 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-gray-900 uppercase tracking-tighter">AI Thinking...</h4>
                    <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest">{String(processingLog)}</p>
                  </div>
               </div>
               <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden relative">
                 <div className="absolute inset-0 bg-emerald-500 animate-loading"></div>
               </div>
            </div>
          ) : (
            <div className="space-y-3 text-center">
               <div className="w-12 h-12 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
               </div>
               <h4 className="text-sm font-black text-gray-900 uppercase">Conversion Ready!</h4>
            </div>
          )}
        </div>
      )}

      {selectedLibraryIds.length > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[90] w-full max-w-2xl bg-gray-900 text-white p-6 rounded-[2.5rem] shadow-2xl border-4 border-emerald-500 flex flex-col sm:flex-row items-center gap-6 animate-in slide-in-from-bottom-10">
          <div className="flex-1">
            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-500">Bulk Pack Builder</h4>
            <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">{selectedLibraryIds.length} Papers Selected</p>
          </div>
          <Button onClick={() => setShowWorksheet(true)} className="py-4 px-8 bg-emerald-600 uppercase font-black text-[10px] tracking-widest shadow-xl shadow-emerald-900/40">Build Multi-Page PDF</Button>
          <button onClick={() => setSelectedLibraryIds([])} className="text-gray-500 hover:text-white">✕</button>
        </div>
      )}

      <header className="w-full max-w-6xl flex flex-col items-center mb-10 relative">
        <button onClick={() => setShowSettings(true)} className="absolute top-0 right-0 w-14 h-14 bg-white border-2 rounded-3xl shadow-lg flex items-center justify-center text-gray-400 hover:text-emerald-600 hover:border-emerald-500 transition-all group">
          <svg className="w-7 h-7 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
        </button>
        <Logo size={90} className="mb-6" />
        <h1 className="text-5xl font-black text-gray-900 tracking-tight">Mr. Wise <span className="text-emerald-600">Wisely</span></h1>
        
        <nav className="mt-12 flex flex-wrap justify-center gap-3 w-full max-w-5xl bg-white/50 backdrop-blur-sm p-3 rounded-[3rem] border-2 shadow-xl">
          {user.role === 'admin' && (
            <>
              <button onClick={() => setMainTab('dashboard')} className={`flex-1 py-4 px-6 rounded-[2rem] font-black uppercase text-[11px] tracking-widest transition-all ${mainTab === 'dashboard' ? 'bg-emerald-600 text-white shadow-xl scale-105' : 'text-gray-400 hover:bg-white'}`}>Dashboard</button>
              <button onClick={() => setMainTab('tools')} className={`flex-1 py-4 px-6 rounded-[2rem] font-black uppercase text-[11px] tracking-widest transition-all ${mainTab === 'tools' ? 'bg-emerald-600 text-white shadow-xl scale-105' : 'text-gray-400 hover:bg-white'}`}>Tutor Tools</button>
              <button onClick={() => setMainTab('rebrand')} className={`flex-1 py-4 px-6 rounded-[2rem] font-black uppercase text-[11px] tracking-widest transition-all ${mainTab === 'rebrand' ? 'bg-emerald-600 text-white shadow-xl scale-105' : 'text-gray-400 hover:bg-white'}`}>Rebrand Tool</button>
              <button onClick={() => setMainTab('assistant')} className={`flex-1 py-4 px-6 rounded-[2rem] font-black uppercase text-[11px] tracking-widest transition-all ${mainTab === 'assistant' ? 'bg-emerald-600 text-white shadow-xl scale-105' : 'text-gray-400 hover:bg-white'}`}>AI Assistant</button>
            </>
          )}
          <button onClick={() => setMainTab('community')} className={`flex-1 py-4 px-6 rounded-[2rem] font-black uppercase text-[11px] tracking-widest transition-all ${mainTab === 'community' ? 'bg-emerald-600 text-white shadow-xl scale-105' : 'text-gray-400 hover:bg-white'}`}>Community</button>
          <button onClick={() => setMainTab('chat')} className={`flex-1 py-4 px-6 rounded-[2rem] font-black uppercase text-[11px] tracking-widest transition-all ${mainTab === 'chat' ? 'bg-emerald-600 text-white shadow-xl scale-105' : 'text-gray-400 hover:bg-white'}`}>Chat</button>
          <button onClick={() => setMainTab('news')} className={`flex-1 py-4 px-6 rounded-[2rem] font-black uppercase text-[11px] tracking-widest transition-all ${mainTab === 'news' ? 'bg-emerald-600 text-white shadow-xl scale-105' : 'text-gray-400 hover:bg-white'}`}>Exam News</button>
        </nav>
      </header>

      {mainTab === 'dashboard' && user.role === 'admin' ? <AdminDashboard /> :
       mainTab === 'news' ? <NewsCenter /> : 
       mainTab === 'community' ? <CommunityFeed user={user} onNavigateToTools={() => setMainTab('tools')} /> : 
       mainTab === 'assistant' ? <AIAssistant user={user} profile={profile} onUpdateProfile={handleUpdateProfile} /> : 
       mainTab === 'chat' ? <ChatSystem user={user} /> :
       mainTab === 'rebrand' ? (
        <section className="w-full max-w-7xl space-y-8 animate-in zoom-in-95">
           <div className="bg-white p-4 md:p-10 rounded-[3.5rem] shadow-2xl border-2 flex flex-col items-center">
             
             {/* COMMAND & CONTROL HEADER */}
             <div className="w-full bg-gray-900 text-white rounded-[2.5rem] p-6 mb-10 shadow-xl border-4 border-emerald-500 overflow-hidden relative">
               <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500/20">
                 <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${rebrandStats.progress}%` }}></div>
               </div>
               
               <div className="flex flex-col lg:flex-row justify-between items-center gap-8">
                 <div className="flex flex-col items-center lg:items-start">
                   <h3 className="text-xl font-black uppercase tracking-tighter">REBRAND COMMAND CENTER</h3>
                   <div className="flex gap-4 mt-2">
                     <div className="flex items-center gap-2">
                       <div className={`w-2 h-2 rounded-full ${rebrandItems.length < 50 ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse`}></div>
                       <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Vault: {rebrandItems.length}/50</span>
                     </div>
                     <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                       <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Done: {rebrandStats.done}</span>
                     </div>
                     <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-red-500"></div>
                       <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Error: {rebrandStats.error}</span>
                     </div>
                   </div>
                 </div>

                 <div className="flex-1 max-w-md w-full">
                    <div className="flex justify-between text-[10px] font-black uppercase mb-2 tracking-[0.2em] text-emerald-500">
                      <span>Batch Progress</span>
                      <span>{rebrandStats.progress}%</span>
                    </div>
                    <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${rebrandStats.progress}%` }}></div>
                    </div>
                 </div>

                 <div className="flex gap-3">
                   {rebrandStats.done > 0 && (
                     <button onClick={downloadAllRebranded} className="p-4 bg-emerald-600 hover:bg-emerald-500 rounded-2xl transition-all shadow-lg group">
                        <svg className="w-6 h-6 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                     </button>
                   )}
                   <button onClick={() => setRebrandItems([])} className="p-4 bg-red-600 hover:bg-red-500 rounded-2xl transition-all shadow-lg">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                   </button>
                 </div>
               </div>
             </div>

             <div className="w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 mb-12">
               <div 
                 onClick={() => rebrandInputRef.current?.click()} 
                 className="aspect-square rounded-[2rem] border-4 border-dashed border-emerald-200 flex flex-col items-center justify-center cursor-pointer hover:bg-emerald-50 hover:border-emerald-400 transition-all group active:scale-95 shadow-lg bg-emerald-50/20"
               >
                 <div className="w-14 h-14 bg-emerald-100 rounded-[1.5rem] flex items-center justify-center mb-3 group-hover:rotate-12 transition-transform shadow-md">
                   <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                 </div>
                 <p className="text-emerald-700 font-black text-[10px] uppercase tracking-widest text-center">LEGIT-IFY<br/>MORE</p>
                 <input type="file" ref={rebrandInputRef} onChange={handleRebrandSelect} className="hidden" accept="image/*" multiple />
               </div>

               {rebrandItems.map(item => (
                 <div key={item.id} className={`relative aspect-square rounded-[2rem] border-2 bg-gray-50 overflow-hidden shadow-xl group transition-all ${item.status === 'processing' ? 'ring-4 ring-emerald-500' : item.status === 'error' ? 'ring-4 ring-red-500' : 'hover:ring-4 hover:ring-emerald-500/20'}`}>
                   <img src={item.rebrandedPreview || item.originalPreview} className={`w-full h-full object-contain ${item.status === 'processing' ? 'opacity-30 blur-sm' : ''}`} alt="rebrand" />
                   
                   {/* STATUS BADGES */}
                   <div className="absolute top-2 right-2">
                     {item.status === 'done' && <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-lg"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7"/></svg></div>}
                     {item.status === 'error' && <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white shadow-lg font-black text-[8px]">!</div>}
                     {item.status === 'processing' && <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-lg animate-spin"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg></div>}
                   </div>

                   {item.status === 'processing' && (
                     <div className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-900/10">
                        <p className="text-[8px] font-black text-emerald-800 uppercase tracking-widest animate-pulse">Healing...</p>
                     </div>
                   )}

                   <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-4 backdrop-blur-sm">
                        {item.status === 'done' ? (
                          <>
                             <button onClick={() => downloadImage(item.rebrandedPreview!, item.file.name)} className="w-full bg-emerald-600 text-white py-2 rounded-xl text-[8px] font-black uppercase tracking-widest shadow-xl active:scale-95">Download</button>
                             <button onClick={() => shareImage(item.rebrandedPreview!, item.file.name)} className="w-full bg-white text-emerald-600 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest shadow-xl active:scale-95">WhatsApp</button>
                          </>
                        ) : (
                          <button onClick={() => handleRunRebrand(item.id)} className="w-full bg-emerald-600 text-white py-2 rounded-xl text-[8px] font-black uppercase tracking-widest shadow-xl active:scale-95">{item.status === 'error' ? 'Retry AI' : 'Rebrand AI'}</button>
                        )}
                        <button onClick={() => removeRebrandItem(item.id)} className="w-full bg-red-500/20 text-red-500 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest shadow-xl active:scale-95 border border-red-500/30">Delete</button>
                   </div>
                 </div>
               ))}
             </div>

             <div className="w-full max-w-4xl grid grid-cols-1 sm:grid-cols-2 gap-8 p-8 bg-gray-50 rounded-[2.5rem] border mb-10 border-emerald-100 shadow-inner">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Global Font Scale</h4>
                    <span className="text-[9px] font-black text-emerald-600 uppercase bg-emerald-100 px-2 py-0.5 rounded-full">{String(globalSize)}</span>
                  </div>
                  <div className="flex bg-white p-1.5 rounded-2xl border gap-1">
                    {['small', 'medium', 'large', 'max'].map(s => (
                      <button 
                        key={s} 
                        onClick={() => setGlobalSize(s)}
                        className={`flex-1 py-3 rounded-xl text-[8px] font-black uppercase transition-all ${globalSize === s ? 'bg-emerald-600 text-white shadow-md scale-105' : 'text-gray-400 hover:bg-gray-50'}`}
                      >
                        {String(s)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Placement Mode</h4>
                  <select 
                    value={globalPosition}
                    onChange={e => setGlobalPosition(e.target.value)}
                    className="w-full p-4 bg-white border-2 rounded-2xl font-black text-[10px] uppercase outline-none focus:border-emerald-500 transition-colors shadow-sm"
                  >
                    <option value="top left">Top Left</option>
                    <option value="top right">Top Right</option>
                    <option value="top center">Top Center</option>
                    <option value="bottom left">Bottom Left</option>
                    <option value="bottom right">Bottom Right</option>
                    <option value="bottom center">Bottom Center</option>
                    <option value="center">Dead Center</option>
                  </select>
                </div>
             </div>

             <div className="flex flex-col sm:flex-row gap-6 w-full max-w-2xl">
               <Button onClick={handleRunAllRebrand} disabled={isRebrandProcessing || rebrandItems.filter(i => i.status === 'idle' || i.status === 'error').length === 0} className="flex-[2] py-8 bg-emerald-600 uppercase font-black tracking-widest text-base shadow-2xl shadow-emerald-200 rounded-[2rem] active:scale-95 overflow-hidden relative">
                 {isRebrandProcessing ? (
                   <div className="flex items-center gap-3">
                      <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                      Processing {rebrandStats.done + rebrandStats.error} / {rebrandStats.total}
                   </div>
                 ) : rebrandStats.error > 0 ? 'Retry Failed Items' : 'Start Bulk Legit-ification'}
               </Button>
               <Button onClick={() => setRebrandItems([])} variant="secondary" className="flex-1 py-8 uppercase font-black text-[12px] tracking-widest rounded-[2rem] border-4 border-gray-100">Reset Vault</Button>
             </div>
           </div>
        </section>
      ) : (
        <main className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4 space-y-8">
            <section className="bg-white p-8 rounded-[3.5rem] shadow-2xl border-2 border-gray-50 sticky top-6">
              <div className="flex bg-gray-100 p-1.5 rounded-[2rem] mb-8">
                 <button onClick={() => setMode('trial')} className={`flex-1 py-3 rounded-[1.5rem] text-[11px] font-black tracking-widest transition-all ${mode === 'trial' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400'}`}>TRIAL</button>
                 <button onClick={() => setMode('exam')} className={`flex-1 py-3 rounded-[1.5rem] text-[11px] font-black tracking-widest transition-all ${mode === 'exam' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400'}`}>EXAM</button>
              </div>
              
              <div className="space-y-6">
                <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject (e.g. Science)" className="w-full p-5 bg-gray-50 border-2 rounded-2xl font-bold text-base outline-none focus:border-emerald-400 transition-all" />
                
                <div className="grid grid-cols-2 gap-3">
                  <select value={board} onChange={e => setBoard(e.target.value as ExamBoard)} className="p-5 bg-gray-50 border-2 rounded-2xl font-black text-xs uppercase appearance-none">{['WASSCE', 'NOV/DEC', 'NABTEB'].map(b => <option key={b} value={b}>{b}</option>)}</select>
                  <select value={year} onChange={e => setYear(e.target.value)} className="p-5 bg-gray-50 border-2 rounded-2xl font-black text-xs appearance-none">{['2024','2025','2026'].map(y => <option key={y} value={y}>{y}</option>)}</select>
                </div>

                <div className="space-y-4">
                  <div onClick={() => fileInputRef.current?.click()} className="border-4 border-dotted border-emerald-100 rounded-[2.5rem] p-10 text-center cursor-pointer hover:bg-emerald-50 hover:border-emerald-300 transition-all group active:scale-95 shadow-inner bg-emerald-50/10">
                    <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                      <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 11h6m-6 4h6"/></svg>
                    </div>
                    <p className="text-emerald-700 font-black text-xs uppercase tracking-widest leading-relaxed">Snap Photo or<br/>Upload PDF Paper</p>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple accept="image/*,application/pdf" />
                  </div>

                  {/* FILE PREVIEW GALLERY - Fixes "picking pictures" issue */}
                  {fileList.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 animate-in fade-in duration-300">
                      {fileList.map((f, i) => (
                        <div key={i} className="relative aspect-square rounded-xl bg-gray-100 border overflow-hidden group">
                          {f.isPdf ? (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-red-50 text-red-500">
                              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9v-2h2v2zm0-4H9V7h2v5z"/></svg>
                              <span className="text-[6px] font-black uppercase mt-1">PDF</span>
                            </div>
                          ) : (
                            <img src={f.preview} className="w-full h-full object-cover" />
                          )}
                          <button 
                            onClick={(e) => { e.stopPropagation(); removeFile(i); }} 
                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <textarea value={inputText} onChange={e => setInputText(e.target.value)} placeholder="Or paste question text here..." className="w-full h-36 p-5 bg-gray-50 border-2 rounded-2xl font-bold text-sm outline-none focus:border-emerald-400 transition-all resize-none shadow-inner" />
                
                <div className="bg-emerald-50 rounded-[2rem] p-6 border-2 border-emerald-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-black text-emerald-800 uppercase tracking-widest block">Auto-Renumbering</span>
                      <p className="text-[9px] text-emerald-600 font-bold uppercase mt-1">Force Sequence from 1</p>
                    </div>
                    <button onClick={() => setFormatting(prev => ({ ...prev, autoRenumber: !prev.autoRenumber }))} className={`relative w-14 h-7 rounded-full transition-all duration-300 ${formatting.autoRenumber ? 'bg-emerald-600' : 'bg-gray-300'}`}><div className={`absolute top-1 left-1 bg-white w-5 h-5 rounded-full transition-transform duration-300 shadow-sm ${formatting.autoRenumber ? 'translate-x-7' : 'translate-x-0'}`} /></button>
                  </div>
                </div>

                <Button onClick={handleConvert} disabled={status === ProcessingStatus.PROCESSING} className="w-full py-6 uppercase font-black tracking-[0.2em] text-sm shadow-2xl shadow-emerald-200 mt-6 bg-emerald-600 active:scale-95 overflow-hidden relative">{status === ProcessingStatus.PROCESSING ? 'AI Thinking...' : 'Convert to Deliverables'}</Button>
              </div>
            </section>
          </div>

          <div className="lg:col-span-8 space-y-8">
            <div className="bg-white p-5 rounded-[2.5rem] border-2 shadow-xl flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg></div>
              <input type="text" placeholder="Search my cloud library..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="flex-1 bg-transparent border-none font-bold text-base outline-none" />
            </div>

            <div className="text-center">
              <Button 
                onClick={() => setIsLibraryVisible(!isLibraryVisible)}
                variant="secondary"
                className="w-full max-sm:py-4 py-4 px-10 uppercase font-black text-xs tracking-widest border-2 shadow-lg"
              >
                {isLibraryVisible ? 'Hide Cloud Library' : `Show Cloud Library (${filteredLibrary.length} items)`}
                <svg className={`w-4 h-4 transition-transform duration-300 ${isLibraryVisible ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
              </Button>
            </div>

            {isLibraryVisible && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-5 duration-500">
                {filteredLibrary.map(item => (
                  <div key={item.id} onClick={() => { setSelectedItemId(item.id); }} className={`p-8 rounded-[3rem] border-4 cursor-pointer transition-all relative group ${selectedItemId === item.id ? 'border-emerald-500 bg-emerald-50 shadow-2xl scale-[1.02]' : 'border-white bg-white shadow-xl hover:border-emerald-100 hover:shadow-2xl'}`}>
                    <div onClick={(e) => { e.stopPropagation(); toggleLibrarySelection(item.id); }} className={`absolute top-8 left-8 w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all ${selectedLibraryIds.includes(item.id) ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' : 'bg-gray-50 border-gray-100'}`}>{selectedLibraryIds.includes(item.id) && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>}</div>
                    <div className="absolute top-8 right-8 text-emerald-200 group-hover:text-emerald-400 transition-colors" title="Saved to Cloud">☁️</div>
                    <div className="pl-14">
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-[10px] font-black bg-emerald-600 text-white px-4 py-1 rounded-full uppercase tracking-tighter shadow-sm">{String(item.board)} {String(item.year)}</span>
                      </div>
                      <h4 className="font-black text-gray-900 text-xl leading-tight group-hover:text-emerald-700 transition-colors">{String(item.subject)}</h4>
                      <p className="text-[9px] font-mono text-gray-300 group-hover:text-gray-400 truncate mt-2">{String(item.id)}</p>
                      
                      <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
                          </div>
                          <div>
                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Initial Creation</p>
                            <p className="text-[10px] font-black text-gray-900">{formatTimestamp(item.timestamp)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                          </div>
                          <div>
                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Last Cloud Reload</p>
                            <p className="text-[10px] font-black text-gray-900">{formatTimestamp(item.updatedAt)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div ref={viewerRef}>
              {selectedItem && (
                <div className="bg-white rounded-[4rem] shadow-[0_30px_100px_rgba(0,0,0,0.1)] border-2 border-gray-50 overflow-hidden animate-in slide-in-from-bottom-20 duration-500 mt-12 relative">
                  <div className="bg-emerald-900/5 backdrop-blur-md p-8 border-b-2">
                    <h4 className="text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-6 text-center">Customize WhatsApp Share</h4>
                    <div className="flex flex-wrap gap-3 mb-8">
                       <button onClick={() => setPackOptions(prev => ({...prev, questions: !prev.questions}))} className={`flex-1 py-4 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest border-2 transition-all ${packOptions.questions ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' : 'bg-white border-gray-200 text-gray-400'}`}>Share Trials</button>
                       <button onClick={() => setPackOptions(prev => ({...prev, solutions: !prev.solutions}))} className={`flex-1 py-4 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest border-2 transition-all ${packOptions.solutions ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' : 'bg-white border-gray-200 text-gray-400'}`}>Share Solutions</button>
                       <button onClick={() => setPackOptions(prev => ({...prev, guide: !prev.guide}))} className={`flex-1 py-4 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest border-2 transition-all ${packOptions.guide ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' : 'bg-white border-gray-200 text-gray-400'}`}>Share Guide</button>
                    </div>
                    <div className="flex gap-2">{(['test', 'answers', 'guide'] as const).map(tab => (<button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-4 px-6 rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-emerald-900 text-white shadow-lg' : 'text-gray-400 hover:bg-white'}`}>Preview {tab === 'test' ? 'Trials' : tab === 'answers' ? 'Solutions' : 'Guide'}</button>))}</div>
                  </div>
                  <div className="p-10 whatsapp-bg min-h-[500px]">
                     <div className="whatsapp-bubble p-12 shadow-2xl border-b-8 border-emerald-600 max-w-2xl mx-auto">
                        <div className="flex items-center gap-3 mb-10 opacity-40"><Logo size={24} /><p className="text-[11px] font-black text-emerald-900 uppercase tracking-widest">{String(selectedItem.tutorSignature || "")}</p></div>
                        <div className="prose prose-emerald text-base leading-relaxed">{renderFormattedPreview(activeTab === 'test' ? selectedItem.test : activeTab === 'answers' ? selectedItem.answers : selectedItem.tutorGuide)}</div>
                     </div>
                  </div>
                  <div className="p-10 bg-white border-t-2 flex flex-col sm:flex-row gap-5">
                    <Button variant="success" onClick={() => setShowWorksheet(true)} className="flex-1 py-6 font-black uppercase tracking-[0.2em] text-sm shadow-xl shadow-emerald-100 bg-emerald-600 rounded-[2rem]">Build PDF / Images</Button>
                    <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(getFullPackContent(selectedItem))}`, '_blank')} className="flex-1 py-6 border-4 border-emerald-500 text-emerald-600 rounded-[2rem] font-black uppercase text-[12px] tracking-widest hover:bg-emerald-50 transition-all flex items-center justify-center gap-3">Share Combined WhatsApp Pack</button>
                    <Button onClick={() => handleDeleteFromCloud(selectedItem.id)} variant="danger" className="py-6 text-xs font-black uppercase bg-red-500/10 text-red-500 border-2 border-red-500/0 hover:bg-red-500 hover:text-white rounded-[2rem]">Delete from Cloud</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      )}

      {showWorksheet && (
        <WorksheetPreview 
          mode={mode} 
          year={year} 
          board={board} 
          subject={selectedLibraryIds.length > 1 ? `BULK COMPILATION (${selectedLibraryIds.length} PAPERS)` : (selectedItem?.subject || "Subject")} 
          content={getCombinedContent()}
          packOptions={packOptions} 
          onClose={() => setShowWorksheet(false)} 
        />
      )}
    </div>
  );
};

export default App;
