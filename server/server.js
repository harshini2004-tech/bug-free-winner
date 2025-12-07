require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname + '/..'));

// Create workspaces directory
const WORKSPACES_DIR = path.join(__dirname, 'workspaces');
(async () => {
    try {
        await fs.mkdir(WORKSPACES_DIR, { recursive: true });
        console.log('✅ Workspaces directory ready');
    } catch (err) {
        console.error('❌ Error creating workspaces directory:', err);
    }
})();

// Groq API Configuration
const GROQ_API_KEY = "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";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

// Store active workspaces
const workspaces = new Map();

class Workspace {
    constructor(sessionId) {
        this.sessionId = sessionId;
        this.history = [];
        this.currentHtml = '';
        this.createdAt = new Date();
        this.apiCallCount = 0;
        this.lastApiCall = null;
    }
    
    extractPureHTML(code) {
        console.log('🔍 Extracting pure HTML from response...');
        
        // Remove ALL markdown code blocks
        let cleaned = code.replace(/```[\s\S]*?\n/g, '');
        cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
        cleaned = cleaned.replace(/`/g, '');
        
        // Remove explanations before <!DOCTYPE
        const docTypeIndex = cleaned.indexOf('<!DOCTYPE');
        if (docTypeIndex > 0) {
            cleaned = cleaned.substring(docTypeIndex);
        }
        
        // Remove everything after </html>
        const htmlEndIndex = cleaned.indexOf('</html>');
        if (htmlEndIndex > 0) {
            cleaned = cleaned.substring(0, htmlEndIndex + 7);
        }
        
        // If still no valid HTML, create a fallback
        if (!cleaned.includes('<html') || !cleaned.includes('</html>')) {
            console.log('⚠️ No valid HTML found, creating fallback');
            cleaned = this.createFallbackHTML();
        }
        
        // Ensure CDNs are included
        cleaned = this.ensureAnimationCDNs(cleaned);
        
        return cleaned;
    }
    
    createFallbackHTML() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generated Website</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css" rel="stylesheet">
    <link href="https://unpkg.com/aos@2.3.1/dist/aos.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/particles.js/2.0.0/particles.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Poppins', sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            overflow-x: hidden;
        }
        #particles-js {
            position: fixed;
            width: 100%;
            height: 100%;
            top: 0;
            left: 0;
            z-index: -1;
        }
        .hero {
            height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            color: white;
            padding: 20px;
            position: relative;
            z-index: 1;
        }
        h1 { 
            font-size: 3.5rem; 
            margin-bottom: 20px; 
            animation: fadeInDown 1s;
            text-shadow: 0 2px 10px rgba(0,0,0,0.3);
        }
        p { 
            font-size: 1.2rem; 
            max-width: 600px; 
            margin-bottom: 30px; 
            animation: fadeInUp 1s 0.3s both;
            line-height: 1.6;
        }
        .btn {
            background: white;
            color: #667eea;
            padding: 15px 40px;
            border-radius: 50px;
            text-decoration: none;
            font-weight: 600;
            transition: all 0.3s;
            animation: pulse 2s infinite;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            border: none;
            cursor: pointer;
            font-size: 1.1rem;
        }
        .btn:hover { 
            transform: translateY(-5px) scale(1.05); 
            box-shadow: 0 15px 40px rgba(0,0,0,0.3);
        }
        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 30px;
            padding: 80px 5%;
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
        }
        .card {
            background: rgba(255,255,255,0.15);
            padding: 30px;
            border-radius: 20px;
            text-align: center;
            transition: all 0.4s;
            border: 1px solid rgba(255,255,255,0.2);
        }
        .card:hover {
            transform: translateY(-10px) scale(1.03);
            background: rgba(255,255,255,0.25);
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        }
        @keyframes fadeInDown { 
            from { opacity: 0; transform: translateY(-30px); } 
            to { opacity: 1; transform: translateY(0); } 
        }
        @keyframes fadeInUp { 
            from { opacity: 0; transform: translateY(30px); } 
            to { opacity: 1; transform: translateY(0); } 
        }
        @keyframes pulse { 
            0%, 100% { transform: scale(1); } 
            50% { transform: scale(1.05); } 
        }
        @keyframes gradient {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }
        @media (max-width: 768px) {
            h1 { font-size: 2.5rem; }
            p { font-size: 1rem; }
            .btn { padding: 12px 30px; }
        }
    </style>
