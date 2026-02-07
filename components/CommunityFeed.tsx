
import React, { useState, useEffect } from 'react';
import { subscribeToPosts, addComment, publishPost, deletePost } from '../services/firebaseService';
import { Post, AppUser } from '../types';
import Button from './Button';
import { generateTutorVoice } from '../services/geminiService';

interface CommunityFeedProps {
  user: AppUser;
  onNavigateToTools?: () => void;
}

const CommunityFeed: React.FC<CommunityFeedProps> = ({ user, onNavigateToTools }) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentingId, setCommentingId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [isVoiceLoading, setIsVoiceLoading] = useState(false);

  // New Post State for Admins
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostType, setNewPostType] = useState<'update' | 'news' | 'trial'>('update');

  useEffect(() => {
    setError(null);
    let isMounted = true;

    // Use a small delay to ensure Firebase Auth token is fully ready for the Firestore request
    const timer = setTimeout(() => {
      const unsubscribe = subscribeToPosts(
        (data) => {
          if (isMounted) {
            setPosts(data);
            setLoading(false);
          }
        },
        (err) => {
          if (isMounted) {
            console.error("Firestore error:", err);
            if (err.code === 'permission-denied') {
              setError("Permission Denied: Your database is currently locked. Check Firestore Rules in Firebase Console.");
            } else {
              setError("Failed to connect to the community feed. Check your connection.");
            }
            setLoading(false);
          }
        }
      );
      
      return () => {
        isMounted = false;
        unsubscribe();
      };
    }, 500);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  const handleCreatePost = async () => {
    if (!newPostTitle.trim() || !newPostContent.trim()) return;
    try {
      await publishPost({
        authorId: user.uid,
        authorName: user.role === 'admin' ? 'Mr. Wise (Tutor)' : String(user.name),
        title: newPostTitle,
        content: newPostContent,
        type: newPostType,
      });
      setNewPostTitle('');
      setNewPostContent('');
      setShowCreatePost(false);
    } catch (e: any) {
      alert(e.code === 'permission-denied' ? "Permission Denied: Check your Firestore Rules." : "Failed to create post.");
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (confirm("Are you sure you want to delete this post?")) {
      try {
        await deletePost(postId);
      } catch (e) {
        alert("Delete failed.");
      }
    }
  };

  const handlePostComment = async (postId: string) => {
    if (!commentText.trim()) return;
    try {
      await addComment(postId, {
        authorId: user.uid,
        authorName: String(user.name),
        text: commentText
      });
      setCommentText('');
      setCommentingId(null);
    } catch (e) {
      alert("Failed to post comment.");
    }
  };

  const playVoice = async (text: string) => {
    if (isVoiceLoading) return;
    setIsVoiceLoading(true);
    try {
      const pcmData = await generateTutorVoice(String(text));
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const dataInt16 = new Int16Array(pcmData.buffer);
      const audioBuffer = audioCtx.createBuffer(1, dataInt16.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.start();
    } catch (e) {
      alert("Voice unavailable.");
    } finally {
      setIsVoiceLoading(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20">
      <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="mt-4 font-black text-emerald-600 uppercase text-xs animate-pulse">Checking Permissions...</p>
    </div>
  );

  if (error) return (
    <div className="w-full max-w-2xl mx-auto p-12 bg-white rounded-[3rem] border-2 border-red-100 shadow-xl text-center">
       <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500">
         <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
       </div>
       <h3 className="text-xl font-black text-gray-900 uppercase mb-4">Database Locked</h3>
       <p className="text-sm text-gray-500 font-medium mb-8 leading-relaxed">
         {String(error)}
       </p>
       
       <div className="flex flex-col gap-4">
         {user.role === 'admin' && onNavigateToTools && (
           <Button onClick={onNavigateToTools} className="w-full py-4 uppercase font-black">
             Skip to Tutor Tools (Offline Mode)
           </Button>
         )}
         <div className="bg-gray-50 p-6 rounded-2xl text-left border">
            <p className="text-[10px] font-black uppercase text-emerald-600 mb-2 tracking-widest">Administrator Action Required:</p>
            <ol className="text-[10px] font-bold text-gray-600 space-y-2 list-decimal ml-4 uppercase">
              <li>Open Firebase Console (Project: budgetwise-y9e4d)</li>
              <li>Go to "Firestore Database" > "Rules"</li>
              <li>Change rules to: <code>allow read, write: if request.auth != null;</code></li>
              <li>Click "Publish" and refresh Mr. Wise.</li>
            </ol>
         </div>
       </div>
    </div>
  );

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 pb-20 animate-in slide-in-from-bottom-8">
      
      {/* Admin Post Creation */}
      {user.role === 'admin' && (
        <div className="bg-white rounded-[2.5rem] border shadow-xl p-8 mb-12">
          {!showCreatePost ? (
            <button 
              onClick={() => setShowCreatePost(true)}
              className="w-full py-4 bg-emerald-50 border-2 border-dashed border-emerald-200 rounded-2xl text-emerald-600 font-black uppercase text-xs hover:bg-emerald-100 transition-all flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4"/></svg>
              Create New Update or Trial Post
            </button>
          ) : (
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-black text-gray-900 uppercase">New Post</h3>
                <button onClick={() => setShowCreatePost(false)} className="text-gray-400">✕</button>
              </div>
              <input 
                type="text" 
                placeholder="Post Title (e.g. Science Mock 1)" 
                value={newPostTitle}
                onChange={e => setNewPostTitle(e.target.value)}
                className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-sm outline-none focus:ring-2 ring-emerald-500/20"
              />
              <select 
                value={newPostType}
                onChange={e => setNewPostType(e.target.value as any)}
                className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-sm outline-none"
              >
                <option value="update">General Update</option>
                <option value="trial">Trial Questions</option>
                <option value="news">Important News</option>
              </select>
              <textarea 
                placeholder="Write your content here..." 
                value={newPostContent}
                onChange={e => setNewPostContent(e.target.value)}
                className="w-full h-40 p-4 bg-gray-50 border rounded-2xl font-bold text-sm outline-none focus:ring-2 ring-emerald-500/20 resize-none"
              />
              <Button onClick={handleCreatePost} className="w-full py-4 uppercase font-black">Publish to Students</Button>
            </div>
          )}
        </div>
      )}

      {posts.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-[3rem] border shadow-sm">
          <p className="font-black text-gray-300 uppercase">No community posts yet.</p>
        </div>
      ) : posts.map(post => (
        <div key={post.id} className="bg-white rounded-[2.5rem] shadow-xl border overflow-hidden">
          <div className="p-8 border-b bg-gray-50/50 flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={`text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${post.type === 'trial' ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'}`}>{String(post.type)}</span>
                {user.role === 'admin' && (
                  <button onClick={() => handleDeletePost(post.id)} className="text-red-400 hover:text-red-600 p-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                )}
              </div>
              <h3 className="text-2xl font-black text-gray-900 mt-2">{String(post.title)}</h3>
              <p className="text-[10px] font-black text-emerald-600 uppercase mt-1">By {String(post.authorName)} • {new Date(post.timestamp).toLocaleDateString()}</p>
            </div>
            {(post.type === 'trial' || String(post.content || "").length > 100) && (
              <button 
                onClick={() => playVoice(post.content)} 
                disabled={isVoiceLoading}
                className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all shadow-sm flex-shrink-0"
              >
                {isVoiceLoading ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div> : <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>}
              </button>
            )}
          </div>

          <div className="p-8 whitespace-pre-wrap text-sm text-gray-700 font-medium leading-relaxed">
            {String(post.content || "")}
          </div>

          {(post.solutions || post.guide) && (
             <div className="px-8 pb-8 flex flex-wrap gap-4">
                {post.solutions && (
                  <div className="flex-1 min-w-[200px] p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <p className="text-[10px] font-black text-emerald-700 uppercase mb-2 tracking-widest">Solution Set Attached</p>
                    <Button variant="secondary" className="w-full text-[10px] font-black uppercase" onClick={() => alert(String(post.solutions))}>Unlock Solutions</Button>
                  </div>
                )}
                {post.guide && (
                  <div className="flex-1 min-w-[200px] p-4 bg-blue-50 rounded-2xl border border-blue-100">
                    <p className="text-[10px] font-black text-blue-700 uppercase mb-2 tracking-widest">Tutor Logic Guide</p>
                    <Button variant="secondary" className="w-full text-[10px] font-black uppercase" onClick={() => alert(String(post.guide))}>View Logic</Button>
                  </div>
                )}
             </div>
          )}

          <div className="bg-gray-50 p-8 border-t">
            <h4 className="text-[10px] font-black text-gray-400 uppercase mb-6 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
              Student Discussion ({post.comments.length})
            </h4>

            <div className="space-y-4 mb-8">
              {post.comments.map(comment => (
                <div key={comment.id} className="bg-white p-5 rounded-2xl border shadow-sm">
                  <div className="flex justify-between mb-2">
                    <span className="text-[10px] font-black text-emerald-700 uppercase flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                      {String(comment.authorName)}
                    </span>
                    <span className="text-[8px] font-bold text-gray-300 uppercase">{new Date(comment.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                  </div>
                  <p className="text-xs font-medium text-gray-600 leading-normal">{String(comment.text)}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-4">
              <input 
                type="text" 
                placeholder="Type your question or comment..." 
                value={commentingId === post.id ? commentText : ''}
                onChange={(e) => { setCommentingId(post.id); setCommentText(e.target.value); }}
                className="flex-1 p-4 bg-white border rounded-2xl text-xs font-bold outline-none focus:ring-2 ring-emerald-500/20 shadow-inner"
              />
              <Button 
                onClick={() => handlePostComment(post.id)}
                className="px-8 font-black uppercase text-[10px] tracking-widest"
              >
                Comment
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default CommunityFeed;
