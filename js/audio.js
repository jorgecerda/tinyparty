export class AudioAnalyser {
    constructor(fftSize = 256) {
        this.fftSize = fftSize;
        this.audioContext = null;
        this.analyser = null;
        this.dataArray = null;
        this.stream = null;
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) return true;

        console.log('secure context:', window.isSecureContext);
        console.log('navigator.mediaDevices:', !!navigator.mediaDevices);

        try {
            // Request standard microphone input natively
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                },
                video: false
            });
            
            const audioTracks = this.stream.getAudioTracks();
            console.log('Microphone audio tracks:', audioTracks.map(t => `${t.label} (readyState=${t.readyState}, enabled=${t.enabled})`));
            if (audioTracks.length === 0) {
                throw new Error('No audio tracks returned from microphone capture.');
            }

            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('AudioContext created. Initial state:', this.audioContext.state);

            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            const source = this.audioContext.createMediaStreamSource(this.stream);

            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.fftSize;
            this.analyser.smoothingTimeConstant = 0.72; 

            source.connect(this.analyser);

            const bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);

            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error('Failed to initialize Audio Analyser:', error.name, '-', error.message, '\nStack:', error.stack);
            throw error;
        }
    }

    getFrequencies() {
        if (!this.isInitialized || !this.analyser) {
            return new Uint8Array(this.fftSize / 2);
        }
        this.analyser.getByteFrequencyData(this.dataArray);
        return this.dataArray;
    }

    getTimeDomainData() {
        if (!this.isInitialized || !this.analyser) {
            return new Uint8Array(this.fftSize / 2);
        }
        this.analyser.getByteTimeDomainData(this.dataArray);
        return this.dataArray;
    }

    resume() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    close() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        if (this.audioContext) {
            if (this.audioContext.state !== 'closed') {
                this.audioContext.close();
            }
            this.audioContext = null;
        }
        this.analyser = null;
        this.dataArray = null;
        this.isInitialized = false;
    }
}
