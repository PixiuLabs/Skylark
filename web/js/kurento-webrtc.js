/**
 * Kurento WebRTC Client
 * Kurento WebRTC 客户端
 *
 * <p>Implements WebRTC 1v1 real-time voice communication using native WebRTC API.</p>
 *
 * @author Skylark Team
 * @version 2.2.0
 */
class KurentoWebRTCClient {
    constructor() {
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.sessionId = null;
        this.apiBaseUrl = this.getApiBaseUrl();
        this.statusCallback = null;
        this.messageCallback = null;
        this.connectionStateCallback = null;
    }
    
    /**
     * Gets the API base URL dynamically based on current location
     */
    getApiBaseUrl() {
        const protocol = window.location.protocol;
        const host = window.location.host || 'localhost:8080';
        return `${protocol}//${host}/api/webrtc/kurento`;
    }
    
    /**
     * Sets status update callback
     */
    setStatusCallback(callback) {
        this.statusCallback = callback;
    }
    
    /**
     * Sets message callback for received data
     */
    setMessageCallback(callback) {
        this.messageCallback = callback;
    }
    
    /**
     * Sets connection state change callback
     */
    setConnectionStateCallback(callback) {
        this.connectionStateCallback = callback;
    }
    
    /**
     * Updates status and calls callback if set
     */
    updateStatus(state, text) {
        console.log('[KurentoWebRTC] Status:', state, '-', text);
        if (this.statusCallback) {
            this.statusCallback(state, text);
        }
    }
    
    /**
     * Sends message through callback if set
     */
    sendMessage(type, data) {
        if (this.messageCallback) {
            this.messageCallback(type, data);
        }
    }
    
