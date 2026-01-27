## Packages
framer-motion | Smooth animations for the audio visualizer and page transitions
clsx | Utility for constructing className strings conditionally
tailwind-merge | Utility for merging Tailwind CSS classes without conflicts

## Notes
The TTS endpoint /api/tts returns a binary audio file. The frontend must handle this as a Blob and create an object URL for playback.
The app relies on auto-playing audio, so user interaction (click start) is required before the first audio context can be unlocked.
