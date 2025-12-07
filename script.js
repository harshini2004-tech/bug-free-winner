// Check if browser supports speech recognition
window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isRecording = false;
let socket = null;
let currentSessionId = null;
let workspaceHistory = [];

// Initialize the app when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('Voice2Code app initializing...');
    
    // Initialize WebSocket connection
    initializeSocket();
    
    // Check and initialize speech recognition
    initializeSpeechRecognition();
    
    // Show browser support status
    checkBrowserSupport();
    
    // Initialize UI
    initializeUI();
});

function initializeSocket() {
    try {
        const port = window.location.port || 3002;
        socket = io(`http://localhost:${port}`);
        
        socket.on('connect', () => {
            console.log('✅ Connected to server via WebSocket');
            currentSessionId = socket.id;
            updateStatus('Connected. Start building!', 'success');
            
            // Load existing workspace if any
            socket.emit('get_workspace');
        });
        
        socket.on('voice_result', (data) => {
            console.log('Workspace updated:', data);
            
            // Update UI
            document.getElementById('voiceText').textContent = `You said: ${data.text}`;
            document.getElementById('generatedCode').textContent = data.code;
            document.getElementById('codeDisplay').style.display = 'block';
            document.getElementById('noCodeMessage').style.display = 'none';
            document.getElementById('copyBtn').style.display = 'block';
            
            // Update workspace info
            document.getElementById('workspaceInfo').style.display = 'block';
            document.getElementById('modCount').textContent = data.historyLength;
            document.getElementById('modType').textContent = data.isModification ? 'Modified' : 'Created';
            
            // Show preview button
            document.getElementById('previewBtn').style.display = 'block';
            document.getElementById('previewBtn').onclick = () => {
                window.open(data.livePreviewUrl, '_blank');
            };
            
            // Add to history
            workspaceHistory.push({
                command: data.text,
                time: new Date().toLocaleTimeString(),
                type: data.isModification ? 'modify' : 'create'
            });
            updateHistoryDisplay();
            
            updateStatus(`${data.isModification ? 'Modified' : 'Created'}! Click "Open Preview" to view`, 'success');
        });
        
        socket.on('workspace_state', (data) => {
            if (data.hasWorkspace) {
                console.log('Loaded existing workspace');
                document.getElementById('workspaceInfo').style.display = 'block';
                document.getElementById('modCount').textContent = data.historyLength;
                document.getElementById('previewBtn').style.display = 'block';
                document.getElementById('previewBtn').onclick = () => {
                    window.open(data.livePreviewUrl, '_blank');
                };
                updateStatus('Resumed existing workspace', 'success');
            }
        });
        
        socket.on('voice_error', (data) => {
            console.error('Server error:', data);
            document.getElementById('generatedCode').textContent = `Error: ${data.error}`;
            document.getElementById('codeDisplay').style.display = 'block';
            document.getElementById('noCodeMessage').style.display = 'none';
            updateStatus('Error processing command', 'error');
        });
        
        socket.on('disconnect', () => {
            console.log('Disconnected from server');
            updateStatus('Disconnected from server', 'error');
        });
        
    } catch (error) {
        console.error('WebSocket initialization error:', error);
        updateStatus('Cannot connect to server', 'error');
    }
}

function initializeUI() {
    // Create history panel
    const historyPanel = document.createElement('div');
    historyPanel.id = 'historyPanel';
    historyPanel.className = 'history-panel';
    historyPanel.innerHTML = `
        <h3><i class="fas fa-history"></i> Modification History</h3>
        <div id="historyList" class="history-list"></div>
        <button onclick="clearWorkspace()" class="clear-btn">
            <i class="fas fa-trash"></i> Clear Workspace
        </button>
    `;
    document.querySelector('.container').appendChild(historyPanel);
}

