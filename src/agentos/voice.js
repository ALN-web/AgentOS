export class VoiceRecognitionService {
  constructor(options = {}) {
    this.onResult = options.onResult || (() => {});
    this.onError = options.onError || (() => {});
    this.onStateChange = options.onStateChange || (() => {});
    this.onInterim = options.onInterim || (() => {});

    this.supported = false;
    this.listening = false;
    this.recognition = null;

    this.init();
  }

  init() {
    const _window = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {});
    const SpeechRecognition = _window.SpeechRecognition || _window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      this.supported = false;
      this.updateState('unsupported');
      return;
    }

    this.supported = true;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      this.listening = true;
      this.updateState('listening');
      this.onInterim('');
    };

    this.recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      this.onInterim(interimTranscript);

      if (finalTranscript) {
        this.onResult(finalTranscript);
      }
    };

    this.recognition.onerror = (event) => {
      this.listening = false;
      this.updateState('error', event.error);
      this.onError(event.error);
    };

    this.recognition.onend = () => {
      this.listening = false;
      this.updateState('idle');
      this.onInterim('');
    };
  }

  updateState(status, error = null) {
    this.onStateChange({ status, error });
  }

  start() {
    if (this.supported && !this.listening && this.recognition) {
      try {
        this.recognition.start();
      } catch (e) {
        // ignore already started
      }
    }
  }

  stop() {
    if (this.supported && this.listening && this.recognition) {
      this.recognition.stop();
    }
  }

  cancel() {
    if (this.supported && this.listening && this.recognition) {
      this.recognition.abort();
    }
  }
}