</head>
<body>
    <div id="particles-js"></div>
    
    <section class="hero" data-aos="fade-up">
        <h1 class="animate__animated animate__fadeInDown">Welcome to Your Website</h1>
        <p class="animate__animated animate__fadeInUp">This is a stunning animated website created from your voice command. It features gradient backgrounds, smooth animations, and interactive elements.</p>
        <button class="btn animate__animated animate__pulse">Get Started</button>
    </section>
    
    <section class="features">
        <div class="card" data-aos="zoom-in">
            <h3>✨ Stunning Animations</h3>
            <p>Beautiful animations powered by Animate.css and AOS library</p>
        </div>
        <div class="card" data-aos="zoom-in" data-aos-delay="100">
            <h3>🎨 Modern Design</h3>
            <p>Glass morphism effects and gradient backgrounds</p>
        </div>
        <div class="card" data-aos="zoom-in" data-aos-delay="200">
            <h3>📱 Fully Responsive</h3>
            <p>Perfectly optimized for all devices and screen sizes</p>
        </div>
    </section>
    
    <script>
        // Initialize AOS
        AOS.init({
            duration: 1000,
            once: false,
            mirror: true
        });
        
        // Initialize particles.js
        particlesJS('particles-js', {
            particles: {
                number: { value: 100, density: { enable: true, value_area: 800 } },
                color: { value: "#ffffff" },
                shape: { type: "circle" },
                opacity: { value: 0.5, random: true },
                size: { value: 3, random: true },
                line_linked: {
                    enable: true,
                    distance: 150,
                    color: "#ffffff",
                    opacity: 0.4,
                    width: 1
                },
                move: {
                    enable: true,
                    speed: 2,
                    direction: "none",
                    random: true,
                    straight: false,
                    out_mode: "out",
                    bounce: false
                }
            },
            interactivity: {
                detect_on: "canvas",
                events: {
                    onhover: { enable: true, mode: "repulse" },
                    onclick: { enable: true, mode: "push" }
                }
            },
            retina_detect: true
        });
        
        // Add hover effects
        document.querySelectorAll('.card').forEach(card => {
            card.addEventListener('mouseenter', () => {
                card.style.transform = 'translateY(-10px) scale(1.03)';
            });
            card.addEventListener('mouseleave', () => {
                card.style.transform = 'translateY(0) scale(1)';
            });
        });
        
        // Add button click effect
        document.querySelector('.btn').addEventListener('click', function() {
            this.style.animation = 'none';
            setTimeout(() => {
                this.style.animation = 'pulse 2s infinite';
            }, 10);
            alert('Website created successfully! 🎉');
        });
        
        console.log('🎨 Animated website loaded successfully!');
    </script>
</body>
</html>`;
    }
    
    ensureAnimationCDNs(html) {
        const requiredCDNs = `
    <link href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css" rel="stylesheet">
    <link href="https://unpkg.com/aos@2.3.1/dist/aos.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/particles.js/2.0.0/particles.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Montserrat:wght@400;500;700&display=swap" rel="stylesheet">`;
    
        // Check if CDNs are already present
        if (!html.includes('animate.min.css')) {
            // Insert CDNs before closing head tag
            if (html.includes('</head>')) {
                html = html.replace('</head>', requiredCDNs + '\n    </head>');
            } else if (html.includes('<body>')) {
                // If no head, add before body
                html = html.replace('<body>', '<head>' + requiredCDNs + '\n    </head>\n    <body>');
            }
        }
        
        // Add particles container if not present
        if (!html.includes('particles-js')) {
            const particlesDiv = '\n    <div id="particles-js"></div>';
            if (html.includes('<body>')) {
                html = html.replace('<body>', '<body>' + particlesDiv);
            }
        }
        
        return html;
    }
    
    async callGroqAPI(prompt) {
        const now = Date.now();
        if (this.lastApiCall && (now - this.lastApiCall) < 3000) {
            throw new Error('Please wait 3 seconds between requests');
        }
        
        try {
            console.log(`🔄 Calling Groq API`);
            
            const response = await fetch(GROQ_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: GROQ_MODEL,
                    messages: [
                        {
                            role: "system",
                            content: `CRITICAL INSTRUCTIONS - MUST FOLLOW:
1. You are a professional web developer. Generate ONLY valid HTML/CSS/JavaScript code.
2. ABSOLUTELY NO markdown, NO explanations, NO descriptions, NO comments about code.
3. Start EXACTLY with: <!DOCTYPE html>
4. End EXACTLY with: </html>
5. Include COMPLETE working code with:
   - Proper HTML structure with head and body
   - Embedded CSS with @keyframes animations
   - Embedded JavaScript for interactivity
   - Use placeholder images from unsplash.com or placeholder.com
   - Use actual <img> tags, NOT markdown images
   - Make it fully responsive with media queries

