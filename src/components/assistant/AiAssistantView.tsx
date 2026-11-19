import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, RotateCcw } from 'lucide-react';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { ChatMessage } from '../../types';
import { StorageService } from '../../services/storage';
import { db } from '../../services/firebase';
import { cleanForFirestore } from '../../utils/firestoreClean';

export const AiAssistantView: React.FC = () => {
  const { settings, tasks, goals, habits } = useApp();
  const { user } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const uid = user?.uid || 'guest';
    const saved = StorageService.getUserChat(uid);
    if (saved && saved.length > 0) return saved;
    return [
      {
        id: 'welcome-msg',
        role: 'assistant',
        text: `Hi ${settings.userName || 'there'}. I'm here to help you with your Life Reset — organizing your day, breaking down tasks, building habits, and overcoming procrastination. What are you feeling stuck with today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
  });

  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Sync with Firestore chat collection per user
  useEffect(() => {
    if (!user) return;
    const uid = user.uid;

    const chatColRef = collection(db, 'users', uid, 'chatMessages');
    const unsub = onSnapshot(
      chatColRef,
      snap => {
        if (!snap.empty) {
          const items = snap.docs.map(d => d.data() as ChatMessage);
          // Sort messages by ID or timestamp
          items.sort((a, b) => (a.id || '').localeCompare(b.id || ''));
          setMessages(items);
          StorageService.saveUserChat(uid, items);
        }
      },
      err => {
        console.warn('Chat listener notice:', err.message);
      }
    );

    return () => unsub();
  }, [user]);

  useEffect(() => {
    const uid = user?.uid || 'guest';
    StorageService.saveUserChat(uid, messages);
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, user]);

  const saveMessageToFirestore = async (msg: ChatMessage) => {
    if (!user) return;
    try {
      const msgRef = doc(db, 'users', user.uid, 'chatMessages', msg.id);
      await setDoc(msgRef, cleanForFirestore({ ...msg, userId: user.uid }));
    } catch (err) {
      console.warn('Failed to save chat message to Firestore:', err);
    }
  };

  const handleSendMessage = async () => {
    if (!inputPrompt.trim() || isLoading) return;

    const userText = inputPrompt.trim();
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputPrompt('');
    setIsLoading(true);
    saveMessageToFirestore(userMessage);

    try {
      // Include current life reset context quietly so assistant can give relevant guidance
      const pendingTasksList = tasks
        .filter(t => !t.completed)
        .slice(0, 6)
        .map(t => `- ${t.title} (${t.priority} priority)`)
        .join('\n');
      const activeGoalsList = goals
        .slice(0, 3)
        .map(g => `- ${g.title}`)
        .join('\n');
      const activeHabitsList = habits
        .slice(0, 4)
        .map(h => `- ${h.title}`)
        .join('\n');

      const systemInstruction = `You are the "Life Reset Assistant". You are dedicated solely and exclusively to helping the user with their personal life reset:
- Organizing daily priorities and tasks
- Overcoming procrastination and task paralysis
- Breaking down daunting tasks into 2-minute actionable steps
- Establishing and maintaining habits
- Working through feelings of overwhelm and getting unstuck
- Planning the week and daily routines

STRICT BOUNDARY: You ONLY answer topics directly related to Life Reset (productivity, tasks, habits, daily routines, focus, overcoming overwhelm). If asked about unrelated subjects (e.g., general trivia, programming unrelated to routines, politics, gossip, homework, entertainment), politely decline and gently guide the user back to their Life Reset goals.

User's Context:
Pending Tasks:
${pendingTasksList || 'None recorded yet'}
Goals:
${activeGoalsList || 'None recorded yet'}
Habits:
${activeHabitsList || 'None recorded yet'}

Keep answers calm, concise, warm, and directly actionable. Avoid overwhelming the user with long text.`;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({
            role: m.role,
            text: m.text,
          })),
          model: 'gemini-3.5-flash',
          systemInstruction,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server responded with ${res.status}`);
      }

      const data = await res.json();
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: data.text || "I'm with you. What is the next smallest step you can take?",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, assistantMessage]);
      saveMessageToFirestore(assistantMessage);
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        text: `Something went wrong: ${err?.message || 'Please try again in a moment.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorMessage]);
      saveMessageToFirestore(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearHistory = async () => {
    const fresh: ChatMessage[] = [
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        text: `Conversation cleared. What would you like to work on for your life reset?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
    setMessages(fresh);
    const uid = user?.uid || 'guest';
    StorageService.saveUserChat(uid, fresh);

    if (user) {
      try {
        for (const m of messages) {
          await deleteDoc(doc(db, 'users', user.uid, 'chatMessages', m.id));
        }
      } catch (err) {
        console.warn('Failed to clear chat from Firestore:', err);
      }
    }
  };

  return (
    <div className="max-w-3xl mx-auto h-[calc(100vh-7rem)] flex flex-col pb-4">
      {/* Simple Clean Chatbox Container */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-xs flex-1 flex flex-col overflow-hidden">
        {/* Minimal Header */}
        <div className="px-5 py-3.5 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Life Reset Assistant
              </h2>
              <p className="text-[11px] text-neutral-500">
                Focused only on your daily priorities, habits, and momentum
              </p>
            </div>
          </div>

          <button
            onClick={handleClearHistory}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Clear Chat"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Message Thread */}
        <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-4">
          {messages.map(msg => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-xl ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold mt-0.5 ${
                    isUser
                      ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                      : 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 border border-emerald-600/20'
                  }`}
                >
                  {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                </div>

                <div className="space-y-1">
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                      isUser
                        ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 rounded-tr-none'
                        : 'bg-neutral-100/80 dark:bg-neutral-800/80 text-neutral-800 dark:text-neutral-200 rounded-tl-none whitespace-pre-wrap'
                    }`}
                  >
                    {msg.text}
                  </div>
                  <div
                    className={`text-[10px] text-neutral-400 px-1 ${
                      isUser ? 'text-right' : 'text-left'
                    }`}
                  >
                    {msg.timestamp}
                  </div>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-3 max-w-md mr-auto items-center">
              <div className="w-6 h-6 rounded-full bg-emerald-600/10 text-emerald-700 flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div className="bg-neutral-100 dark:bg-neutral-800 rounded-2xl rounded-tl-none px-4 py-2 text-xs text-neutral-500 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-pulse" />
                <div className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-pulse delay-150" />
                <div className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-pulse delay-300" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Minimal Chat Input */}
        <div className="p-3 border-t border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-end gap-2"
          >
            <textarea
              value={inputPrompt}
              onChange={e => setInputPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your life reset, tasks, or habits..."
              rows={2}
              disabled={isLoading}
              className="flex-1 px-3.5 py-2 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100 resize-none transition-colors"
            />
            <button
              type="submit"
              disabled={isLoading || !inputPrompt.trim()}
              className="p-2.5 bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-neutral-200 text-white dark:text-neutral-900 rounded-xl disabled:opacity-40 transition-colors shrink-0 shadow-xs"
              title="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
