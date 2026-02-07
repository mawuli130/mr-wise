
import React, { useState, useRef, useEffect } from 'react';
import { generateAIImage, chatWithAssistantStream } from '../services/geminiService';
import { saveTutorProfile } from '../services/firebaseService';
import Button from './Button';
import { TutorProfile, AppUser } from '../types';

interface AIAssistantProps {
  user: AppUser;
  profile: TutorProfile;
  onUpdateProfile: (profile: TutorProfile) => void;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ user, profile, onUpdateProfile }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{role: 'user' | 'ai', content: string, type: 'text' | 'image'}[]>([]);
  const [loading, setLoading] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [tempMemory, setTempMemory] = useState(profile.memory || '');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (forcedType?: 'text' | 'image', forcedInput?: string) => {
    const messageToSend = forcedInput || input;
    if (!messageToSend.trim() && !forcedType) return;
    
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: messageToSend, type: 'text' }]);
    setLoading(true);

    try {
      if (forcedType === 'image' || messageToSend.toLowerCase().includes('generate image')) {
        const imageUrl = await generateAIImage(messageToSend || "Educational background");
        setMessages(prev => [...prev, { role: 'ai', content: imageUrl, type: 'image' }]);
        setLoading(false);
      } else {
        setMessages(prev => [...prev, { role: 'ai', content: '', type: 'text' }]);
        const streamResponse = await chatWithAssistantStream(messageToSend, profile.memory);
        let fullText = '';
        setLoading(false);
        for await (const chunk of streamResponse) {
          const chunkText = chunk.text;
          if (chunkText) {
            fullText += chunkText;
            setMessages(prev => {
              const newMsgs = [...prev];
              newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], content: fullText };
              return newMsgs;
            });
          }
        }
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'ai', content: "AI logic error. Check connection.", type: 'text' }]);
      setLoading(false);
    }
  };

  const handleCaptureToBrain = (text: string) => {
    setTempMemory(prev => prev + `\nCaptured Idea (${new Date().toLocaleDateString()}): ${text}\n`);
    setShowMemory(true);
  };

  const handleSaveMemory = async () => {
    setIsSyncing(true);
    const updatedProfile = { ...profile, memory: tempMemory };
    try {
      await saveTutorProfile(user.uid, updatedProfile);
      onUpdateProfile(updatedProfile);
      setShowMemory(false);
      setMessages(prev => [...prev, { 
        role: 'ai', 
        content: "*Memory Vault Updated!* 🧠 Your strategic partnership is now stronger.", 
        type: 'text' 
      }]);
    } catch (e) {
      alert("Failed to sync brain vault.");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto h-[80vh] flex flex-col bg-gray-900 rounded-[3.5rem] shadow-2xl border-4 border-gray-800 overflow-hidden animate-in fade-in slide-in-from-bottom-4 relative">
      
      {showMemory && (
        <div className="absolute inset-0 z-50 bg-gray-900/98 backdrop-blur-xl p-10 flex flex-col animate-in slide-in-from-right-12">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h3 className="text-white font-black text-2xl uppercase tracking-tight">Cloud Brain Vault</h3>
              <p className="text-[10px] text-purple-400 font-black uppercase tracking-[0.2em] mt-1">Strategic Mission Persistence</p>
            </div>
            <button onClick={() => setShowMemory(false)} className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-gray-400">✕</button>
          </div>

          <textarea 
            value={tempMemory}
            onChange={e => setTempMemory(e.target.value)}
            className="flex-1 bg-gray-900 border border-white/10 rounded-[2rem] p-8 text-emerald-100 font-mono text-xs outline-none focus:ring-2 ring-purple-500/30 resize-none mb-8"
            placeholder="Structure your Brain here: Mission, Profit Logic, Workflow..."
          />

          <div className="flex gap-4">
            <Button onClick={handleSaveMemory} disabled={isSyncing} variant="success" className="flex-1 bg-purple-600 font-black uppercase tracking-widest py-5">
              {isSyncing ? 'Syncing...' : 'Sync Brain to Cloud'}
            </Button>
          </div>
        </div>
      )}

      <div className="p-8 bg-gray-800/50 border-b border-white/5 flex justify-between items-center backdrop-blur-md">
        <h3 className="text-white font-black text-lg uppercase tracking-widest">AI Strategic Partner</h3>
        <button onClick={() => setShowMemory(true)} className="px-5 py-2.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          Brain Vault
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-8">
        {messages.map((m, idx) => (
          <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-[2rem] p-6 shadow-2xl relative ${m.role === 'user' ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-100 border border-white/5'}`}>
              <div className="whitespace-pre-wrap text-[13px] leading-relaxed">
                {m.type === 'text' ? m.content : <img src={m.content} className="rounded-xl w-full" />}
              </div>
              {m.role === 'ai' && m.type === 'text' && m.content !== '' && (
                <button onClick={() => handleCaptureToBrain(m.content)} className="mt-4 text-[9px] font-black uppercase text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Capture to Brain Vault
                </button>
              )}
            </div>
          </div>
        ))}
        {loading && <div className="text-emerald-500 animate-pulse text-[10px] font-black uppercase">Thinking...</div>}
      </div>

      <div className="p-8 bg-gray-800 border-t border-white/5 flex gap-4">
        <input 
          type="text" 
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="What's the strategy today?"
          className="flex-1 bg-gray-900 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold text-sm outline-none"
        />
        <button onClick={() => handleSend()} className="bg-emerald-600 text-white w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18"/></svg>
        </button>
      </div>
    </div>
  );
};

export default AIAssistant;
