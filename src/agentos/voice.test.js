import { describe, expect, it, vi, beforeEach } from 'vitest';
import { VoiceRecognitionService } from './voice';

describe('VoiceRecognitionService', () => {
  let mockSpeechRecognition;

  beforeEach(() => {
    mockSpeechRecognition = class {
      constructor() {
        this.continuous = false;
        this.interimResults = false;
        this.lang = '';
      }
      start = vi.fn();
      stop = vi.fn();
      abort = vi.fn();
    };

    global.SpeechRecognition = mockSpeechRecognition;
    global.webkitSpeechRecognition = undefined;
  });

  it('detects when SpeechRecognition is supported', () => {
    const service = new VoiceRecognitionService();
    expect(service.supported).toBe(true);
  });

  it('detects when SpeechRecognition is unsupported', () => {
    global.SpeechRecognition = undefined;
    const service = new VoiceRecognitionService();
    expect(service.supported).toBe(false);
  });

  it('reflects listening state and starts microphone', () => {
    const onStateChange = vi.fn();
    const service = new VoiceRecognitionService({ onStateChange });
    service.start();
    expect(service.recognition.start).toHaveBeenCalled();
    
    service.recognition.onstart();
    expect(service.listening).toBe(true);
    expect(onStateChange).toHaveBeenCalledWith({ status: 'listening', error: null });
  });

  it('updates transcript when final result arrives', () => {
    const onResult = vi.fn();
    const service = new VoiceRecognitionService({ onResult });
    service.start();
    
    const mockEvent = {
      resultIndex: 0,
      results: [
        [{ transcript: 'plan a trip' }]
      ]
    };
    mockEvent.results[0].isFinal = true;

    service.recognition.onresult(mockEvent);
    expect(onResult).toHaveBeenCalledWith('plan a trip');
  });

  it('handles empty transcript', () => {
    const onResult = vi.fn();
    const service = new VoiceRecognitionService({ onResult });
    service.start();
    
    const mockEvent = {
      resultIndex: 0,
      results: [
        [{ transcript: '' }]
      ]
    };
    mockEvent.results[0].isFinal = true;

    service.recognition.onresult(mockEvent);
    expect(onResult).not.toHaveBeenCalled();
  });

  it('ends recognition correctly', () => {
    const onStateChange = vi.fn();
    const service = new VoiceRecognitionService({ onStateChange });
    service.start();
    
    service.recognition.onstart();
    expect(service.listening).toBe(true);
    
    service.recognition.onend();
    expect(service.listening).toBe(false);
    expect(onStateChange).toHaveBeenCalledWith({ status: 'idle', error: null });
  });

  it('handles permission and error states', () => {
    const onStateChange = vi.fn();
    const onError = vi.fn();
    const service = new VoiceRecognitionService({ onStateChange, onError });
    service.start();
    
    service.recognition.onerror({ error: 'not-allowed' });
    expect(service.listening).toBe(false);
    expect(onError).toHaveBeenCalledWith('not-allowed');
    expect(onStateChange).toHaveBeenCalledWith({ status: 'error', error: 'not-allowed' });
  });

  it('allows normal behavior after voice failure', () => {
    const onStateChange = vi.fn();
    const service = new VoiceRecognitionService({ onStateChange });
    service.start();
    
    service.recognition.onerror({ error: 'network' });
    expect(service.listening).toBe(false);
    expect(onStateChange).toHaveBeenCalledWith({ status: 'error', error: 'network' });
  });
});
