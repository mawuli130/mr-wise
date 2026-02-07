
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut } from "firebase/auth";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, updateDoc, doc, arrayUnion, deleteDoc, getDoc, setDoc, where, limit, getDocs, serverTimestamp,FieldValue, deleteField } from "firebase/firestore";
import { Post, Comment, AppUser, TutorProfile, ChatMessage, ChatThread, ProcessedItem } from "../types";

const firebaseConfig = {
  apiKey: "AIzaSyDkw2WFQZapw0jNr7Mf4t2MqsFxFyxwyMg",
  authDomain: "budgetwise-y9e4d.firebaseapp.com",
  databaseURL: "https://budgetwise-y9e4d-default-rtdb.firebaseio.com",
  projectId: "budgetwise-y9e4d",
  storageBucket: "budgetwise-y9e4d.firebasestorage.app",
  messagingSenderId: "221195838914",
  appId: "1:221195838914:web:1b66a8cbb639bea992625b"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);

const getEmailFromPhone = (phone: string) => `${phone.replace(/\D/g, '')}@wisely.app`;

const syncUserToFirestore = async (user: AppUser) => {
  await setDoc(doc(db, "users", user.uid), user, { merge: true });
};

export const loginWithPhone = async (phone: string, password: string): Promise<AppUser> => {
  const email = getEmailFromPhone(phone);
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
  if (userDoc.exists()) return userDoc.data() as AppUser;

  const isAdmin = phone.includes('0207689520') || phone.includes('207689520');
  const user: AppUser = {
    uid: userCredential.user.uid,
    phone,
    name: phone,
    role: isAdmin ? 'admin' : 'student',
    isApproved: isAdmin
  };
  await syncUserToFirestore(user);
  return user;
};

export const registerWithPhone = async (
  phone: string, 
  password: string, 
  name: string,
  nickname?: string,
  electiveSubjects?: string[],
  coreSubject?: string
): Promise<AppUser> => {
  const email = getEmailFromPhone(phone);
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const isAdmin = phone.includes('0207689520') || phone.includes('207689520');
  const user: AppUser = {
    uid: userCredential.user.uid,
    phone,
    name,
    nickname,
    electiveSubjects: electiveSubjects || [],
    coreSubject,
    role: isAdmin ? 'admin' : 'student',
    isApproved: isAdmin 
  };
  await syncUserToFirestore(user);
  return user;
};

export const getAllRegisteredUsers = async (onlyApproved: boolean = true): Promise<AppUser[]> => {
  const q = onlyApproved 
    ? query(collection(db, "users"), where("isApproved", "==", true))
    : query(collection(db, "users"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as AppUser);
};

export const getAllStudents = async (): Promise<AppUser[]> => {
  const q = query(collection(db, "users"), where("role", "==", "student"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as AppUser);
};

export const getPendingUsers = async (): Promise<AppUser[]> => {
  const q = query(collection(db, "users"), where("isApproved", "==", false));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as AppUser);
};

export const approveUser = async (uid: string) => {
  await updateDoc(doc(db, "users", uid), { isApproved: true });
};

export const getUserByPhone = async (phone: string): Promise<AppUser | null> => {
  const q = query(collection(db, "users"), where("phone", "==", phone), limit(1));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return snapshot.docs[0].data() as AppUser;
};

export const updateTypingStatus = async (chatId: string, userId: string, userName: string, isTyping: boolean) => {
  const chatRef = doc(db, "chats", chatId);
  if (isTyping) {
    await updateDoc(chatRef, {
      [`typingUsers.${userId}`]: userName
    });
  } else {
    await updateDoc(chatRef, {
      [`typingUsers.${userId}`]: deleteField()
    });
  }
};

export const subscribeToChatThreads = (uid: string, isAdmin: boolean, callback: (threads: ChatThread[]) => void) => {
  const q = isAdmin 
    ? query(collection(db, "chats"), orderBy("lastTimestamp", "desc"))
    : query(collection(db, "chats"), where("participants", "array-contains", uid), orderBy("lastTimestamp", "desc"));
    
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatThread)));
  });
};

