import { useState, useEffect, useCallback, useRef } from 'react';
import { VoiceRecognitionService } from '../agentos/voice';

export function useSpeechRecognition({ onResult, onError }) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);
  const [interimText, setInterimText] = useState('');
  
  const serviceRef = useRef(null);
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onResultRef.current = onResult;
    onErrorRef.current = onError;
  }, [onResult, onError]);

  useEffect(() => {
    const service = new VoiceRecognitionService({
      onResult: (text) => {
        if (onResultRef.current) onResultRef.current(text);
      },
      onError: (err) => {
        if (onErrorRef.current) onErrorRef.current(err);
      },
      onStateChange: ({ status, error }) => {
        if (status === 'unsupported') {
          setSupported(false);
        } else if (status === 'listening') {
          setListening(true);
          setError(null);
        } else if (status === 'error') {
          setListening(false);
          setError(error);
        } else if (status === 'idle') {
          setListening(false);
        }
      },
      onInterim: (text) => {
        setInterimText(text);
      }
    });

    serviceRef.current = service;

    return () => {
      service.cancel();
    };
  }, []);

  const start = useCallback(() => {
    if (serviceRef.current) serviceRef.current.start();
  }, []);

  const stop = useCallback(() => {
    if (serviceRef.current) serviceRef.current.stop();
  }, []);

  const cancel = useCallback(() => {
    if (serviceRef.current) serviceRef.current.cancel();
  }, []);

  return {
    supported,
    listening,
    error,
    interimText,
    start,
    stop,
    cancel
  };
}
