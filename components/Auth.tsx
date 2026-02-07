
import React, { useState, useEffect } from 'react';
import { loginWithPhone, registerWithPhone, resetPassword } from '../services/firebaseService';
import { AppUser } from '../types';
import Button from './Button';
import Logo from './Logo';

interface AuthProps {
  onAuth: (user: AppUser) => void;
}

const ELECTIVES = [
  'Elective Mathematics', 'Physics', 'Chemistry', 'Biology', 
  'Government', 'Economics', 'CRS', 'Literature in English',
  'Financial Accounting', 'Cost Accounting', 'Business Management',
  'Geography', 'History', 'Graphic Design', 'Visual Arts'
];

const CORES = [
  'General Mathematics', 'English Language', 'Integrated Science', 'Social Studies'
];

const Auth: React.FC<AuthProps> = ({ onAuth }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [selectedElectives, setSelectedElectives] = useState<string[]>([]);
  const [core, setCore] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isAdminDetected, setIsAdminDetected] = useState(false);

  useEffect(() => {
    setIsAdminDetected(phone.includes('0207689520') || phone.includes('207689520'));
  }, [phone]);

  const toggleElective = (subj: string) => {
    setSelectedElectives(prev => 
      prev.includes(subj) ? prev.filter(s => s !== subj) : [...prev, subj]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      if (isLogin) {
        const user = await loginWithPhone(phone, password);
        onAuth(user);
      } else {
        if (!isAdminDetected && selectedElectives.length === 0) {
          throw new Error("Please select at least one elective subject.");
        }
        const user = await registerWithPhone(
          phone, 
          password, 
          name || (isAdminDetected ? 'Mr. Wise' : 'Student'),
          nickname,
          selectedElectives,
          core
        );
        onAuth(user);
      }
    } catch (err: any) {
      if (err.code === 'auth/wrong-password') {
        setError("Wrong password. If you've forgotten it, you must delete your user record in the Firebase Console (budgetwise-y9e4d) and Sign Up again.");
      } else if (err.code === 'auth/user-not-found') {
        setError("Account not found. Please click 'Sign Up' below to create your account.");
      } else if (err.code === 'auth/email-already-in-use') {
        setError("Account already exists. Please 'Log In' instead.");
      } else {
        setError(err.message || "Authentication failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!phone) {
      setError("Please enter your phone number first.");
      return;
    }
    
    if (isAdminDetected) {
      setError("Admin Password Recovery: Standard reset won't work for virtual emails. Delete your user record in Firebase and Sign Up again.");
      return;
    }

    setLoading(true);
    try {
      await resetPassword(phone);
      setMessage("Reset link sent (Note: Only works if using a real email system).");
    } catch (err: any) {
      setError("Could not send reset link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-700 ${isAdminDetected ? 'bg-gray-900' : 'bg-emerald-600'}`}>
      <div className={`bg-white rounded-[3rem] p-10 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-300 relative overflow-hidden ${isAdminDetected ? 'ring-4 ring-emerald-500/30' : ''}`}>
        
        {isAdminDetected && (
          <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 animate-pulse"></div>
        )}

        <div className="text-center mb-8">
          <Logo size={80} className="mx-auto mb-4" />
          <h2 className="text-3xl font-black text-gray-900">{isAdminDetected ? 'Tutor Portal' : 'Mr. Wise'}</h2>
          <p className="text-xs font-black uppercase text-emerald-600 tracking-widest mt-1">
            {isAdminDetected 
              ? (isLogin ? 'Log In to Dashboard' : 'Initialize Tutor Account')
              : (isLogin ? 'Welcome Back, Scholar' : 'Create Student Account')
            }
          </p>
        </div>

        {error && <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-[10px] font-black text-red-600 uppercase text-center leading-relaxed">{error}</div>}
        {message && <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-[10px] font-black text-emerald-600 uppercase text-center">{message}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              {!isAdminDetected && (
                <input 
                  type="text" 
                  placeholder="Full Name" 
                  required
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-sm outline-none focus:ring-2 ring-emerald-500/20" 
                />
              )}
              {!isAdminDetected && (
                <input 
                  type="text" 
                  placeholder="Nickname" 
                  required
                  value={nickname} 
                  onChange={e => setNickname(e.target.value)} 
                  className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-sm outline-none focus:ring-2 ring-emerald-500/20" 
                />
              )}
              
              {!isAdminDetected && (
                <div className="p-4 bg-gray-50 border rounded-2xl">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Select Your Electives (Multiple)</h4>
                  <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                    {ELECTIVES.map(subj => (
                      <label key={subj} className="flex items-center gap-3 p-2 bg-white rounded-xl border-2 border-transparent hover:border-emerald-100 cursor-pointer transition-all">
                        <input 
                          type="checkbox" 
                          checked={selectedElectives.includes(subj)} 
                          onChange={() => toggleElective(subj)}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300"
                        />
                        <span className={`text-xs font-bold ${selectedElectives.includes(subj) ? 'text-emerald-700' : 'text-gray-500'}`}>{subj}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {!isAdminDetected && (
                <select 
                  required
                  value={core} 
                  onChange={e => setCore(e.target.value)} 
                  className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-sm outline-none focus:ring-2 ring-emerald-500/20"
                >
                  <option value="">Select Core Subject</option>
                  {CORES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </>
          )}

          <div className="relative">
            <input 
              type="tel" 
              placeholder="Phone Number" 
              required
              value={phone} 
              onChange={e => setPhone(e.target.value)} 
              className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-sm outline-none focus:ring-2 ring-emerald-500/20" 
            />
            {isAdminDetected && (
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-emerald-500 uppercase">Admin</span>
            )}
          </div>
          <input 
            type="password" 
            placeholder={isLogin ? "Enter Password" : "Create New Password"} 
            required
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-sm outline-none focus:ring-2 ring-emerald-500/20" 
          />
          
          <Button type="submit" disabled={loading} className={`w-full py-4 uppercase font-black tracking-widest mt-4 ${isAdminDetected ? 'bg-emerald-500 hover:bg-emerald-600' : ''}`}>
            {loading ? 'Processing...' : (
              isLogin 
                ? (isAdminDetected ? 'Enter Tutor Tools' : 'Log In') 
                : (isAdminDetected ? 'Setup Admin Account' : 'Sign Up')
            )}
          </Button>
        </form>

        <div className="mt-8 flex flex-col gap-4 text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)} 
            className="text-[10px] font-black uppercase text-gray-400 hover:text-emerald-600 transition-colors"
          >
            {isLogin ? "Need a new account? Click Sign Up" : "Already have an account? Log In"}
          </button>
          
          {isLogin && (
            <button 
              onClick={handleForgotPassword}
              className="text-[10px] font-black uppercase text-emerald-600/50 hover:text-emerald-600 transition-colors"
            >
              Forgot Password?
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