6. ALWAYS include animations:
   - CSS animations with @keyframes
   - Hover effects with transform and transition
   - Smooth scrolling and parallax effects
   - Animated gradients

7. Example of CORRECT response:
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Website</title>
    <style>
        /* Your CSS here */
    </style>
</head>
<body>
    <!-- Your HTML here -->
    <script>
        // Your JavaScript here
    </script>
</body>
</html>

VIOLATION of these rules will break the system!`
                        },
                        {
                            role: "user",
                            content: `Create a complete animated HTML website about: "${prompt}"

STRICTLY follow these requirements:
1. Output ONLY raw HTML/CSS/JS code
2. Start with <!DOCTYPE html>
3. Include working animations
4. Use placeholder images: https://images.unsplash.com/random/...
5. Make it responsive
6. Add interactive elements
7. Use modern design with gradients

BEGIN CODE:`
                        }
                    ],
                    max_tokens: 6000,
                    temperature: 0.7,
                    stream: false
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Groq API error: ${response.status} ${errorText}`);
            }
            
            const data = await response.json();
            this.apiCallCount++;
            this.lastApiCall = Date.now();
            
            let code = data.choices[0].message.content;
            console.log('📄 Raw response length:', code.length);
            
            // Extract pure HTML
            code = this.extractPureHTML(code);
            
            return code;
            
        } catch (error) {
            console.error('Groq API call failed:', error.message);
            throw error;
        }
    }
    
    async createWebsite(command) {
        console.log(`🔄 Creating website for: "${command}"`);
        const code = await this.callGroqAPI(command);
        
        console.log(`✅ Website created (${code.length} chars)`);
        return code;
    }
    
    async modifyWebsite(command, currentCode) {
        const prompt = `MODIFY THIS WEBSITE:

Current website code:
${currentCode.substring(0, 1500)}...

MODIFICATION REQUEST: "${command}"

INSTRUCTIONS:
1. Apply ONLY the requested changes
2. Keep all existing functionality
3. Maintain the design consistency
4. Return ONLY the complete modified HTML/CSS/JavaScript code
5. Start with <!DOCTYPE html>
6. No explanations, just the complete code`;

        console.log(`🔄 Modifying website: "${command}"`);
        const code = await this.callGroqAPI(prompt);
        
        console.log(`✅ Website modified (${code.length} chars)`);
        return code;
    }
    
    async saveToFile(code) {
        const workspaceDir = path.join(WORKSPACES_DIR, this.sessionId);
        await fs.mkdir(workspaceDir, { recursive: true });
        
        const htmlPath = path.join(workspaceDir, 'index.html');
        await fs.writeFile(htmlPath, code);
        
        const codePath = path.join(workspaceDir, 'code.txt');
        await fs.writeFile(codePath, code);
        
        this.currentHtml = code;
        
        return {
            code: code,
            previewUrl: `/workspace/${this.sessionId}/index.html`,
            livePreviewUrl: `http://localhost:${process.env.PORT || 3002}/workspace/${this.sessionId}/index.html`
        };
    }
    
    async getCurrentCode() {
        const workspaceDir = path.join(WORKSPACES_DIR, this.sessionId);
        const codePath = path.join(workspaceDir, 'code.txt');
        
        try {
            const code = await fs.readFile(codePath, 'utf-8');
            this.currentHtml = code;
            return code;
        } catch {
            return this.currentHtml || '';
        }
    }
}

