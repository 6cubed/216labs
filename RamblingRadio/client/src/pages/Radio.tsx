import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "wouter";
import { useFeedback, useNextContent, useTTS } from "@/hooks/use-radio";
import { Layout } from "@/components/Layout";
import { AudioVisualizer } from "@/components/AudioVisualizer";
import { Button } from "@/components/Button";
import { ThumbsDown, ThumbsUp, Play, Square, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type PlaybackState = 'idle' | 'loading_text' | 'loading_audio' | 'playing' | 'paused' | 'error';

export default function RadioPage() {
  const { id } = useParams();
  const sessionId = parseInt(id || "0");
  
  // State
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const [currentText, setCurrentText] = useState<string>("");
  const [currentLogId, setCurrentLogId] = useState<number | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  
  // Audio Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  // Hooks
  const fetchContent = useNextContent();
  const fetchTTS = useTTS();
  const sendFeedback = useFeedback();

  // Initialize audio element once
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.onended = () => {
      playNextFromBuffer();
    };
    return () => {
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  const [buffer, setBuffer] = useState<{ logId: number; content: string; audioUrl: string }[]>([]);
  const bufferRef = useRef<{ logId: number; content: string; audioUrl: string }[]>([]);
  const isFetchingRef = useRef(false);

  const BUFFER_TARGET = 10;
  const PREFETCH_THRESHOLD = 5;

  const fillBuffer = useCallback(async () => {
    if (isFetchingRef.current || bufferRef.current.length >= BUFFER_TARGET) return;
    
    isFetchingRef.current = true;
    try {
      // Request more sentences at once for efficiency
      const response = (await fetchContent.mutateAsync(sessionId)) as { sentences: { logId: number; content: string }[] };
      const sentences = response.sentences;
      
      // Concurrently fetch TTS for all new sentences
      const audioPromises = sentences.map(async (item) => {
        const audioBlob = await fetchTTS.mutateAsync(item.content);
        return { ...item, audioUrl: URL.createObjectURL(audioBlob) };
      });

      const newBufferedItems = await Promise.all(audioPromises);
      setBuffer(prev => [...prev, ...newBufferedItems]);
    } catch (err) {
      console.error("Buffer fill error:", err);
    } finally {
      isFetchingRef.current = false;
    }
  }, [sessionId, fetchContent, fetchTTS]);

  // Sync bufferRef with buffer state for use in callbacks
  useEffect(() => {
    bufferRef.current = buffer;
    if (buffer.length < PREFETCH_THRESHOLD && playbackState === 'playing') {
      fillBuffer();
    }
  }, [buffer, playbackState, fillBuffer]);

  // Call handleStart on component mount
  useEffect(() => {
    handleStart();
  }, []); // Empty dependency array ensures it runs once on mount

  // Core Loop: Play from buffer and refill
  const playNextFromBuffer = useCallback(async () => {
    if (playbackState === 'paused' || playbackState === 'idle') return;

    if (bufferRef.current.length === 0) {
      setPlaybackState('loading_text');
      await fillBuffer();
      // Retry after a short delay if still empty
      setTimeout(playNextFromBuffer, 500);
      return;
    }

    const nextItem = bufferRef.current[0];
    setBuffer(prev => prev.slice(1));
    
    setCurrentText(nextItem.content);
    setCurrentLogId(nextItem.logId);
    setHistory(prev => [...prev, nextItem.content]);

    if (audioRef.current) {
      audioRef.current.src = nextItem.audioUrl;
      await audioRef.current.play();
      setPlaybackState('playing');
    }

    // Refill buffer in background
    fillBuffer();
  }, [playbackState, fillBuffer]);

  // Initialize audio element once
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.onended = () => {
      playNextFromBuffer();
    };
    return () => {
      bufferRef.current.forEach(item => URL.revokeObjectURL(item.audioUrl));
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, [playNextFromBuffer]);

  // Handlers
  const handleStart = () => {
    setPlaybackState('playing');
    playNextFromBuffer();
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setPlaybackState('paused');
  };

  const handleResume = () => {
    setPlaybackState('playing');
    if (audioRef.current && audioRef.current.src) {
      audioRef.current.play();
    } else {
      playNextFromBuffer();
    }
  };

  const handleFeedback = async (type: 'up' | 'down') => {
    if (!currentLogId) return;

    sendFeedback.mutate({ 
      sessionId, 
      logId: currentLogId, 
      feedback: type 
    });

    if (type === 'down') {
      if (audioRef.current) audioRef.current.pause();
      // Flush buffer on dislike to course correct immediately
      bufferRef.current.forEach(item => URL.revokeObjectURL(item.audioUrl));
      setBuffer([]);
      playNextFromBuffer();
    }
  };

  // derived visual state
  const isPlaying = playbackState === 'playing';
  const isLoading = playbackState === 'loading_text' || playbackState === 'loading_audio';

  return (
    <Layout>
      <div className="flex-1 flex flex-col h-[calc(100vh-64px)] overflow-hidden relative">
        
        {/* Decorative background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[100px]" />
          <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-blue-500/5 rounded-full blur-[100px]" />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 z-10">
          
          {/* Status Indicator */}
          <div className="mb-8 font-mono text-xs tracking-widest text-muted-foreground uppercase flex items-center gap-2">
            {isLoading ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-primary" />
                <span>Buffering Signal...</span>
              </>
            ) : isPlaying ? (
              <>
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span>On Air</span>
              </>
            ) : (
              <span>Standby</span>
            )}
          </div>

          {/* Teleprompter / Text Display */}
          <div className="w-full max-w-4xl text-center space-y-6 relative min-h-[200px] flex items-center justify-center">
            <AnimatePresence mode="wait">
              {currentText ? (
                <motion.p
                  key={currentLogId} // Force re-render animation on new ID
                  initial={{ opacity: 0, filter: "blur(10px)", y: 10 }}
                  animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                  exit={{ opacity: 0, filter: "blur(10px)", y: -10 }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="text-2xl md:text-4xl lg:text-5xl font-medium leading-relaxed md:leading-tight"
                >
                  "{currentText}"
                </motion.p>
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }}
                  className="text-muted-foreground/50 text-xl font-mono"
                >
                  Waiting for transmission...
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Visualizer */}
          <div className="mt-12 mb-8">
            <AudioVisualizer isPlaying={isPlaying} />
          </div>
        </div>

        {/* Controls Bar */}
        <div className="bg-card/80 backdrop-blur-xl border-t border-border/50 p-6 z-20">
          <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            
            {/* Play/Stop Controls */}
            <div className="flex items-center gap-4">
              {playbackState === 'idle' || playbackState === 'paused' ? (
                <Button 
                  onClick={playbackState === 'idle' ? handleStart : handleResume}
                  size="icon" 
                  className="rounded-full w-16 h-16 shadow-2xl shadow-primary/20"
                >
                  <Play className="w-6 h-6 ml-1" fill="currentColor" />
                </Button>
              ) : (
                <Button 
                  onClick={handleStop}
                  variant="secondary"
                  size="icon" 
                  className="rounded-full w-16 h-16 border-2 border-primary/20"
                >
                  <Square className="w-6 h-6 fill-current" />
                </Button>
              )}
              
              <div className="hidden md:block">
                <div className="text-sm font-bold">Rabbit Hole Radio</div>
                <div className="text-xs text-muted-foreground font-mono">
                   {playbackState === 'idle' ? 'Ready to broadcast' : `Segment #${history.length}`}
                </div>
              </div>
            </div>

            {/* Feedback Controls */}
            <div className="flex items-center gap-4">
               <div className="text-xs font-mono text-muted-foreground hidden md:block mr-2 uppercase tracking-wider">
                 Tune Signal
               </div>
               
               <Button
                 variant="outline"
                 size="lg"
                 className="rounded-full border-2 hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-500 gap-2 transition-all duration-300"
                 onClick={() => handleFeedback('down')}
                 disabled={!isPlaying && !isLoading}
               >
                 <ThumbsDown className="w-5 h-5" />
                 <span className="sr-only md:not-sr-only">Change Topic</span>
               </Button>

               <Button
                 variant="outline"
                 size="lg"
                 className="rounded-full border-2 hover:border-primary/50 hover:bg-primary/10 hover:text-primary gap-2 transition-all duration-300"
                 onClick={() => handleFeedback('up')}
                 disabled={!isPlaying && !isLoading}
               >
                 <ThumbsUp className="w-5 h-5" />
                 <span className="sr-only md:not-sr-only">Dive Deeper</span>
               </Button>
            </div>

          </div>
        </div>

      </div>
    </Layout>
  );
}
