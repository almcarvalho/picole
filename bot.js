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

    try {
        const resposta = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: process.env.GPT_CUSTOM_ID,
                messages: [{ role: 'user', content: pergunta }],
                temperature: 0.7
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const respostaTexto = resposta.data.choices[0].message.content;
        msg.reply(respostaTexto);
    } catch (error) {
        console.error('Erro ao consultar o GPT:', error.response?.data || error.message);
        msg.reply("Oops! Tive um problema para responder agora. Tenta de novo já já.");
    }
});

client.initialize();
