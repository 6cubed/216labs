import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateSession } from "@/hooks/use-radio";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/Button";
import { motion } from "framer-motion";
import { Headphones, Radio, Sparkles } from "lucide-react";

export default function Landing() {
  const [seed, setSeed] = useState("");
  const [, setLocation] = useLocation();
  const createSession = useCreateSession();

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seed.trim()) return;

    try {
      const session = await createSession.mutateAsync({ seedInterests: seed });
      setLocation(`/radio/${session.id}`);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Layout>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center space-y-8"
          >
            <div className="inline-flex items-center justify-center p-4 bg-primary/5 rounded-full ring-1 ring-primary/20 mb-4">
              <Headphones className="w-8 h-8 text-primary" />
            </div>

            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              Your Personal <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-300 text-glow">
                Rabbit Hole Radio
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-lg mx-auto leading-relaxed">
              An endless, adaptive audio stream curated by AI. Just listen, react, and drift deeper into what interests you.
            </p>

            <form onSubmit={handleStart} className="max-w-md mx-auto space-y-4">
              <div className="space-y-2">
                <label htmlFor="seed" className="text-sm font-mono text-muted-foreground uppercase tracking-wider">
                  Initialize Feed
                </label>
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-emerald-500/20 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                  <input
                    id="seed"
                    type="text"
                    value={seed}
                    onChange={(e) => setSeed(e.target.value)}
                    placeholder="e.g. quantum physics, ancient history, weird biology..."
                    className="relative w-full bg-card border border-input rounded-xl px-6 py-4 text-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-muted-foreground/50 shadow-xl"
                    autoFocus
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30 pointer-events-none">
                    <Sparkles className="w-5 h-5" />
                  </div>
                </div>
              </div>

              <Button 
                type="submit" 
                size="lg" 
                className="w-full text-lg h-14 rounded-xl font-bold"
                disabled={createSession.isPending || !seed.trim()}
              >
                {createSession.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Tuning In...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Start Broadcast <Radio className="w-5 h-5" />
                  </span>
                )}
              </Button>
            </form>

            <div className="pt-8 grid grid-cols-3 gap-4 text-xs font-mono text-muted-foreground opacity-60">
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-1 bg-primary/20 rounded-full" />
                <span>AI Generated</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-1 bg-primary/20 rounded-full" />
                <span>Adaptive</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-1 bg-primary/20 rounded-full" />
                <span>Infinite</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
}
