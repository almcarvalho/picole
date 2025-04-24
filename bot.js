const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
require('dotenv').config();

const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
    console.log('Escaneie o QR code para conectar no WhatsApp');
});

client.on('ready', () => {
    console.log('Cliente está pronto!');
});

client.on('message', async msg => {
    const pergunta = msg.body;

    const headers = {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'OpenAI-Beta': 'assistants=v2',
        'Content-Type': 'application/json'
    };

    try {
        // 1. Cria uma thread com mensagem + run
        const runRes = await axios.post(
            'https://api.openai.com/v1/threads/runs',
            {
                assistant_id: process.env.OPENAI_ASSISTANT_ID,
                thread: {
                    messages: [
                        {
                            role: 'user',
                            content: pergunta
                        }
                    ]
                }
            },
            { headers }
        );

        const threadId = runRes.data.thread_id;
        const runId = runRes.data.id;

        // 2. Aguarda a conclusão da execução
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
            msg.reply('Tive um problema para responder. Tenta novamente em instantes!');
            return;
        }

        // 3. Busca a resposta do assistente
        const mensagens = await axios.get(
            `https://api.openai.com/v1/threads/${threadId}/messages`,
            { headers }
        );

        const resposta = mensagens.data.data
            .reverse()
            .find(m => m.role === 'assistant')
            ?.content[0]?.text?.value;

        if (resposta) {
            msg.reply(resposta);
        } else {
            msg.reply('Desculpe, não consegui entender. Pode repetir?');
        }

    } catch (error) {
        console.error('Erro ao consultar o assistente:', error.response?.data || error.message);
        msg.reply("Oops! Tive um problema para responder agora. Tenta de novo já já.");
    }
});

client.initialize();
