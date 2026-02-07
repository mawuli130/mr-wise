
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  subscribeToChatThreads, 
  subscribeToMessages, 
  sendChatMessage, 
  getAllRegisteredUsers, 
  createOrGetChat, 
  createGroupChat,
  getPendingUsers,
  approveUser,
  getUserByPhone,
  updateTypingStatus
} from '../services/firebaseService';
import { AppUser, ChatMessage, ChatThread } from '../types';
import Button from './Button';
import Logo from './Logo';

interface ChatSystemProps {
  user: AppUser;
}

const ChatSystem: React.FC<ChatSystemProps> = ({ user }) => {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [pendingUsers, setPendingUsers] = useState<AppUser[]>([]);
  const [activeChat, setActiveChat] = useState<ChatThread | null>(null);
  const [inputText, setInputText] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [forwardingMsg, setForwardingMsg] = useState<ChatMessage | null>(null);
  const [view, setView] = useState<'chats' | 'approvals' | 'directory'>('chats');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!user.isApproved && user.role !== 'admin') return;
    const unsub = subscribeToChatThreads(user.uid, user.role === 'admin', (data) => {
       setThreads(data);
       if (activeChat) {
         const updatedActiveChat = data.find(t => t.id === activeChat.id);
         if (updatedActiveChat) {
           setActiveChat(updatedActiveChat);
         }
       }
    });
    return () => unsub();
  }, [user, activeChat]);

  useEffect(() => {
    if (activeChat) {
      const unsub = subscribeToMessages(activeChat.id, (msgs) => {
        setMessages(msgs);
        setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 100);
      });
      return () => unsub();
    }
  }, [activeChat?.id]);

  useEffect(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (activeChat) {
      if (inputText) {
        updateTypingStatus(activeChat.id, user.uid, user.name, true);
        typingTimeoutRef.current = window.setTimeout(() => {
          updateTypingStatus(activeChat.id, user.uid, user.name, false);
        }, 3000);
      } else {
        updateTypingStatus(activeChat.id, user.uid, user.name, false);
      }
    }
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [inputText, activeChat?.id, user.uid]);

  const otherTypingUsers = useMemo(() => {
    if (!activeChat?.typingUsers) return [];
    return Object.values(activeChat.typingUsers).filter(name => typeof name === 'string' && name !== user.name);
  }, [activeChat?.typingUsers, user.name]);

  useEffect(() => {
    if (view === 'approvals' && user.role === 'admin') loadPending();
    if (view === 'directory') loadAllUsers();
  }, [view]);

  const loadPending = async () => {
    const pending = await getPendingUsers();
    setPendingUsers(pending);
  };

  const loadAllUsers = async () => {
    const users = await getAllRegisteredUsers(false);
    setAllUsers(users.filter(u => u.uid !== user.uid));
  };

  const handleApprove = async (uid: string) => {
    await approveUser(uid);
    loadPending();
  };

  const handleStartChat = async (target: AppUser) => {
    const chatId = await createOrGetChat(user, target);
    const newChat = threads.find(t => t.id === chatId) || {
      id: chatId,
      participants: [user.uid, target.uid],
      participantNames: [user.name, target.name],
      isGroup: false,
      lastTimestamp: Date.now()
    };
    setActiveChat(newChat as ChatThread);
    setView('chats');
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !activeChat) return;
    
    const baseMsg = {
      senderId: user.uid,
      senderName: user.name,
      text: inputText,
      timestamp: Date.now(),
    };
    
    const msg = replyTo 
      ? { ...baseMsg, replyTo: { text: String(replyTo.text), author: String(replyTo.senderName) } }
      : baseMsg;
    
    await sendChatMessage(activeChat.id, msg);
    setInputText('');
    setReplyTo(null);
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || selectedMembers.length === 0) return;
    const members = allUsers.filter(u => selectedMembers.includes(u.uid));
    await createGroupChat(user, newGroupName, members);
    setNewGroupName('');
    setSelectedMembers([]);
    setIsCreatingGroup(false);
  };

  const handleForward = async (targetThread: ChatThread) => {
    if (!forwardingMsg) return;
    const msg: Omit<ChatMessage, 'id'> = {
      senderId: user.uid,
      senderName: user.name,
      text: `*Forwarded:*\n${String(forwardingMsg.text)}`,
      timestamp: Date.now()
    };
    await sendChatMessage(targetThread.id, msg);
    setForwardingMsg(null);
    setActiveChat(targetThread);
  };

  const toggleMember = (uid: string) => {
    setSelectedMembers(prev => prev.includes(uid) ? prev.filter(mid => mid !== uid) : [...prev, uid]);
  };

  const formatText = (text: string) => {
    return String(text || "")
      .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      .replace(/~(.*?)~/g, '<del>$1</del>');
  };

  const emojis = ['👍', '😂', '😮', '😢', '🔥', '🙏', '💯', '✅', '📚', '🎯'];

  if (!user.isApproved && user.role !== 'admin') {
    return (
      <div className="w-full max-w-4xl mx-auto p-20 bg-white rounded-[3rem] shadow-2xl border text-center animate-in zoom-in-95">
         <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
            <svg className="w-12 h-12 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 11v5m0 0h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
         </div>
         <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tight mb-4">Chat is Locked</h2>
         <p className="text-sm text-gray-500 font-medium max-w-md mx-auto leading-relaxed">
           Hello {String(user.name)}! Your account is currently <span className="text-emerald-600 font-black">PENDING APPROVAL</span> from Mr. Wise. 
         </p>
         <div className="mt-10"><span className="text-xs font-black text-emerald-600 uppercase bg-emerald-50 px-6 py-2 rounded-full">Awaiting Mr. Wise Logic</span></div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto h-[85vh] flex bg-white rounded-[2rem] shadow-2xl border overflow-hidden animate-in fade-in zoom-in-95 duration-500">
      
      {/* Sidebar */}
      <div className="w-1/3 border-r flex flex-col bg-gray-50/50">
        <div className="p-6 bg-white border-b flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Logo size={32} />
              <h3 className="font-black text-emerald-600 uppercase tracking-tighter text-sm">Legit Chats</h3>
            </div>
            {user.role === 'admin' && (
              <button onClick={() => { loadAllUsers(); setIsCreatingGroup(true); }} className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-xl transition-all" title="New Group">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
              </button>
            )}
          </div>

          <div className="flex bg-gray-100 p-1 rounded-xl">
             <button onClick={() => setView('chats')} className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${view === 'chats' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400'}`}>Chats</button>
             {user.role === 'admin' && (
               <>
                 <button onClick={() => setView('directory')} className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${view === 'directory' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400'}`}>Directory</button>
                 <button onClick={() => setView('approvals')} className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${view === 'approvals' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400'}`}>Approvals</button>
               </>
             )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {view === 'chats' ? (
            threads.length === 0 ? (
              <div className="p-10 text-center opacity-30"><p className="text-xs font-black uppercase tracking-widest">No Active Chats</p></div>
            ) : threads.map(thread => {
              const partnerName = thread.participantNames.find(n => typeof n === 'string' && n !== user.name) || "Unknown User";
              return (
                <div key={thread.id} onClick={() => setActiveChat(thread)} className={`p-5 border-b cursor-pointer transition-all hover:bg-white flex items-center gap-4 ${activeChat?.id === thread.id ? 'bg-emerald-50 border-l-4 border-l-emerald-500' : ''}`}>
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-black text-xl shadow-md ${thread.isGroup ? 'bg-blue-500' : 'bg-emerald-500'}`}>
                    {thread.isGroup ? 'G' : String(partnerName)[0] || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-black text-gray-900 truncate text-sm">{thread.isGroup ? String(thread.name) : String(partnerName)}</h4>
                    <p className="text-[10px] text-gray-400 truncate font-medium">{String(thread.lastMessage || 'Start a conversation...')}</p>
                  </div>
                </div>
              );
            })
          ) : view === 'directory' ? (
            allUsers.map(u => (
              <div key={u.uid} onClick={() => handleStartChat(u)} className="p-5 flex items-center gap-4 hover:bg-white border-b cursor-pointer transition-all">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-black text-sm">{String(u.name)[0]}</div>
                <div>
                  <h4 className="font-black text-gray-900 text-[11px]">{String(u.name)}</h4>
                  <p className="text-[9px] text-gray-400 font-bold">{String(u.phone)}</p>
                </div>
                {!u.isApproved && <span className="ml-auto text-[8px] bg-red-50 text-red-500 px-2 py-1 rounded-full font-black uppercase">Unapproved</span>}
              </div>
            ))
          ) : (
            pendingUsers.map(u => (
              <div key={u.uid} className="p-4 bg-white border-b flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center font-black text-xs">{String(u.name)[0]}</div>
                  <div className="flex-1"><h4 className="font-black text-gray-900 text-[10px]">{String(u.name)}</h4><p className="text-[8px] text-gray-400">{String(u.phone)}</p></div>
                </div>
                <button onClick={() => handleApprove(u.uid)} className="w-full py-2 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest">Approve</button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col whatsapp-bg relative">
        {activeChat ? (
          <>
            <div className="p-4 bg-white border-b flex justify-between items-center shadow-sm z-10">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-black shadow-inner ${activeChat.isGroup ? 'bg-blue-500' : 'bg-emerald-500'}`}>
                  {activeChat.isGroup ? 'G' : (activeChat.participantNames.find(n => typeof n === 'string' && n !== user.name)?.[0] || 'U')}
                </div>
                <div>
                  <h3 className="font-black text-gray-900 text-sm">
                    {activeChat.isGroup ? String(activeChat.name) : String(activeChat.participantNames.find(n => typeof n === 'string' && n !== user.name) || "Unknown")}
                  </h3>
                  <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest animate-pulse h-3">
                    {otherTypingUsers.length > 0 ? `${otherTypingUsers.join(', ')} typing...` : 'online'}
                  </p>
                </div>
              </div>
              <button onClick={() => setActiveChat(null)} className="text-gray-400 hover:text-red-500">✕</button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-10 space-y-2">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.senderId === user.uid ? 'justify-end' : 'justify-start'}`}>
                   <div className={`max-w-[75%] rounded-xl p-2 px-3 shadow-md relative group text-sm text-gray-800 ${msg.senderId === user.uid ? 'bg-[#dcf8c6] rounded-br-none' : 'bg-white rounded-bl-none'}`}>
                     {msg.replyTo && (
                       <div className="mb-2 p-2 bg-black/5 rounded-lg border-l-4 border-emerald-500 text-[10px]">
                         <p className="font-black text-emerald-800">{String(msg.replyTo.author)}</p>
                         <p className="truncate text-gray-500">{String(msg.replyTo.text)}</p>
                       </div>
                     )}
                     <div className="prose prose-sm" dangerouslySetInnerHTML={{ __html: formatText(msg.text) }} />
                     <div className="text-[10px] text-gray-400 text-right mt-1 ml-4 flex justify-end items-center gap-1">
                       {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                       {msg.senderId === user.uid && <span className="text-blue-500">✔✔</span>}
                     </div>
                   </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-transparent border-t-0 flex flex-col gap-3 z-10">
              {replyTo && (
                <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-emerald-200 shadow-sm animate-in zoom-in-95">
                  <div className="min-w-0">
                    <p className="text-[9px] font-black text-emerald-700 uppercase">Replying to {String(replyTo.senderName)}</p>
                    <p className="text-[10px] text-gray-500 truncate">{String(replyTo.text)}</p>
                  </div>
                  <button onClick={() => setReplyTo(null)} className="text-gray-400">✕</button>
                </div>
              )}
              
              <div className="flex gap-2 mb-1 overflow-x-auto py-1">{emojis.map(e => (<button key={e} onClick={() => setInputText(prev => prev + e)} className="p-2 bg-white/50 backdrop-blur-sm hover:bg-white rounded-lg text-lg transition-all shadow-sm">{String(e)}</button>))}</div>

              <div className="flex gap-4 items-center">
                <input type="text" value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} placeholder="Type a Legit message..." className="flex-1 p-4 bg-white border rounded-2xl text-sm font-bold outline-none focus:ring-2 ring-emerald-300 shadow-lg" />
                <button onClick={handleSendMessage} className="flex-shrink-0 w-14 h-14 bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all min-w-[56px]">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-20 opacity-40 grayscale"><Logo size={120} className="mb-6" /><h3 className="text-2xl font-black text-emerald-900 uppercase">Mr. Wise Web Chat</h3><p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-2 max-w-sm">Select a contact or group to start chatting.</p></div>
        )}
      </div>

      {/* Overlays */}
      {isCreatingGroup && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95">
             <div className="p-8 border-b bg-gray-50 flex justify-between items-center"><h3 className="text-xl font-black text-gray-900 uppercase">New Group</h3><button onClick={() => setIsCreatingGroup(false)} className="text-gray-400">✕</button></div>
             <div className="p-8 border-b"><input type="text" placeholder="Group Name" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} className="w-full p-4 bg-white border-2 border-emerald-200 rounded-2xl text-xs font-bold outline-none focus:border-emerald-500 transition-colors" /></div>
             <div className="max-h-[40vh] overflow-y-auto p-4 space-y-2">
               {allUsers.map(u => (
                 <div key={u.uid} onClick={() => toggleMember(u.uid)} className={`p-4 rounded-2xl flex items-center gap-4 cursor-pointer transition-all ${selectedMembers.includes(u.uid) ? 'bg-emerald-50 border-emerald-200 border-2' : 'border-2 border-transparent hover:bg-gray-50'}`}>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedMembers.includes(u.uid) ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-gray-200'}`}>{selectedMembers.includes(u.uid) && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7"/></svg>}</div>
                    <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-black text-xs">{String(u.name)[0]}</div>
                    <div className="flex-1"><h4 className="font-black text-gray-900 text-[10px]">{String(u.name)}</h4><p className="text-[8px] text-gray-400">{String(u.phone)}</p></div>
                 </div>
               ))}
             </div>
             <div className="p-8 bg-gray-50 flex gap-3"><Button onClick={handleCreateGroup} disabled={!newGroupName.trim() || selectedMembers.length === 0} className="flex-1 py-4 uppercase font-black">Create Group ({selectedMembers.length})</Button></div>
          </div>
        </div>
      )}

      {forwardingMsg && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95">
             <div className="p-8 border-b bg-gray-50 flex justify-between items-center"><h3 className="text-xl font-black text-gray-900 uppercase">Forward To...</h3><button onClick={() => setForwardingMsg(null)} className="text-gray-400">✕</button></div>
             <div className="max-h-[60vh] overflow-y-auto p-4 space-y-2">
               {threads.map(thread => (
                 <div key={thread.id} onClick={() => handleForward(thread)} className="p-4 rounded-2xl flex items-center gap-4 cursor-pointer hover:bg-emerald-50 border-2 border-transparent transition-all">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-black shadow-sm ${thread.isGroup ? 'bg-blue-500' : 'bg-emerald-500'}`}>{thread.isGroup ? 'G' : (thread.participantNames.find(n => typeof n === 'string' && n !== user.name)?.[0] || 'U')}</div>
                    <div className="flex-1 min-w-0"><h4 className="font-black text-gray-900 truncate text-xs">{thread.isGroup ? String(thread.name) : String(thread.participantNames.find(n => typeof n === 'string' && n !== user.name))}</h4></div>
                    <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                 </div>
               ))}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatSystem;