    /**
     * Starts a new WebRTC session with Kurento
     */
    async start() {
        try {
            this.updateStatus('connecting', '正在创建 Kurento 会话...');
            
            // 1. Create session on server
            const sessionResponse = await fetch(`${this.apiBaseUrl}/session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: 'user-' + Date.now() })
            });
            
            if (!sessionResponse.ok) {
                throw new Error(`Failed to create session: ${sessionResponse.status}`);
            }
            
            const session = await sessionResponse.json();
            this.sessionId = session.sessionId;
            
            console.log('[KurentoWebRTC] Session created:', this.sessionId);
            this.updateStatus('connecting', '正在获取麦克风...');
            
            // 2. Get user media (audio only)
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                },
                video: false
            });
            
            // Play local audio muted
            const localAudio = document.getElementById('localAudio');
            if (localAudio) {
                localAudio.srcObject = this.localStream;
            }
            
            this.updateStatus('connecting', '正在创建 PeerConnection...');
            
            // 3. Create PeerConnection
            await this.createPeerConnection();
            
            this.updateStatus('connected', 'Kurento WebRTC 通话已建立');
            this.sendMessage('success', 'Kurento WebRTC 连接成功！');
            
        } catch (error) {
            console.error('[KurentoWebRTC] Failed to start session:', error);
            this.updateStatus('error', '启动失败: ' + error.message);
            this.cleanup();
            throw error;
        }
    }
    
    /**
     * Creates PeerConnection using native WebRTC
     */
    async createPeerConnection() {
        const self = this;
        
        // Create PeerConnection with minimal configuration
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }
            ]
        };
        
        this.peerConnection = new RTCPeerConnection(configuration);
        
        // Add local stream
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                self.peerConnection.addTrack(track, self.localStream);
            });
        }
        
        // Set up ICE candidate handler
        this.peerConnection.onicecandidate = async event => {
            if (event.candidate) {
                console.log('[KurentoWebRTC] ICE candidate found:', event.candidate);
                await self.sendIceCandidate(event.candidate);
            }
        };
        
        // Set up track handler
        this.peerConnection.ontrack = event => {
            console.log('[KurentoWebRTC] Remote track received:', event.track);
            if (event.streams && event.streams[0]) {
                self.remoteStream = event.streams[0];
                const remoteAudio = document.getElementById('remoteAudio');
                if (remoteAudio) {
                    remoteAudio.srcObject = self.remoteStream;
                }
                self.sendMessage('system', '收到远端音频流');
            }
        };
        
        // Set up ICE connection state handler
        this.peerConnection.oniceconnectionstatechange = () => {
            const state = self.peerConnection.iceConnectionState;
            console.log('[KurentoWebRTC] ICE connection state:', state);
            if (this.connectionStateCallback) {
                this.connectionStateCallback(state);
            }
        };
        
        // Set up signaling state change
        this.peerConnection.onsignalingstatechange = () => {
            console.log('[KurentoWebRTC] Signaling state:', self.peerConnection.signalingState);
        };
        
        // Create and send offer
        await this.createAndSendOffer();
    }
    
    /**
     * Creates SDP offer and sends to server
     */
    async createAndSendOffer() {
        try {
            console.log('[KurentoWebRTC] Creating SDP offer...');
            
            // Create audio-only offer
            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: false
            });
            
            console.log('[KurentoWebRTC] Original offer SDP:');
            console.log(offer.sdp);
            console.log('[KurentoWebRTC] Offer SDP length:', offer.sdp.length);
            
            // Ensure offer is audio-only by removing any video m-lines
            let audioOnlySdp = offer.sdp;
            const offerMlines = offer.sdp.split('\r\n').filter(line => line.startsWith('m='));
            console.log('[KurentoWebRTC] Offer m-lines:', offerMlines);

            if (offerMlines.length > 1 || offerMlines.some(m => m.startsWith('m=video'))) {
                console.log('[KurentoWebRTC] Removing video m-lines from offer...');
                audioOnlySdp = this.extractAudioOnlySdp(offer.sdp);
                console.log('[KurentoWebRTC] Audio-only SDP:');
                console.log(audioOnlySdp);
            }

            audioOnlySdp = this.stripBundleForKurento(audioOnlySdp);
            console.log('[KurentoWebRTC] Stripped BUNDLE for Kurento compatibility:');
            console.log(audioOnlySdp);

            audioOnlySdp = this.simplifyCodecsForKurento(audioOnlySdp);
            console.log('[KurentoWebRTC] Simplified codecs for Kurento compatibility:');
            console.log(audioOnlySdp);
            
            // Create new offer with audio-only SDP
            const audioOnlyOffer = new RTCSessionDescription({
                type: 'offer',
                sdp: audioOnlySdp
            });
            
            // Set local description first
            await this.peerConnection.setLocalDescription(audioOnlyOffer);
            
            console.log('[KurentoWebRTC] Local description set');
            console.log('[KurentoWebRTC] Sending SDP offer to server...');
            
            // Send offer to server
            const response = await fetch(
                `${this.apiBaseUrl}/session/${this.sessionId}/offer`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sdpOffer: audioOnlySdp })
                }
            );
            
            if (!response.ok) {
                throw new Error(`Failed to process offer: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('[KurentoWebRTC] Received SDP answer from server');
            console.log('[KurentoWebRTC] Answer SDP length:', data.sdpAnswer.length);
            console.log('[KurentoWebRTC] Answer SDP:');
            console.log(data.sdpAnswer);

            let answerSdp = this.normalizeSdp(data.sdpAnswer);
            answerSdp = this.adjustAnswerMid(audioOnlySdp, answerSdp);

            console.log('[KurentoWebRTC] Adjusted Answer SDP:');
            console.log(answerSdp);

            const portMatch = answerSdp.match(/^m=audio (\d+)/m);
            if (portMatch && portMatch[1] === '0') {
                throw new Error('Kurento server rejected the audio stream (m=audio 0). '
                    + 'Please check if the Kurento media pipeline is properly configured.');
            }

            const remoteDesc = new RTCSessionDescription({
                type: 'answer',
                sdp: answerSdp
            });

            console.log('[KurentoWebRTC] Setting remote description...');
            await this.peerConnection.setRemoteDescription(remoteDesc);
            console.log('[KurentoWebRTC] SDP answer processed successfully');
            
        } catch (error) {
            console.error('[KurentoWebRTC] Error in createAndSendOffer:', error);
            throw error;
        }
    }
    
    /**
     * Extract audio-only SDP from full SDP
     */
    extractAudioOnlySdp(sdp) {
        const lines = sdp.split('\r\n');
        const result = [];
        let inVideoSection = false;
        let inAudioSection = false;
        
        for (const line of lines) {
            if (line.startsWith('m=video')) {
                inVideoSection = true;
                inAudioSection = false;
                continue; // Skip video m-line
            } else if (line.startsWith('m=audio')) {
                inVideoSection = false;
                inAudioSection = true;
                result.push(line);
            } else if (line.startsWith('m=')) {
                // Other media types
                inVideoSection = false;
                inAudioSection = false;
                continue;
            } else if (inVideoSection) {
                // Skip video section attributes
                continue;
            } else {
                // Keep session-level and audio section attributes
                result.push(line);
            }
        }
        
        return this.normalizeSdp(result.join('\r\n'));
    }
    
    /**
     * Adjust answer SDP mid attribute to match offer
     */
    adjustAnswerMid(offerSdp, answerSdp) {
        console.log('[KurentoWebRTC] Adjusting answer mid to match offer...');

        const offerLines = offerSdp.split('\r\n');
        let offerMid = null;
        for (const line of offerLines) {
            if (line.startsWith('a=mid:')) {
                offerMid = line.substring(6);
                break;
            }
        }

        console.log('[KurentoWebRTC] Offer mid:', offerMid);

        if (!offerMid) {
            console.warn('[KurentoWebRTC] No mid found in offer, returning original answer');
            return answerSdp;
        }

        const answerLines = answerSdp.split('\r\n');
        const adjustedLines = answerLines.map(line => {
            if (line.startsWith('a=mid:')) {
                console.log('[KurentoWebRTC] Replacing answer mid:', line, '->', `a=mid:${offerMid}`);
                return `a=mid:${offerMid}`;
            }
            return line;
        });

        return this.normalizeSdp(adjustedLines.join('\r\n'));
    }

    /**
     * Normalize SDP string: strip trailing empty lines, ensure proper line endings
     */
    normalizeSdp(sdp) {
        return sdp.replace(/[\r\n]+$/, '') + '\r\n';
    }

    /**
     * Strip BUNDLE-related lines from SDP for Kurento compatibility.
     * Kurento 6.x may reject audio-only offers that include BUNDLE.
     */
    stripBundleForKurento(sdp) {
        const lines = sdp.split('\r\n');
        const filtered = lines.filter(line => {
            if (line.startsWith('a=group:BUNDLE')) {
                return false;
            }
            return true;
        });
        return this.normalizeSdp(filtered.join('\r\n'));
    }

    /**
     * Simplify codec list to only opus for Kurento compatibility.
     * Kurento 6.x may reject offers with too many codecs.
     */
    simplifyCodecsForKurento(sdp) {
        const lines = sdp.split('\r\n');
        const allowedPayloads = new Set(['111', '0']);
        const result = [];
        let inAudio = false;

        for (const line of lines) {
            if (line.startsWith('m=audio')) {
                inAudio = true;
                const parts = line.split(' ');
                const filteredParts = [];
                for (let i = 0; i < parts.length; i++) {
                    if (i < 3) {
                        filteredParts.push(parts[i]);
                    } else if (allowedPayloads.has(parts[i])) {
                        filteredParts.push(parts[i]);
                    }
                }
                result.push(filteredParts.join(' '));
            } else if (line.startsWith('m=')) {
                inAudio = false;
                result.push(line);
            } else if (inAudio && (line.startsWith('a=rtpmap:') || line.startsWith('a=fmtp:') || line.startsWith('a=rtcp-fb:'))) {
                const payload = line.match(/^a=(?:rtpmap|fmtp|rtcp-fb):(\d+)/);
                if (payload && allowedPayloads.has(payload[1])) {
                    result.push(line);
                }
            } else {
                result.push(line);
            }
        }
        return this.normalizeSdp(result.join('\r\n'));
    }
    
    /**
     * Adjust SDP answer to match offer's m-line order
     */
    adjustSdpAnswer(offerSdp, answerSdp) {
        console.log('[KurentoWebRTC] Adjusting SDP answer to match offer...');
        console.log('[KurentoWebRTC] Original answer SDP length:', answerSdp.length);
        console.log('[KurentoWebRTC] Original answer SDP (first 500 chars):');
        console.log(answerSdp.substring(0, 500));
        
        // Parse the offer and answer
        const offerLines = offerSdp.split('\r\n');
        const answerLines = answerSdp.split('\r\n');
        
        console.log('[KurentoWebRTC] Offer lines count:', offerLines.length);
        console.log('[KurentoWebRTC] Answer lines count:', answerLines.length);
        
        // Extract media sections from both offer and answer
        const offerMediaSections = this.extractMediaSections(offerLines);
        const answerMediaSections = this.extractMediaSections(answerLines);
        
        console.log('[KurentoWebRTC] Offer media types:', offerMediaSections.map(s => s.type));
        console.log('[KurentoWebRTC] Answer media types:', answerMediaSections.map(s => s.type));
        
        // Build new SDP with answer's media sections in offer's order
        let adjustedLines = [];
        
        // Add session-level attributes from answer (everything before first m=)
        for (let i = 0; i < answerLines.length; i++) {
            if (answerLines[i].startsWith('m=')) {
                break;
            }
            adjustedLines.push(answerLines[i]);
        }
        
        console.log('[KurentoWebRTC] Session-level lines added:', adjustedLines.length);
        
        // Add media sections in offer's order
        for (const offerSection of offerMediaSections) {
            const answerSection = answerMediaSections.find(s => s.type === offerSection.type);
            if (answerSection) {
                console.log('[KurentoWebRTC] Adding media section:', offerSection.type, 'with', answerSection.lines.length, 'lines');
                adjustedLines.push(...answerSection.lines);
            } else {
                console.warn('[KurentoWebRTC] No matching answer section for:', offerSection.type, '- adding placeholder');
                // Add a placeholder media section for missing types
                adjustedLines.push(...this.createPlaceholderMediaSection(offerSection.type));
            }
        }
        
        // Join back into SDP
        const adjustedSdp = this.normalizeSdp(adjustedLines.join('\r\n'));
        
        console.log('[KurentoWebRTC] Adjusted SDP length:', adjustedSdp.length);
        console.log('[KurentoWebRTC] Adjusted SDP (first 500 chars):');
        console.log(adjustedSdp.substring(0, 500));
        
        return adjustedSdp;
    }
    
    /**
     * Create a placeholder media section for missing media types
     */
    createPlaceholderMediaSection(mediaType) {
        // Create a minimal media section that will be rejected
        const placeholder = [
            `m=${mediaType} 9 UDP/TLS/RTP/SAVPF 0`,
            `c=IN IP4 0.0.0.0`,
            `a=mid:${mediaType}`,
            `a=inactive`,
            `a=rtcp:9 IN IP4 0.0.0.0`
        ];
        
        console.log('[KurentoWebRTC] Created placeholder for', mediaType, ':', placeholder);
        
        return placeholder;
    }
    
    /**
     * Extract media sections from SDP lines
     */
    extractMediaSections(lines) {
        const sections = [];
        let currentSection = null;
        
        console.log('[KurentoWebRTC] Extracting media sections from', lines.length, 'lines');
        
        // Log all m= lines for debugging
        const mLines = lines.filter(line => line.startsWith('m='));
        console.log('[KurentoWebRTC] All m= lines in SDP:', mLines);
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Skip empty lines
            if (!line || line.trim() === '') {
                continue;
            }
            
            if (line.startsWith('m=')) {
                if (currentSection) {
                    console.log('[KurentoWebRTC] Found media section:', currentSection.type, 'with', currentSection.lines.length, 'lines');
                    sections.push(currentSection);
                }
                // Extract media type: m=audio 9 UDP/TLS/RTP/SAVPF 111 -> audio
                const mediaType = line.split(' ')[0].substring(2);
                console.log('[KurentoWebRTC] Starting new media section:', mediaType);
                currentSection = { type: mediaType, lines: [line] };
            } else if (currentSection) {
                currentSection.lines.push(line);
            }
        }
        
        if (currentSection) {
            console.log('[KurentoWebRTC] Found media section:', currentSection.type, 'with', currentSection.lines.length, 'lines');
            sections.push(currentSection);
        }
        
        console.log('[KurentoWebRTC] Total media sections extracted:', sections.length);
        console.log('[KurentoWebRTC] Media types:', sections.map(s => s.type));
        
        return sections;
    }
    
