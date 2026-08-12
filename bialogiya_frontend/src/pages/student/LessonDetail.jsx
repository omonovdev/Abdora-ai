import { getSubjectIcon, getSubjectBadgeClass, getSubjectLabel } from '../../utils/subjects';
import { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Brain, Lightbulb, BookOpen, Repeat, FileText, Map, Volume2,
  MessageSquare, Users, ArrowLeft, RefreshCw, ChevronLeft, ChevronRight,
  Send, Loader2, Play, Pause, Square, Check, X, Download, Clapperboard, Mic
} from 'lucide-react';
import api from '../../config/axios';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import StoryAudioPlayer from '../../components/ai/StoryAudioPlayer';
import ExplainerVideoPlayer from '../../components/ai/ExplainerVideoPlayer';
import SpeakingPractice from '../../components/ai/SpeakingPractice';


const TABS = [
  { id: 'overview', icon: BookOpen, key: 'overview', label: 'Overview' },
  { id: 'explain', icon: Brain, key: 'ai_explanation', label: 'AI Explain' },
  { id: 'tricks', icon: Lightbulb, key: 'memory_tricks', label: 'Mnemonics' },
  { id: 'story', icon: FileText, key: 'story_mode', label: 'Story' },
  { id: 'examples', icon: Repeat, key: 'real_examples', label: 'Examples' },
  { id: 'quiz', icon: Check, key: 'ai_quiz', label: 'Quiz' },
  { id: 'flashcards', icon: Repeat, key: 'flashcards', label: 'Flashcards' },
  { id: 'summary', icon: FileText, key: 'summary', label: 'Summary' },
  { id: 'mindmap', icon: Map, key: 'mind_map', label: 'Mind Map' },
  { id: 'voice', icon: Volume2, key: 'voice_teacher', label: 'Voice' },
  { id: 'video', icon: Clapperboard, key: 'explainer_video', label: 'Video' },
  { id: 'speaking', icon: Mic, key: 'speaking_practice', label: 'Speaking' },
  { id: 'chat', icon: MessageSquare, key: 'ai_chat', label: 'AI Chat' },
];

const CHAT_STYLES = [
  { id: 'normal', label: 'Normal' },
  { id: 'like_im_10', label: "Like I'm 10" },
  { id: 'emoji', label: 'With Emojis' },
  { id: 'step_by_step', label: 'Step by Step' },
  { id: 'with_examples', label: 'With Examples' },
];

// Flashcard component
function FlashcardDeck({ cards }) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  if (!cards?.length) return <div className="text-gray-400 text-center py-10">No flashcards available</div>;
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-sm text-gray-500">{idx + 1} / {cards.length}</div>
      <div className="cursor-pointer w-full max-w-lg" style={{ perspective: '1000px' }} onClick={() => setFlipped(!flipped)}>
        <motion.div
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.5 }}
          style={{ transformStyle: 'preserve-3d', position: 'relative', height: '220px' }}
        >
          <div style={{ backfaceVisibility: 'hidden' }}
            className="absolute inset-0 gradient-bg rounded-3xl flex items-center justify-center p-8 text-white text-center">
            <div>
              <div className="text-xs uppercase tracking-wider opacity-70 mb-3">Question</div>
              <p className="text-lg font-semibold">{cards[idx]?.front}</p>
            </div>
          </div>
          <div style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            className="absolute inset-0 bg-white dark:bg-gray-900 border-2 border-primary/30 rounded-3xl flex items-center justify-center p-8 text-center shadow-soft">
            <div>
              <div className="text-xs uppercase tracking-wider text-gray-400 mb-3">Answer</div>
              <p className="text-gray-800 dark:text-white font-medium">{cards[idx]?.back}</p>
            </div>
          </div>
        </motion.div>
      </div>
      <p className="text-xs text-gray-400">Click card to flip</p>
      <div className="flex items-center gap-3">
        <button onClick={() => { setIdx(Math.max(0, idx - 1)); setFlipped(false); }}
          disabled={idx === 0} className="btn-ghost p-2 disabled:opacity-40">
          <ChevronLeft size={20} />
        </button>
        <div className="flex gap-1">
          {cards.map((_, i) => (
            <button key={i} onClick={() => { setIdx(i); setFlipped(false); }}
              className={`w-2 h-2 rounded-full transition-all ${i === idx ? 'bg-primary w-4' : 'bg-gray-200'}`} />
          ))}
        </div>
        <button onClick={() => { setIdx(Math.min(cards.length - 1, idx + 1)); setFlipped(false); }}
          disabled={idx === cards.length - 1} className="btn-ghost p-2 disabled:opacity-40">
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}