export const subscribeToMessages = (chatId: string, callback: (msgs: ChatMessage[]) => void) => {
  const q = query(collection(db, "chats", chatId, "messages"), orderBy("timestamp", "asc"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage)));
  });
};

export const sendChatMessage = async (chatId: string, message: Omit<ChatMessage, 'id'>) => {
  const chatRef = doc(db, "chats", chatId);
  const msgRef = collection(db, "chats", chatId, "messages");
  await addDoc(msgRef, { ...message });
  await updateDoc(chatRef, {
    lastMessage: message.text,
    lastTimestamp: message.timestamp
  });
};

export const createOrGetChat = async (currentUser: AppUser, targetUser: AppUser): Promise<string> => {
  const participants = [currentUser.uid, targetUser.uid].sort();
  const q = query(collection(db, "chats"), where("participants", "==", participants), where("isGroup", "==", false), limit(1));
  const snapshot = await getDocs(q);
  if (!snapshot.empty) return snapshot.docs[0].id;
  
  const docRef = await addDoc(collection(db, "chats"), {
    participants,
    participantNames: [currentUser.name, targetUser.name],
    lastTimestamp: Date.now(),
    isGroup: false
  });
  return docRef.id;
};

export const createGroupChat = async (admin: AppUser, groupName: string, selectedMembers: AppUser[]) => {
  const participants = [admin.uid, ...selectedMembers.map(m => m.uid)];
  const participantNames = [admin.name, ...selectedMembers.map(m => m.name)];
  
  await addDoc(collection(db, "chats"), {
    name: groupName,
    isGroup: true,
    createdBy: admin.uid,
    participants,
    participantNames,
    lastTimestamp: Date.now(),
    lastMessage: "Group Created"
  });
};

export const joinGroupChat = async (uid: string, name: string, chatId: string) => {
  const chatRef = doc(db, "chats", chatId);
  await updateDoc(chatRef, {
    participants: arrayUnion(uid),
    participantNames: arrayUnion(name)
  });
};

export const saveTutorProfile = async (uid: string, profile: TutorProfile) => {
  const profileRef = doc(db, "tutorProfiles", uid);
  await setDoc(profileRef, { ...profile, lastUpdated: Date.now() }, { merge: true });
};

export const getTutorProfile = async (uid: string): Promise<TutorProfile | null> => {
  const profileRef = doc(db, "tutorProfiles", uid);
  const docSnap = await getDoc(profileRef);
  return docSnap.exists() ? docSnap.data() as TutorProfile : null;
};

export const resetPassword = async (phone: string) => {
  const email = getEmailFromPhone(phone);
  return sendPasswordResetEmail(auth, email);
};

export const publishPost = async (post: Omit<Post, 'id' | 'timestamp' | 'comments'>) => {
  await addDoc(collection(db, "posts"), { ...post, timestamp: Date.now(), comments: [] });
};

export const deletePost = async (postId: string) => {
  await deleteDoc(doc(db, "posts", postId));
};

export const addComment = async (postId: string, comment: Omit<Comment, 'id' | 'timestamp'>) => {
  const postRef = doc(db, "posts", postId);
  await updateDoc(postRef, {
    comments: arrayUnion({
      ...comment,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now()
    })
  });
};

export const subscribeToPosts = (callback: (posts: Post[]) => void, errorCallback?: (error: any) => void) => {
  const q = query(collection(db, "posts"), orderBy("timestamp", "desc"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post)));
  }, errorCallback);
};

export const savePaperToFirebase = async (paper: Omit<ProcessedItem, 'id'>) => {
  const customId = `${paper.subject.replace(/\s+/g, '-')}-${paper.board}-${paper.year}-${paper.timestamp}`;
  const paperRef = doc(db, "generatedPapers", customId);
  await setDoc(paperRef, paper);
  return customId;
};

export const subscribeToFirebaseLibrary = (userId: string, callback: (papers: ProcessedItem[]) => void) => {
  const q = query(collection(db, "generatedPapers"), where("userId", "==", userId), orderBy("timestamp", "desc"));
  return onSnapshot(q, (snapshot) => {
    const papers = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ProcessedItem));
    callback(papers);
  });
};

export const deletePaperFromFirebase = async (paperId: string) => {
  await deleteDoc(doc(db, "generatedPapers", paperId));
};
