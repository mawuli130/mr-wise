
export type AppMode = 'trial' | 'exam';
export type ExamBoard = 'WASSCE' | 'NOV/DEC' | 'NABTEB';
export type MainTab = 'tools' | 'news' | 'community' | 'assistant' | 'rebrand' | 'chat' | 'dashboard';
export type NewsCategory = 'WASSCE' | 'BECE' | 'NABTEB' | 'GES';
export type UserRole = 'admin' | 'student';

export interface QuestionEntry {
  id: string;
  questionNumber: number;
  text: string;
  answer: string;
  guide: string;
}

export interface TutorProfile {
  name: string;
  phone: string;
  location: string;
  memory?: string;
}

export interface AppUser {
  uid: string;
  phone: string;
  role: UserRole;
  name: string;
  nickname?: string;
  electiveSubjects?: string[];
  coreSubject?: string;
  isApproved: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  replyTo?: {
    text: string;
    author: string;
  };
}

export interface ChatThread {
  id: string;
  participants: string[];
  participantNames: string[];
  lastMessage?: string;
  lastTimestamp: number;
  isGroup: boolean;
  name?: string;
  createdBy?: string;
  typingUsers?: { [key: string]: string };
}

export interface Comment {
  id: string;
  authorName: string;
  authorId: string;
  text: string;
  timestamp: number;
}

export interface Post {
  id: string;
  authorName: string;
  authorId: string;
  title: string;
  content: string;
  type: 'trial' | 'news' | 'update';
  board?: ExamBoard;
  year?: string;
  timestamp: number;
  comments: Comment[];
  solutions?: string;
  guide?: string;
}

export interface ProcessedItem {
  id: string;
  timestamp: number;
  updatedAt: number;
  subject: string;
  questions: QuestionEntry[];
  test: string;
  answers: string;
  tutorGuide: string;
  mode: AppMode;
  year: string;
  board: ExamBoard;
  tutorSignature?: string;
  userId: string;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  date: string;
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface FormattingOptions {
  useBold: boolean;
  useItalic: boolean;
  useStrikethrough: boolean;
  useBullets: boolean;
  useNumbers: boolean;
  autoRenumber: boolean;
}

export interface BulkOptions {
  questions: boolean;
  solutions: boolean;
  guide: boolean;
}