function updateHistoryDisplay() {
    const historyList = document.getElementById('historyList');
    if (!historyList) return;
    
    historyList.innerHTML = '';
    
    // Show last 5 commands
    const recent = workspaceHistory.slice(-5).reverse();
    
    recent.forEach((item, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'history-item';
        itemDiv.innerHTML = `
            <div class="history-type ${item.type}">${item.type === 'create' ? '➕' : '✏️'}</div>
            <div class="history-content">
                <div class="history-command">${item.command}</div>
                <div class="history-time">${item.time}</div>
            </div>
        `;
        historyList.appendChild(itemDiv);
    });
    
    if (workspaceHistory.length === 0) {
        historyList.innerHTML = '<div class="no-history">No modifications yet</div>';
    }
}

function clearWorkspace() {
    if (confirm('Clear workspace and start fresh?')) {
        socket.emit('clear_workspace');
        workspaceHistory = [];
        updateHistoryDisplay();
        document.getElementById('workspaceInfo').style.display = 'none';
        document.getElementById('previewBtn').style.display = 'none';
        document.getElementById('codeDisplay').style.display = 'none';
        document.getElementById('noCodeMessage').style.display = 'block';
        updateStatus('Workspace cleared. Ready for new project.', 'success');
    }
}

function initializeSpeechRecognition() {
    if (!window.SpeechRecognition) {
        console.error('Speech recognition not supported in this browser');
        updateStatus('Speech recognition not supported. Try Chrome, Edge, or Safari.', 'error');
        return;
    }
    
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;
    
    recognition.onstart = function() {
        console.log('Speech recognition started');
        isRecording = true;
        updateRecordingUI(true);
        updateStatus('Listening... Speak your command', 'recording');
    };
    
    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        console.log('Speech recognized:', transcript);
        
        // Update UI
        document.getElementById('voiceText').textContent = `You said: ${transcript}`;
        document.getElementById('generatedCode').textContent = 'Processing command...';
        document.getElementById('codeDisplay').style.display = 'block';
        document.getElementById('noCodeMessage').style.display = 'none';
        document.getElementById('previewBtn').style.display = 'none';
        
        // Send to server
        if (socket && socket.connected) {
            socket.emit('voice_text', { text: transcript });
            updateStatus('Applying to workspace...', 'processing');
        } else {
            sendViaRESTAPI(transcript);
        }
    };
    
    recognition.onerror = function(event) {
        console.error('Speech recognition error:', event.error);
        isRecording = false;
        updateRecordingUI(false);
        
        let errorMessage = 'Speech recognition error: ';
        switch(event.error) {
            case 'no-speech':
                errorMessage += 'No speech detected';
                break;
            case 'audio-capture':
                errorMessage += 'No microphone found';
                break;
            case 'not-allowed':
                errorMessage += 'Microphone access denied';
                break;
            default:
                errorMessage += event.error;
        }
        
        updateStatus(errorMessage, 'error');
        document.getElementById('voiceText').textContent = errorMessage;
    };
    
    recognition.onend = function() {
        console.log('Speech recognition ended');
        isRecording = false;
        updateRecordingUI(false);
        updateStatus('Ready for next command', 'ready');
    };
}

function toggleRecording() {
    if (!recognition) {
        alert('Speech recognition is not supported or failed to initialize. Please use Chrome, Edge, or Safari browser.');
        return;
    }
    
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

function startRecording() {
    try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(function(stream) {
                    console.log('Microphone access granted');
                    recognition.start();
                })
                .catch(function(err) {
                    console.error('Microphone access denied:', err);
                    updateStatus('Microphone access denied. Please allow microphone access.', 'error');
                    document.getElementById('voiceText').textContent = 'Error: Microphone access denied. Please check browser permissions.';
                });
        } else {
            recognition.start();
        }
    } catch (error) {
        console.error('Error starting recording:', error);
        updateStatus('Error starting recording', 'error');
    }
}

function stopRecording() {
    if (recognition && isRecording) {
        recognition.stop();
    }
}

function updateRecordingUI(recording) {
    const btn = document.getElementById('recordBtn');
    const btnText = document.getElementById('btnText');
    const statusIndicator = document.querySelector('.pulse');
    
    if (recording) {
        btn.classList.add('recording');
        btnText.textContent = 'Stop Recording';
        statusIndicator.style.background = '#ff4757';
    } else {
        btn.classList.remove('recording');
        btnText.textContent = 'Speak Now';
        statusIndicator.style.background = '#28a745';
    }
}

