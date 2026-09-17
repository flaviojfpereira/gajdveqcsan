import React, { useState, useRef, useEffect } from 'react';
import { X, Play, RotateCcw, Upload, Film, AlertCircle, CheckCircle2, Sparkles, Volume2, VolumeX } from 'lucide-react';

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VideoModal: React.FC<VideoModalProps> = ({ isOpen, onClose }) => {
  const [videoSrc, setVideoSrc] = useState<string>('/video.mp4');
  const [hasError, setHasError] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setHasError(false);
      // Attempt auto-play when opened
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.currentTime = 0;
          videoRef.current.play().catch(() => {
            // Autoplay with sound might be blocked by browser policy without user gesture
            if (videoRef.current) {
              videoRef.current.muted = true;
              setIsMuted(true);
              videoRef.current.play().catch(console.warn);
            }
          });
        }
      }, 200);
    } else {
      if (videoRef.current) {
        videoRef.current.pause();
      }
    }
  }, [isOpen, videoSrc]);

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleVideoError = () => {
    setHasError(true);
  };

  const handleVideoLoaded = () => {
    setHasError(false);
  };

  const handleReplay = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(console.warn);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Instant local preview
    const localUrl = URL.createObjectURL(file);
    setVideoSrc(localUrl);
    setHasError(false);
    setUploadSuccess('A carregar ficheiro...');
    setIsUploading(true);

    try {
      const res = await fetch('/api/video/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: file
      });
      if (res.ok) {
        setUploadSuccess('✅ Vídeo gravado com sucesso no servidor em /public/video.mp4!');
        setTimeout(() => setUploadSuccess(null), 4000);
      } else {
        setUploadSuccess('ℹ️ Vídeo carregado nesta sessão!');
        setTimeout(() => setUploadSuccess(null), 3500);
      }
    } catch {
      setUploadSuccess('ℹ️ Vídeo a tocar a partir do ficheiro local.');
      setTimeout(() => setUploadSuccess(null), 3500);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div
        className="relative w-full max-w-2xl bg-slate-900 border-2 border-amber-500/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Film className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-slate-100 uppercase tracking-wide font-gaming">
                  📼 Relíquia dos Meninos (10s)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase tracking-wider">
                  Easter Egg
                </span>
              </div>
              <p className="text-xs text-slate-400">Aquele clássico de rir que todos conhecem</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Fechar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Player Container */}
        <div className="relative w-full bg-black aspect-video flex items-center justify-center overflow-hidden">
          {!hasError ? (
            <video
              ref={videoRef}
              src={videoSrc}
              controls
              autoPlay
              playsInline
              loop
              onError={handleVideoError}
              onLoadedData={handleVideoLoaded}
              className="w-full h-full object-contain max-h-[60vh]"
            />
          ) : (
            <div className="p-6 text-center max-w-md flex flex-col items-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-200">Vídeo ainda não colocado</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                O reprodutor está configurado para ler o ficheiro em:{' '}
                <code className="text-amber-300 font-mono px-1.5 py-0.5 bg-slate-800 rounded">
                  /public/video.mp4
                </code>
              </p>
              <p className="text-xs text-slate-400">
                Podes colocar o teu ficheiro nessa pasta ou selecionar o ficheiro do teu computador agora:
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-black rounded-xl shadow-lg transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Escolher Vídeo Agora</span>
              </button>
            </div>
          )}

          {/* Quick replay overlay button */}
          {!hasError && (
            <div className="absolute bottom-16 right-4 flex items-center gap-2 z-20 pointer-events-auto">
              <button
                onClick={toggleMute}
                className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/80 shadow-md backdrop-blur-sm cursor-pointer transition-colors"
                title={isMuted ? 'Ligar Som' : 'Silenciar'}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-amber-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
              </button>
              <button
                onClick={handleReplay}
                className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/80 shadow-md backdrop-blur-sm cursor-pointer transition-colors"
                title="Repetir Vídeo"
              >
                <RotateCcw className="w-4 h-4 text-amber-400" />
              </button>
            </div>
          )}
        </div>

        {/* Upload feedback */}
        {uploadSuccess && (
          <div className="px-4 py-2 bg-emerald-950/80 border-t border-emerald-800 text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
            <span>{uploadSuccess}</span>
          </div>
        )}

        {/* Footer controls & upload info */}
        <div className="px-4 py-3 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileUpload}
            className="hidden"
          />

          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>
              Ficheiro: <code className="text-amber-300 font-mono">/public/video.mp4</code>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold transition-colors cursor-pointer border border-slate-700 text-xs"
              title="Carregar ou substituir o vídeo"
            >
              <Upload className="w-3.5 h-3.5 text-amber-400" />
              <span>Substituir Vídeo</span>
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black transition-colors cursor-pointer text-xs"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
