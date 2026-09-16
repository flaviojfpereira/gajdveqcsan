import React, { useState } from 'react';
import { MessageSquare, Send, Sparkles, User as UserIcon } from 'lucide-react';
import type { Comment, User } from '../types.js';

interface ShoutboxProps {
  comments: Comment[];
  currentUser: User | null;
  onAddComment: (text: string) => Promise<boolean>;
  onOpenLogin: () => void;
}

export const Shoutbox: React.FC<ShoutboxProps> = ({
  comments,
  currentUser,
  onAddComment,
  onOpenLogin
}) => {
  const [inputText, setInputText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    if (!currentUser) {
      onOpenLogin();
      return;
    }

    setIsSubmitting(true);
    const ok = await onAddComment(inputText.trim());
    setIsSubmitting(false);
    if (ok) {
      setInputText('');
    }
  };

  const formatTimestamp = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      return date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <section className="bg-slate-900/90 rounded-2xl border-2 border-slate-800 p-4 sm:p-5 cartoon-card">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-400">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-black font-gaming tracking-wide uppercase text-white">
              Mural da Malta • Recordações
            </h3>
            <p className="text-[11px] text-slate-400">
              Deixa um recado, piada ou aviso para a malta do GAJDVEQCSAN
            </p>
          </div>
        </div>

        <span className="text-xs font-bold text-amber-400/90 flex items-center gap-1 font-gaming">
          <Sparkles className="w-3.5 h-3.5" />
          {comments.length} recados
        </span>
      </div>

      {/* Message input */}
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder={
              currentUser
                ? `Deixa um recado como ${currentUser.name}...`
                : 'Identifica-te para deixar um recado...'
            }
            maxLength={180}
            className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
          />
          <button
            type="submit"
            disabled={isSubmitting || !inputText.trim()}
            className="cartoon-btn px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 font-gaming"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Enviar</span>
          </button>
        </div>
      </form>

      {/* Comments feed */}
      <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
        {comments.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-2 text-center">
            Ainda não há recados. Sê o primeiro a escrever!
          </p>
        ) : (
          comments.map(c => (
            <div
              key={c.id}
              className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs flex items-start gap-2.5"
            >
              <div className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                {c.userName.charAt(0).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2 mb-0.5">
                  <span className="font-bold text-slate-200 truncate">{c.userName}</span>
                  <span className="text-[10px] text-slate-500 shrink-0">
                    {formatTimestamp(c.createdAt)}
                  </span>
                </div>
                <p className="text-slate-300 break-words leading-relaxed text-[11px] sm:text-xs">
                  {c.text}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
};
