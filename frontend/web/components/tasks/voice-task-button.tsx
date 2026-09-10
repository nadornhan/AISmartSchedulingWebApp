'use client';

import { useEffect, useRef, useState } from 'react';

type Recognition = {
  lang: string;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

export function VoiceTaskButton({ disabled, onTranscript }: {
  disabled: boolean;
  onTranscript: (text: string) => void;
}) {
  const recognition = useRef<Recognition | null>(null);
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => () => {
    if (recognition.current) {
      recognition.current.onresult = null;
      recognition.current.onstart = null;
      recognition.current.onerror = null;
      recognition.current.onend = null;
      recognition.current.abort();
    }
  }, []);

  function toggle() {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    if (recognition.current) return;
    if (!window.isSecureContext) {
      setMessage('Microphone access requires HTTPS or localhost. Open this app using a secure address.');
      return;
    }
    const speechWindow = window as unknown as {
      SpeechRecognition?: new () => Recognition;
      webkitSpeechRecognition?: new () => Recognition;
    };
    const Constructor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Constructor) {
      setMessage('Voice input is unavailable in this browser. Please type your task.');
      return;
    }
    const session = new Constructor();
    recognition.current = session;
    session.lang = document.documentElement.lang || 'en-US';
    session.interimResults = false;
    let received = false;
    let failed = false;
    session.onstart = () => {
      setListening(true);
      setMessage('Listening… Speak your task, then stop to review the transcript.');
    };
    session.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0].transcript).join(' ').trim();
      if (transcript) {
        received = true;
        onTranscript(transcript);
        setMessage('Transcript added below. Review or edit it before creating your task.');
      }
    };
    session.onerror = (event) => {
      failed = true;
      setListening(false);
      const errors: Record<string, string> = {
        'not-allowed': 'Microphone access blocked. Allow microphone access in the browser and Windows privacy settings.',
        'service-not-allowed': 'This browser blocked its speech recognition service. Try opening the app in a standalone browser with speech recognition enabled.',
        'audio-capture': 'Cannot access a microphone. Check your input device and Windows microphone settings.',
        'network': 'Cannot connect to the browser’s speech recognition service. Check your connection or VPN/proxy. If using an embedded browser, try a standalone browser.',
        'no-speech': 'No speech detected. Please try again and check your microphone input level.',
        'aborted': 'Voice input was interrupted. Please try again.',
        'language-not-supported': 'The speech recognition service does not support the selected language.',
      };
      setMessage(`${errors[event.error] ?? 'Voice recognition could not start. Please try another browser or type your task.'} (${event.error})`);
    };
    session.onend = () => {
      setListening(false);
      recognition.current = null;
      if (!received && !failed) setMessage('No transcript captured. Please try again or type your task.');
    };
    try {
      setMessage('Starting microphone… Please wait for Listening before speaking.');
      session.start();
    } catch (error) {
      failed = true;
      recognition.current = null;
      setListening(false);
      setMessage(`Could not start voice input. Please check microphone access and try again. (${error instanceof Error ? error.name : 'unknown'})`);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label={listening ? 'Stop voice input' : 'Start voice input'}
        title={listening ? 'Stop voice input' : 'Start voice input'}
        aria-pressed={listening}
        disabled={disabled}
        onClick={toggle}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-dashboard-accent/30 bg-dashboard-accent/10 text-dashboard-accent transition duration-200 hover:border-dashboard-accent/70 hover:bg-dashboard-accent/20 hover:shadow-[0_0_18px_rgba(36,211,138,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-surface-raised)] aria-pressed:border-red-400/50 aria-pressed:bg-red-400/10 aria-pressed:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8" />
        </svg>
      </button>
      {message ? (
        <div role="status" className="col-span-3 flex min-w-0 items-start gap-2.5 rounded-xl border border-red-400/20 bg-red-400/5 px-3 py-2.5 text-xs font-normal leading-5 text-red-400 [contain:inline-size]">
          <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
          <p className="min-w-0 break-words">{message}</p>
        </div>
      ) : null}
    </>
  );
}
