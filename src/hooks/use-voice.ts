// src/hooks/use-voice.ts
"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface UseVoiceProps {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onFinal?: (text: string) => void;
  onInterim?: (text: string) => void;
}

export const useVoice = ({
  lang = "en-US",
  continuous = true,
  interimResults = true,
  onFinal,
  onInterim,
}: UseVoiceProps) => {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  
  // Use a ref to store the recognition instance
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check browser support
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      setIsSupported(true);
      const recognition = new SpeechRecognition();
      recognition.lang = lang;
      recognition.continuous = continuous;
      recognition.interimResults = interimResults;

      recognition.onresult = (event: any) => {
        let finalTranscript = "";
        let currentInterim = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            currentInterim += event.results[i][0].transcript;
          }
        }

        setInterimTranscript(currentInterim);
        
        if (onInterim) onInterim(currentInterim);
        
        if (finalTranscript && onFinal) {
          onFinal(finalTranscript.trim());
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        // If we want it to be truly continuous, we might restart here, 
        // but usually for UI control we just set state to false.
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, [lang, continuous, interimResults, onFinal, onInterim]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error("Error starting speech recognition:", e);
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
        setIsListening(false);
      } catch (e) {
        console.error("Error stopping speech recognition:", e);
      }
    }
  }, [isListening]);

  const resetTranscript = useCallback(() => {
    setInterimTranscript("");
  }, []);

  return {
    isSupported,
    isListening,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
  };
};