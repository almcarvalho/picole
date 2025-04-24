const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
require('dotenv').config();

const client = new Client({
    authStrategy: new LocalAuth()
});

let iaAtiva = true;
const admins = process.env.ADMIN_WHATSAPPS.split(',');
const threads = {}; // Armazena threads por número

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
    console.log('Escaneie o QR code para conectar no WhatsApp');
});

client.on('ready', () => {
    console.log('Cliente está pronto!');
});

client.on('message', async msg => {
    const pergunta = msg.body.trim();
    const remetente = msg.from.replace(/@c.us$/, '');
    const isAdmin = admins.includes(remetente);

    // Comandos mágicos para admins
    if (isAdmin) {
        if (pergunta.toLowerCase() === '/stopai') {
            iaAtiva = false;
            msg.reply('🤖 IA desativada com sucesso!');
            return;
        } else if (pergunta.toLowerCase() === '/startai') {
            iaAtiva = true;
            msg.reply('🤖 IA ativada com sucesso!');
            return;
        }
    }

    if (!iaAtiva) return;

    const headers = {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'OpenAI-Beta': 'assistants=v2',
        'Content-Type': 'application/json'
    };

    try {
        let threadId = threads[remetente];

        // 1. Cria thread se for a primeira vez
        if (!threadId) {
            const threadRes = await axios.post('https://api.openai.com/v1/threads', {}, { headers });
            threadId = threadRes.data.id;
            threads[remetente] = threadId;
        }

        // 2. Adiciona mensagem do usuário à thread existente
        await axios.post(
            `https://api.openai.com/v1/threads/${threadId}/messages`,
            {
                role: 'user',
                content: pergunta
            },
            { headers }
        );

        // 3. Executa o assistente com a thread atualizada
        const runRes = await axios.post(
            `https://api.openai.com/v1/threads/${threadId}/runs`,
            {
                assistant_id: process.env.OPENAI_ASSISTANT_ID
            },
            { headers }
        );

        const runId = runRes.data.id;

        // 4. Espera a execução completar
        let status = 'queued';
        while (status !== 'completed' && status !== 'failed') {
            await new Promise(resolve => setTimeout(resolve, 1500));
            const runCheck = await axios.get(
                `https://api.openai.com/v1/threads/${threadId}/runs/${runId}`,
                { headers }
            );
            status = runCheck.data.status;
        }

        if (status === 'failed') {
            msg.reply('⚠️ Tive um problema para responder. Tenta de novo!');
            return;
        }

        // 5. Busca a última resposta do assistente
        const mensagens = await axios.get(
            `https://api.openai.com/v1/threads/${threadId}/messages`,
            { headers }
        );

        const resposta = mensagens.data.data
            .reverse()
            .find(m => m.role === 'assistant')
            ?.content[0]?.text?.value;

        msg.reply(resposta || '🤖 Não consegui entender sua pergunta.');
    } catch (error) {
        console.error('Erro ao consultar o assistente:', error.response?.data || error.message);
        msg.reply("❌ Erro ao tentar responder. Tenta de novo já já!");
    }
});

client.initialize();
