import React, { useState, useRef } from 'react';
import { X, Upload, Music, Play, Pause, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

interface AudioUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAudioUpdated: (newUrl: string, songName?: string) => void;
}

export const AudioUploadModal: React.FC<AudioUploadModalProps> = ({
  isOpen,
  onClose,
  onAudioUpdated
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileChosen = (selectedFile: File) => {
    if (!selectedFile) return;

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
    setIsPreviewPlaying(false);

    setFile(selectedFile);
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    setStatusMessage(null);
  };

  const togglePreview = () => {
    if (!previewUrl) return;
    if (!previewAudioRef.current) {
      previewAudioRef.current = new Audio(previewUrl);
      previewAudioRef.current.onended = () => setIsPreviewPlaying(false);
    } else if (previewAudioRef.current.src !== previewUrl) {
      previewAudioRef.current.src = previewUrl;
    }

    if (isPreviewPlaying) {
      previewAudioRef.current.pause();
      setIsPreviewPlaying(false);
    } else {
      previewAudioRef.current.play().then(() => {
        setIsPreviewPlaying(true);
      }).catch(err => {
        console.error('Preview error:', err);
        setStatusMessage({ type: 'error', text: 'Não foi possível reproduzir o ficheiro no browser. Verifica se é um MP3 válido.' });
      });
    }
  };

  const handleUploadToServer = async () => {
    if (!file) return;

    setIsUploading(true);
    setStatusMessage(null);

    try {
      // 1. Send binary raw stream
      const res = await fetch('/api/audio/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: file
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage({ type: 'success', text: 'Música carregada e guardada no servidor com sucesso!' });
        
        // Notify parent audio player with cache-busting timestamp
        const trackUrl = `/api/audio/track?t=${data.mtime || Date.now()}`;
        onAudioUpdated(trackUrl, file.name.replace(/\.[^/.]+$/, ''));

        setTimeout(() => {
          if (previewAudioRef.current) {
            previewAudioRef.current.pause();
          }
          onClose();
        }, 1500);
      } else {
        throw new Error(data.error || 'Falha no envio');
      }
    } catch (err: any) {
      console.error('Audio upload error:', err);
      // Fallback: try base64 JSON
      try {
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = (reader.result as string).split(',')[1];
          const jsonRes = await fetch('/api/audio/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64, fileName: file.name })
          });
          const jsonData = await jsonRes.json();
          if (jsonRes.ok && jsonData.success) {
            setStatusMessage({ type: 'success', text: 'Música carregada com sucesso!' });
            const trackUrl = `/api/audio/track?t=${jsonData.mtime || Date.now()}`;
            onAudioUpdated(trackUrl, file.name.replace(/\.[^/.]+$/, ''));
            setTimeout(() => {
              if (previewAudioRef.current) {
                previewAudioRef.current.pause();
              }
              onClose();
            }, 1500);
          } else {
            setStatusMessage({ type: 'error', text: 'Erro ao guardar ficheiro no servidor.' });
          }
        };
        reader.readAsDataURL(file);
      } catch (e) {
        setStatusMessage({ type: 'error', text: 'Erro ao enviar ficheiro. Tenta novamente.' });
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
    setIsPreviewPlaying(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border-4 border-amber-500 rounded-3xl shadow-2xl p-6 cartoon-card-gold text-slate-100">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-amber-400">
            <Music className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black font-gaming tracking-wide uppercase text-amber-400">
              Carregar Música do GAJDVEQCSAN
            </h2>
            <p className="text-xs text-slate-300">
              Coloca o teu ficheiro MP3 para tocar em loop no site
            </p>
          </div>
        </div>

        {/* Drag & Drop Area */}
        <div
          onDragOver={e => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={e => {
            e.preventDefault();
            setIsDragging(false);
            const droppedFile = e.dataTransfer.files?.[0];
            if (droppedFile) handleFileChosen(droppedFile);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-amber-400 bg-amber-500/10 scale-[1.01]'
              : 'border-slate-700 hover:border-amber-400/80 bg-slate-950/50 hover:bg-slate-950/80'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) handleFileChosen(f);
            }}
            accept="audio/*,.mp3,.wav,.ogg,.m4a"
            className="hidden"
          />

          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-800 flex items-center justify-center text-amber-400 border border-slate-700">
            <Upload className="w-6 h-6" />
          </div>

          <p className="text-sm font-bold text-slate-200">
            {file ? file.name : 'Arrasta o teu ficheiro MP3 para aqui'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {file
              ? `${(file.size / (1024 * 1024)).toFixed(2)} MB • Clica para escolher outro`
              : 'ou clica para procurar no teu dispositivo (.mp3, .wav, .m4a)'}
          </p>
        </div>

        {/* Preview and Controls if file selected */}
        {file && (
          <div className="mt-4 p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <button
                type="button"
                onClick={togglePreview}
                className="w-9 h-9 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center transition-colors cursor-pointer shrink-0 font-bold"
                title={isPreviewPlaying ? 'Pausar pré-visualização' : 'Ouvir pré-visualização'}
              >
                {isPreviewPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-200 truncate">{file.name}</p>
                <p className="text-[10px] text-amber-400 font-medium">
                  {isPreviewPlaying ? 'A reproduzir...' : 'Clica no play para testar'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleUploadToServer}
              disabled={isUploading}
              className="cartoon-btn px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wide rounded-xl cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shrink-0 font-gaming"
            >
              {isUploading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>A enviar...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Guardar</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Status Feedback Message */}
        {statusMessage && (
          <div
            className={`mt-4 p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/60 border border-emerald-700 text-emerald-300'
                : 'bg-rose-950/60 border border-rose-700 text-rose-300'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Manual upload note */}
        <div className="mt-5 pt-4 border-t border-slate-800 text-[11px] text-slate-400 leading-relaxed">
          <span className="font-bold text-slate-300">Nota:</span> Podes também arrastar o teu ficheiro diretamente no explorador de ficheiros do AI Studio para <code className="text-amber-300 bg-slate-950 px-1 py-0.5 rounded font-mono">public/audio/ninjas.mp3</code>.
        </div>
      </div>
    </div>
  );
};