function updateStatus(message, type) {
    const statusSpan = document.querySelector('.status-indicator span');
    const pulse = document.querySelector('.pulse');
    
    statusSpan.textContent = message;
    
    switch(type) {
        case 'success':
            pulse.style.background = '#28a745';
            break;
        case 'error':
            pulse.style.background = '#ff4757';
            break;
        case 'recording':
            pulse.style.background = '#ffa502';
            break;
        case 'processing':
            pulse.style.background = '#2ed573';
            break;
        case 'ready':
        default:
            pulse.style.background = '#28a745';
    }
}

async function sendViaRESTAPI(transcript) {
    try {
        updateStatus('Using REST API...', 'processing');
        
        const response = await fetch('/api/process-voice', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                text: transcript,
                sessionId: currentSessionId 
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Handle response similar to WebSocket
            document.getElementById('voiceText').textContent = `You said: ${data.text}`;
            document.getElementById('generatedCode').textContent = data.code;
            document.getElementById('codeDisplay').style.display = 'block';
            document.getElementById('noCodeMessage').style.display = 'none';
            document.getElementById('copyBtn').style.display = 'block';
            
            // Update workspace info
            document.getElementById('workspaceInfo').style.display = 'block';
            document.getElementById('modCount').textContent = data.historyLength;
            document.getElementById('modType').textContent = data.isModification ? 'Modified' : 'Created';
            
            // Show preview button
            document.getElementById('previewBtn').style.display = 'block';
            document.getElementById('previewBtn').onclick = () => {
                window.open(data.livePreviewUrl, '_blank');
            };
            
            updateStatus('Command applied!', 'success');
        } else {
            throw new Error(data.error || 'Unknown error');
        }
        
    } catch (error) {
        console.error('REST API Error:', error);
        document.getElementById('generatedCode').textContent = `Error: ${error.message}`;
        updateStatus('Failed to process command', 'error');
    }
}

function copyToClipboard() {
    const code = document.getElementById('generatedCode').textContent;
    
    navigator.clipboard.writeText(code)
        .then(() => {
            const btn = document.getElementById('copyBtn');
            btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            btn.classList.add('copied');
            
            setTimeout(() => {
                btn.innerHTML = '<i class="far fa-copy"></i> Copy Code';
                btn.classList.remove('copied');
            }, 2000);
        })
        .catch(err => {
            console.error('Copy failed:', err);
            alert('Failed to copy code to clipboard');
        });
}

function checkBrowserSupport() {
    const supported = !!window.SpeechRecognition;
    const browserName = getBrowserName();
    
    if (!supported) {
        document.getElementById('voiceText').textContent = 
            `Speech recognition is not supported in ${browserName}. Please use Chrome, Edge, or Safari.`;
        updateStatus('Browser not supported', 'error');
    } else {
        console.log(`✅ Speech recognition supported in ${browserName}`);
        updateStatus('Ready to build', 'ready');
    }
}

function getBrowserName() {
    const userAgent = navigator.userAgent;
    if (userAgent.indexOf('Chrome') > -1) return 'Chrome';
    if (userAgent.indexOf('Firefox') > -1) return 'Firefox';
    if (userAgent.indexOf('Safari') > -1) return 'Safari';
    if (userAgent.indexOf('Edge') > -1) return 'Edge';
    return 'your browser';
}

function showExample() {
    const examples = [
        "CREATE: Build an e-commerce sneaker store with dark theme",
        "MODIFY: Change all buttons from red to blue",
        "MODIFY: Move the product grid to the right side",
        "MODIFY: Add a navigation bar with Home, Products, About, Contact",
        "MODIFY: Make the website background black with white text",
        "MODIFY: Increase font size of all headings by 20%",
        "MODIFY: Add a footer with social media icons",
        "MODIFY: Change the color scheme to purple and pink"
    ];
    
    const randomExample = examples[Math.floor(Math.random() * examples.length)];
    document.getElementById('voiceText').textContent = `Try saying: "${randomExample}"`;
    document.getElementById('noCodeMessage').style.display = 'none';
    document.getElementById('codeDisplay').style.display = 'none';
}