    /**
     * Sends ICE candidate to server
     */
    async sendIceCandidate(candidate) {
        try {
            await fetch(
                `${this.apiBaseUrl}/session/${this.sessionId}/ice-candidate`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        candidate: candidate.candidate,
                        sdpMid: candidate.sdpMid,
                        sdpMLineIndex: candidate.sdpMLineIndex
                    })
                }
            );
            
            console.log('[KurentoWebRTC] ICE candidate sent successfully');
            
        } catch (error) {
            console.error('[KurentoWebRTC] Failed to send ICE candidate:', error);
        }
    }
    
    /**
     * Stops the WebRTC session
     */
    async stop() {
        try {
            console.log('[KurentoWebRTC] Stopping session...');
            
            // Clean up resources
            this.cleanup();
            
            // Notify server to close session
            if (this.sessionId) {
                try {
                    await fetch(`${this.apiBaseUrl}/session/${this.sessionId}`, {
                        method: 'DELETE'
                    });
                } catch (e) {
                    console.warn('[KurentoWebRTC] Failed to close session on server:', e);
                }
                this.sessionId = null;
            }
            
            this.updateStatus('disconnected', '未连接');
            this.sendMessage('system', 'Kurento WebRTC 已断开');
            
        } catch (error) {
            console.error('[KurentoWebRTC] Failed to stop session:', error);
        }
    }
    
    /**
     * Cleans up all WebRTC resources
     */
    cleanup() {
        // Stop local stream tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        // Stop remote stream tracks
        if (this.remoteStream) {
            this.remoteStream.getTracks().forEach(track => track.stop());
            this.remoteStream = null;
        }
        
        // Close peer connection
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        // Clear audio elements
        const localAudio = document.getElementById('localAudio');
        const remoteAudio = document.getElementById('remoteAudio');
        if (localAudio) localAudio.srcObject = null;
        if (remoteAudio) remoteAudio.srcObject = null;
    }
    
    /**
     * Checks if session is active
     */
    isActive() {
        return this.sessionId !== null && this.peerConnection !== null;
    }
}

// Export for use in HTML pages
if (typeof window !== 'undefined') {
    window.KurentoWebRTCClient = KurentoWebRTCClient;
}