// Test Groq API
async function testGroqAPI() {
    try {
        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: [{ 
                    role: "user", 
                    content: "Say 'Groq API is ready for website generation'" 
                }],
                max_tokens: 20
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            return { success: true, message: data.choices[0].message.content };
        } else {
            const errorText = await response.text();
            return { success: false, message: `HTTP ${response.status}: ${errorText}` };
        }
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// Process voice command
async function processVoiceCommand(sessionId, voiceText) {
    let workspace = workspaces.get(sessionId);
    
    if (!workspace) {
        workspace = new Workspace(sessionId);
        workspaces.set(sessionId, workspace);
        console.log(`✨ Created new workspace: ${sessionId}`);
    }
    
    try {
        const lowerText = voiceText.toLowerCase();
        const isModification = lowerText.includes('change') || 
                              lowerText.includes('modify') ||
                              lowerText.includes('move') ||
                              lowerText.includes('update') ||
                              lowerText.includes('add to') ||
                              lowerText.includes('remove') ||
                              lowerText.includes('make') ||
                              lowerText.includes('adjust') ||
                              lowerText.includes('edit');
        
        let code;
        let action = 'created';
        
        if (isModification && workspace.history.length > 0) {
            const currentCode = await workspace.getCurrentCode();
            if (currentCode && currentCode.length > 100) {
                console.log(`✏️  Modifying website: "${voiceText}"`);
                code = await workspace.modifyWebsite(voiceText, currentCode);
                action = 'modified';
            } else {
                console.log(`🆕 Creating website: "${voiceText}"`);
                code = await workspace.createWebsite(voiceText);
                action = 'created';
            }
        } else {
            console.log(`🆕 Creating website: "${voiceText}"`);
            code = await workspace.createWebsite(voiceText);
            action = 'created';
        }
        
        workspace.history.push({
            command: voiceText,
            timestamp: new Date(),
            action: action
        });
        
        const result = await workspace.saveToFile(code);
        
        return {
            success: true,
            text: voiceText,
            code: result.code,
            previewUrl: result.previewUrl,
            livePreviewUrl: result.livePreviewUrl,
            isModification: isModification,
            action: action,
            historyLength: workspace.history.length,
            apiCallsUsed: workspace.apiCallCount
        };
        
    } catch (error) {
        console.error('Process error:', error);
        throw error;
    }
}

// Serve workspace files
app.use('/workspace', express.static(WORKSPACES_DIR));

// WebSocket connection
io.on('connection', (socket) => {
    console.log('👤 Client connected:', socket.id);
    const sessionId = socket.id;
    
    socket.on('voice_text', async (data) => {
        console.log('🎤 Voice command:', data.text);
        
        try {
            const result = await processVoiceCommand(sessionId, data.text);
            
            socket.emit('voice_result', {
                text: data.text,
                code: result.code,
                previewUrl: result.previewUrl,
                livePreviewUrl: result.livePreviewUrl,
                isModification: result.isModification,
                action: result.action,
                historyLength: result.historyLength,
                apiCallsUsed: result.apiCallsUsed,
                message: `✅ Website ${result.action} successfully!`
            });
            
            console.log(`✅ Website ${result.action} successfully!`);
            
        } catch (error) {
            console.error('❌ Error:', error.message);
            socket.emit('voice_error', {
                error: error.message,
                message: 'Failed to create website. Please try again.'
            });
        }
    });
    
    socket.on('disconnect', () => {
        console.log('👋 Client disconnected:', sessionId);
    });
});

// Health check
app.get('/health', async (req, res) => {
    try {
        const testResult = await testGroqAPI();
        
        res.json({ 
            status: 'running',
            api: 'Groq',
            model: GROQ_MODEL,
            api_status: testResult.success ? 'connected' : 'error',
            test_response: testResult.message,
            active_workspaces: workspaces.size,
            port: process.env.PORT || 3002,
            timestamp: new Date().toISOString(),
            feature: 'WEBSITE GENERATION ENABLED',
            note: 'Generates complete HTML websites from voice commands'
        });
    } catch (error) {
        res.json({
            status: 'running',
            api: 'Groq',
            api_status: 'error: ' + error.message,
            port: process.env.PORT || 3002
        });
    }
});

// Start server
async function startServer() {
    const PORT = process.env.PORT || 3002;
    
    console.log('🔍 Testing Groq API connection...');
    const testResult = await testGroqAPI();
    
    server.listen(PORT, () => {
        console.log(`
╔══════════════════════════════════════════════════════════╗
║        VOICE2CODE - GROQ API                            ║
╠══════════════════════════════════════════════════════════╣
║  Server:  http://localhost:${PORT}                      ║
║  Health:  http://localhost:${PORT}/health              ║
║  API:     ${testResult.success ? '✅ Connected' : '❌ Failed'}                           ║
║  Model:   ${GROQ_MODEL}                                 ║
║  Note:    Creates ANY website from voice                ║
╚══════════════════════════════════════════════════════════╝
        `);
        
        if (testResult.success) {
            console.log('\n🎯 READY FOR ANY WEBSITE!');
            console.log('\n🎤 EXAMPLE COMMANDS:');
            console.log('   • "clinic website with calm light blue theme"');
            console.log('   • "e-commerce store for sneakers"');
            console.log('   • "portfolio website for a designer"');
            console.log('   • "blog about technology"');
            console.log('   • "restaurant website with menu"');
            
            console.log('\n🔧 MODIFICATION COMMANDS:');
            console.log('   • "Change the color scheme to dark mode"');
            console.log('   • "Add a contact form"');
            console.log('   • "Make the font larger"');
            console.log('   • "Add a footer section"');
        }
    });
}

// Handle errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled Rejection:', error);
});

startServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});