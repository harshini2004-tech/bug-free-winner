// test-groq.js
require('dotenv').config();
const { Groq } = require('groq-sdk');

async function testGroq() {
    if (!process.env.GROQ_API_KEY) {
        console.error('❌ GROQ_API_KEY is not set in .env file');
        console.log('Get your API key from: https://console.groq.com');
        return;
    }
    
    console.log('Testing Groq API with key:', process.env.GROQ_API_KEY.substring(0, 10) + '...');
    
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    
    try {
        // Test with a simple request
        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "user",
                    content: "Say 'Hello, Groq is working!'"
                }
            ],
            model: "llama3-8b-8192",
            temperature: 0.7,
            max_tokens: 50,
        });
        
        console.log('✅ Groq API is working!');
        console.log('Response:', completion.choices[0]?.message?.content);
        
        // Test with a coding request
        console.log('\nTesting coding request...');
        const codeCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "You are a coding assistant. Return only code, no explanations."
                },
                {
                    role: "user",
                    content: "Create a simple HTML page with a red button"
                }
            ],
            model: "llama3-8b-8192",
            temperature: 0.7,
            max_tokens: 500,
        });
        
        console.log('✅ Coding test successful!');
        console.log('Code response (first 200 chars):', codeCompletion.choices[0]?.message?.content.substring(0, 200));
        
    } catch (error) {
        console.error('❌ Groq API Error:', error.message);
        console.error('Full error:', error);
        
        if (error.status === 401) {
            console.error('\n⚠️  Your API key is invalid or expired');
            console.error('Please get a new key from: https://console.groq.com');
        } else if (error.status === 429) {
            console.error('\n⚠️  Rate limit exceeded');
            console.error('Wait a few minutes and try again');
        }
    }
}

testGroq();