// Quiz component
function QuizSection({ questions }) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  if (!questions?.length) return <div className="text-gray-400 text-center py-10">No quiz questions available</div>;

  const q = questions[current];
  const score = Object.keys(answers).filter(i => {
    const qi = questions[parseInt(i)];
    return qi?.options?.[answers[i]]?.isCorrect;
  }).length;

  if (submitted) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8">
        <div className="text-6xl mb-4">{score >= questions.length * 0.8 ? '🏆' : score >= questions.length * 0.6 ? '👍' : '📚'}</div>
        <h3 className="text-2xl font-bold gradient-text">{score}/{questions.length}</h3>
        <p className="text-gray-500 mt-2">{Math.round((score / questions.length) * 100)}% correct</p>
        <div className="mt-6 space-y-3 text-left max-w-xl mx-auto">
          {questions.map((qi, i) => {
            const isCorrect = qi.options?.[answers[i]]?.isCorrect;
            const correctIdx = qi.options?.findIndex(o => o.isCorrect);
            return (
              <div key={i} className={`p-3 rounded-xl border ${isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="text-sm font-medium">{qi.text}</div>
                {!isCorrect && (
                  <div className="text-xs text-green-600 mt-1">✓ {qi.options?.[correctIdx]?.text}</div>
                )}
                {qi.explanation && <div className="text-xs text-gray-500 mt-1">{qi.explanation}</div>}
              </div>
            );
          })}
        </div>
        <button onClick={() => { setAnswers({}); setCurrent(0); setSubmitted(false); }} className="btn-primary mt-6">
          Try Again
        </button>
      </motion.div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-gray-500">Question {current + 1}/{questions.length}</span>
        <span className={`badge text-xs ${q.difficulty === 'easy' ? 'bg-green-100 text-green-700' : q.difficulty === 'hard' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
          {q.difficulty}
        </span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full mb-6">
        <div className="h-full gradient-bg rounded-full transition-all" style={{ width: `${((current + 1) / questions.length) * 100}%` }} />
      </div>
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">{q.text}</h3>
      <div className="space-y-3">
        {q.options?.map((opt, i) => (
          <button key={i} onClick={() => setAnswers(a => ({ ...a, [current]: i }))}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all text-sm ${answers[current] === i ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-gray-100 hover:border-gray-200 bg-white dark:bg-gray-900'}`}>
            <span className="font-semibold mr-2">{String.fromCharCode(65 + i)}.</span> {opt.text}
          </button>
        ))}
      </div>
      <div className="flex justify-between mt-6">
        <button onClick={() => setCurrent(Math.max(0, current - 1))} disabled={current === 0}
          className="btn-ghost disabled:opacity-40">← Previous</button>
        {current < questions.length - 1 ? (
          <button onClick={() => setCurrent(current + 1)} disabled={answers[current] === undefined}
            className="btn-primary disabled:opacity-40">Next →</button>
        ) : (
          <button onClick={() => setSubmitted(true)} disabled={Object.keys(answers).length < questions.length}
            className="btn-primary disabled:opacity-40">Submit Quiz</button>
        )}
      </div>
    </div>
  );
}

// MindMap simple SVG renderer
function MindMap({ data }) {
  if (!data?.nodes?.length) return <div className="text-gray-400 text-center py-10">No mind map available</div>;
  const center = data.nodes.find(n => n.type === 'center') || data.nodes[0];
  const others = data.nodes.filter(n => n.id !== center.id);
  const cx = 400, cy = 200;
  return (
    <div className="overflow-x-auto">
      <svg viewBox="0 0 800 400" className="w-full max-w-2xl mx-auto">
        {data.edges?.map((e, i) => {
          const src = data.nodes.find(n => n.id === e.source);
          const tgt = data.nodes.find(n => n.id === e.target);
          if (!src || !tgt) return null;
          const sx = src.x || cx, sy = src.y || cy;
          const tx = tgt.x || cx, ty = tgt.y || cy;
          return <line key={i} x1={sx} y1={sy} x2={tx} y2={ty} stroke="#00BFA620" strokeWidth="2" />;
        })}
        {data.nodes.map((node, i) => {
          const x = node.x || (i === 0 ? cx : cx + (i % 2 === 0 ? -180 : 180) * (Math.ceil(i / 2) * 0.6));
          const y = node.y || (i === 0 ? cy : cy + (i % 3 - 1) * 100);
          const isCenter = node.type === 'center' || i === 0;
          return (
            <g key={node.id}>
              <ellipse cx={x} cy={y} rx={isCenter ? 70 : 55} ry={isCenter ? 28 : 22}
                fill={isCenter ? '#00BFA6' : '#EAF4F4'} stroke={isCenter ? '#009985' : '#00BFA640'} strokeWidth="2" />
              <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle"
                fontSize={isCenter ? 13 : 11} fontWeight={isCenter ? '700' : '500'}
                fill={isCenter ? 'white' : '#374151'}>
                {(node.label || '').length > 14 ? node.label.slice(0, 12) + '…' : node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Voice player - Gemini TTS (fixed voice, always good Uzbek pronunciation),
// same caching pattern as StoryAudioPlayer. Replaces the old browser
// speechSynthesis version, which depended on whatever voices happened to be
// installed on the device and often had no decent Uzbek voice at all.
function VoiceSection({ lessonId, title }) {
  const audioRef = useRef(null);
  const objectUrlRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | loading | playing | error

  useEffect(() => {
    return () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); };
  }, []);

  const speak = async () => {
    if (audioRef.current && objectUrlRef.current) {
      audioRef.current.play();
      setStatus('playing');
      return;
    }
    setStatus('loading');
    try {
      const res = await api.get(`/lessons/${lessonId}/ai/voice-audio`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      objectUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setStatus('idle');
      await audio.play();
      setStatus('playing');
    } catch (err) {
      console.error(err);
      toast.error("Ovozni yuklab bo'lmadi");
      setStatus('error');
    }
  };

  const stop = () => { audioRef.current?.pause(); setStatus('idle'); };
  const playing = status === 'playing';
  const loading = status === 'loading';

  return (
    <div className="text-center py-8">
      <div className="w-20 h-20 gradient-bg rounded-full mx-auto mb-4 flex items-center justify-center shadow-glow">
        <Volume2 size={36} className="text-white" />
      </div>
      <h3 className="font-bold text-gray-800 dark:text-white mb-2">AI Voice Teacher</h3>
      <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">Darsni ovozli tinglang — o'zbekcha AI narratsiya.</p>

      <div className="flex items-center justify-center gap-3">
        {!playing ? (
          <button onClick={speak} disabled={loading} className="btn-primary flex items-center gap-2 disabled:opacity-60">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {loading ? 'Yuklanmoqda...' : 'Tinglashni boshlash'}
          </button>
        ) : (
          <button onClick={stop} className="btn-outline flex items-center gap-2">
            <Square size={16} /> To'xtatish
          </button>
        )}
      </div>

      {playing && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 flex items-center justify-center gap-1">
          {[0, 1, 2, 3, 4].map(i => (
            <motion.div key={i} animate={{ scaleY: [1, 2, 1] }} transition={{ duration: 0.5, delay: i * 0.1, repeat: Infinity }}
              className="w-1.5 h-4 bg-primary rounded-full" />
          ))}
        </motion.div>
      )}
    </div>
  );
}

// AI Chat section
function AIChatSection({ lessonId, i18nLanguage }) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [style, setStyle] = useState('normal');
  const [lang, setLang] = useState(i18nLanguage || 'uz');
  const bottomRef = useRef(null);

  const { data: history, isLoading: histLoading } = useQuery({
    queryKey: ['ai-chat-history', lessonId],
    queryFn: () => api.get(`/lessons/${lessonId}/ai-chat/history`).then(r => r.data.data?.messages || []),
  });

  useEffect(() => {
    if (history) setMessages(history);
  }, [history]);

  const sendMsg = useMutation({
    mutationFn: (data) => api.post(`/lessons/${lessonId}/ai-chat`, data),
    onMutate: ({ message }) => {
      setMessages(prev => [...prev, { role: 'user', content: message, timestamp: new Date() }]);
      setInput('');
    },
    onSuccess: ({ data }) => {
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply, timestamp: new Date() }]);
    },
    onError: () => toast.error('AI is unavailable. Try again.'),
  });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  return (
    <div className="flex flex-col h-[500px]">
      {/* Controls */}
      <div className="flex gap-2 mb-3 flex-wrap">
        <select value={style} onChange={e => setStyle(e.target.value)} className="input-field text-xs py-1.5 flex-1 min-w-[140px]">
          {CHAT_STYLES.map(s => <option key={s.id} value={s.id}>{t(`explain_${s.id === 'normal' ? 'normal' : s.id === 'like_im_10' ? 'kid' : s.id === 'emoji' ? 'emoji' : s.id === 'step_by_step' ? 'steps' : 'examples'}`)}</option>)}
        </select>
        <select value={lang} onChange={e => setLang(e.target.value)} className="input-field text-xs py-1.5 flex-1 min-w-[100px]">
          <option value="uz">O'zbek</option>
          <option value="ru">Русский</option>
          <option value="en">English</option>
        </select>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-1">
        {messages.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <MessageSquare size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Ask Abdora AI anything about this lesson</p>
          </div>
        )}
        {messages.map((m, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && (
              <div className="w-7 h-7 gradient-bg rounded-full flex items-center justify-center text-white text-xs mr-2 flex-shrink-0 mt-0.5">N</div>
            )}
            <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
              m.role === 'user'
                ? 'gradient-bg text-white rounded-br-sm'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white rounded-bl-sm'
            }`}>
              {m.content}
            </div>
          </motion.div>
        ))}
        {sendMsg.isPending && (
          <div className="flex gap-2">
            <div className="w-7 h-7 gradient-bg rounded-full flex items-center justify-center text-white text-xs">N</div>
            <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <motion.div key={i} animate={{ y: [0, -4, 0] }} transition={{ duration: 0.5, delay: i * 0.15, repeat: Infinity }}
                    className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && input.trim() && sendMsg.mutate({ message: input.trim(), style, language: lang })}
          placeholder={t('ask_ai')}
          className="input-field flex-1 text-sm"
          disabled={sendMsg.isPending}
        />
        <button
          onClick={() => input.trim() && sendMsg.mutate({ message: input.trim(), style, language: lang })}
          disabled={!input.trim() || sendMsg.isPending}
          className="btn-primary px-3 py-2.5 disabled:opacity-40"
        >
          {sendMsg.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}

export default function LessonDetail() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('overview');
  const queryClient = useQueryClient();

  const { data: lesson, isLoading } = useQuery({
    queryKey: ['lesson', id],
    queryFn: () => api.get(`/lessons/${id}`).then(r => r.data.data),
    refetchInterval: (data) => data?.aiContent?.status === 'generating' ? 3000 : false,
  });

  const regenerateMutation = useMutation({
    mutationFn: () => api.post(`/lessons/${id}/regenerate-ai`, { language: i18n.language }),
    onSuccess: () => { toast.success('AI regeneration started'); queryClient.invalidateQueries(['lesson', id]); },
  });

  const downloadAtt = useMutation({
    mutationFn: async (att) => {
      const res = await api.get(`/files/${att.id}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = att.name || 'file';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    onError: () => toast.error('Faylni yuklab bo‘lmadi'),
  });

  const ai = lesson?.aiContent;
  const isGenerating = ai?.status === 'generating';
  const isDone = ai?.status === 'done';
  const isError = ai?.status === 'error';

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full mx-auto mb-4" />
        <p className="text-gray-500">Loading lesson...</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={user?.role === 'teacher' ? '/teacher/lessons' : '/student/lessons'} className="btn-ghost p-2 rounded-xl">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">{lesson?.title}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`badge ${getSubjectBadgeClass(lesson?.subject)}`}>
              {getSubjectIcon(lesson?.subject)} {getSubjectLabel(lesson?.subject)}
            </span>
            <span className={`badge ${isDone ? 'bg-primary/10 text-primary' : isGenerating ? 'bg-yellow-100 text-yellow-700' : isError ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
              {isDone ? '✓ AI Ready' : isGenerating ? '⏳ Generating...' : isError ? '⚠ Error' : '• Pending'}
            </span>
          </div>
        </div>
        {(isError || isDone) && (
          <button onClick={() => regenerateMutation.mutate()} disabled={regenerateMutation.isPending}
            className="btn-ghost p-2 rounded-xl text-gray-500 hover:text-primary">
            <RefreshCw size={16} className={regenerateMutation.isPending ? 'animate-spin' : ''} />
          </button>
        )}
      </div>

      {/* AI Generating banner */}
      <AnimatePresence>
        {isGenerating && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="gradient-bg rounded-2xl p-4 text-white flex items-center gap-3">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}>
              <Brain size={20} />
            </motion.div>
            <div>
              <div className="font-semibold text-sm">AI is generating content for this lesson...</div>
              <div className="text-white/70 text-xs">Explanations, quizzes, flashcards & more coming shortly</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            disabled={tab.id !== 'overview' && !isDone}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all
              ${activeTab === tab.id ? 'gradient-bg text-white shadow-glow' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50'}
              ${tab.id !== 'overview' && !isDone ? 'opacity-40 cursor-not-allowed' : ''}
            `}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="card"
        >
          {activeTab === 'overview' && (
            <div>
              <h2 className="text-lg font-bold mb-4">{lesson?.title}</h2>
              <div className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {lesson?.content || <span className="text-gray-400 italic">No content provided for this lesson.</span>}
              </div>
              {lesson?.attachments?.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-semibold mb-3 text-gray-700 dark:text-gray-200">Attachments</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {lesson.attachments.map((att, i) => (
                      <button key={i} onClick={() => downloadAtt.mutate(att)} disabled={downloadAtt.isPending}
                        className="flex items-center gap-2 p-3 bg-gray-900 text-white rounded-xl hover:bg-black transition-colors text-sm text-left">
                        <Download size={16} className="flex-shrink-0" />
                        <span className="truncate flex-1">{att.name}</span>
                        {downloadAtt.isPending && downloadAtt.variables === att && <Loader2 size={14} className="animate-spin" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {activeTab === 'explain' && (
            <div>
              <h2 className="text-lg font-bold mb-4 gradient-text">Simple Explanation</h2>
              <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{ai?.simpleExplanation}</div>
            </div>
          )}
          {activeTab === 'tricks' && (
            <div>
              <h2 className="text-lg font-bold mb-4 gradient-text">Memory Tricks & Mnemonics</h2>
              <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{ai?.mnemonics}</div>
            </div>
          )}
          {activeTab === 'story' && (
            <div>
              <h2 className="text-lg font-bold mb-4 gradient-text">Story Mode 📖</h2>
              {ai?.storyMode && <div className="mb-4"><StoryAudioPlayer lessonId={id} /></div>}
              <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{ai?.storyMode}</div>
            </div>
          )}
          {activeTab === 'examples' && (
            <div>
              <h2 className="text-lg font-bold mb-4 gradient-text">Real-Life Examples</h2>
              {Array.isArray(ai?.realLifeExamples) ? (
                <div className="space-y-3">
                  {ai.realLifeExamples.map((ex, i) => {
                    // Some older lessons have plain strings in the array
                    // instead of {category, example} objects - handle both.
                    const isObj = ex && typeof ex === 'object';
                    const category = isObj ? ex.category : null;
                    const text = isObj ? ex.example : ex;
                    if (!text) return null;
                    return (
                      <div key={i} className="rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
                        {category && <div className="text-xs font-semibold uppercase tracking-wide text-primary mb-1.5">{category}</div>}
                        <div className="text-gray-700 dark:text-gray-300 leading-relaxed">{text}</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                // Lessons generated before this format change still have a plain string - show as-is.
                <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{ai?.realLifeExamples}</div>
              )}
            </div>
          )}
          {activeTab === 'quiz' && <QuizSection questions={ai?.quizQuestions} />}
          {activeTab === 'flashcards' && <FlashcardDeck cards={ai?.flashcards} />}
          {activeTab === 'summary' && (
            <div>
              <h2 className="text-lg font-bold mb-4 gradient-text">AI Summary</h2>
              <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{ai?.summary}</div>
            </div>
          )}
          {activeTab === 'mindmap' && <MindMap data={ai?.mindMapData} />}
          {activeTab === 'voice' && <VoiceSection lessonId={id} title={lesson?.title} />}
          {activeTab === 'video' && <ExplainerVideoPlayer lessonId={id} />}
          {activeTab === 'speaking' && <SpeakingPractice lessonId={id} topic={lesson?.title} />}
          {activeTab === 'chat' && <AIChatSection lessonId={id} i18nLanguage={i18n.language} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
