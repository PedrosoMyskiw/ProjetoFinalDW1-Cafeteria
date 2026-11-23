const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser'); // Habilita manipulação de cookies no Express
require('dotenv').config();

const { query } = require('./database');
const sessionConfig = require('./config/session');

// Importação das Rotas Modularizadas
const authRoutes = require('./routes/authRoutes');
const produtoRoutes = require('./routes/produtoRoutes');
const categoriaRoutes = require('./routes/categoriaRoutes');
const lojaRoutes = require('./routes/lojaRoutes');
const pedidoRoutes = require('./routes/pedidoRoutes');
const perfilRoutes = require('./routes/perfilRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

// ================================================
// MIDDLEWARES GLOBAIS
// ================================================

// 1. Configuração do CORS para permitir envio de Cookies (credentials: true)
app.use(cors({
    origin: ['http://127.0.0.1:5500', 'http://localhost:5500', 'http://localhost:3001'],
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Leitura de req.cookies para o sistema de autenticação por cookie

// 2. Configuração do Express Session (Lembrar usuário ao fechar aba)
app.use(sessionConfig);

// ================================================
// SERVIDOR DE ARQUIVOS ESTÁTICOS
// ================================================

// Rota de imagens estáticas (produtos e silhueta)
app.use('/imagens', express.static(path.resolve(__dirname, 'imagens')));

// Pasta principal de arquivos do Frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// ================================================
// MAPEAMENTO DAS ROTAS DA API
// ================================================
app.use('/api/auth', authRoutes);
app.use('/api/produtos', produtoRoutes);
app.use('/api/categorias', categoriaRoutes);
app.use('/api', lojaRoutes);
app.use('/api/pedidos', pedidoRoutes);
app.use('/api/perfil', perfilRoutes);

// ================================================
// RECUPERAÇÃO DE SENHA (NODEMAILER GMAIL SSL)
// ================================================
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const codigosRecuperacao = {};

app.post('/api/auth/solicitar-codigo', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ erro: 'Por favor, informe o e-mail.' });
    }

    try {
        const resultadoBD = await query('SELECT * FROM usuarios WHERE email = $1', [email]);
        if (resultadoBD.rows.length === 0) {
            return res.status(404).json({ erro: 'E-mail não encontrado no sistema.' });
        }

        const codigo = Math.floor(100000 + Math.random() * 900000).toString();
        codigosRecuperacao[email] = {
            codigo: codigo,
            expiraEm: Date.now() + 10 * 60 * 1000
        };

        const mailOptions = {
            from: `"Caffè D'Autore" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Código de Recuperação de Senha — Caffè D\'Autore',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 25px; background-color: #f8f3ed; color: #493629; border-radius: 12px; max-width: 500px; margin: 0 auto;">
                    <h2 style="font-family: 'Playfair Display', serif; color: #493629; text-align: center;">Caffè D'Autore</h2>
                    <p>Olá,</p>
                    <p>Você solicitou a redefinição de senha para a sua conta.</p>
                    <p>Utilize o código de verificação abaixo no site:</p>
                    <div style="background-color: #eee3d7; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #936342;">${codigo}</span>
                    </div>
                    <p style="font-size: 12px; color: #786b5f;">Este código expira em 10 minutos. Se não foi você quem solicitou, ignore esta mensagem.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);

        console.log(`\n✅ E-mail enviado com sucesso para: ${email}`);
        console.log(`🔑 Código gerado: ${codigo}\n`);

        res.json({ mensagem: 'Código enviado com sucesso para o seu e-mail!' });

    } catch (error) {
        console.error('❌ Erro no envio de e-mail:', error);

        if (error.code === 'EAUTH') {
            return res.status(500).json({ erro: 'Falha na autenticação do e-mail. Verifique a Senha de App no .env.' });
        }

        res.status(500).json({ erro: 'Não foi possível enviar o e-mail de verificação.' });
    }
});

app.post('/api/auth/redefinir-senha', async (req, res) => {
    const { email, codigo, novaSenha } = req.body;

    const registro = codigosRecuperacao[email];

    if (!registro || registro.codigo !== codigo || Date.now() > registro.expiraEm) {
        return res.status(400).json({ erro: 'Código de verificação inválido ou expirado.' });
    }

    if (!novaSenha || novaSenha.length < 8) {
        return res.status(400).json({ erro: 'A nova senha deve ter no mínimo 8 caracteres.' });
    }

    try {
        const hash = await bcrypt.hash(novaSenha, 10);
        await query('UPDATE usuarios SET senha_hash = $1 WHERE email = $2', [hash, email]);

        delete codigosRecuperacao[email];
        res.json({ mensagem: 'Senha alterada com sucesso!' });
    } catch (error) {
        console.error('❌ Erro ao redefinir senha no PostgreSQL:', error.message);
        res.status(500).json({ erro: 'Erro ao atualizar a senha no banco de dados.' });
    }
});

// ================================================
// LISTAGEM DE PEDIDOS
// ================================================
app.get('/api/pedidos', async (req, res) => {
    try {
        const queryTexto = `
            SELECT 
                p.id_pedido AS id,
                u.nome AS cliente_nome,
                p.data_pedido AS criado_em,
                p.status,
                p.valor_total,
                p.tipo_atendimento,
                p.numero_mesa
            FROM pedidos p 
            INNER JOIN usuarios u ON p.id_cliente = u.id_usuario 
            ORDER BY p.id_pedido ASC
        `;
        const result = await query(queryTexto);
        res.json(result.rows);
    } catch (err) {
        console.error('❌ Erro na busca de pedidos:', err.message);
        res.status(500).json({ erro: 'Erro ao buscar pedidos.' });
    }
});

// ================================================
// ROTAS DE PAGAMENTO PIX (QR CODE FUNCIONAL)
// ================================================
const pagamentosPixPendentes = new Map();

// 1. Retorna o IP real da máquina na rede Wi-Fi / Cabo (ignorando placas virtuais)
app.get('/api/pix/info-rede', (req, res) => {
    const interfaces = os.networkInterfaces();
    let ipEscolhido = null;

    for (const [nome, lista] of Object.entries(interfaces)) {
        if (/vethernet|wsl|virtual|vmware|vbox|docker/i.test(nome)) continue;

        for (const iface of lista) {
            if (iface.family === 'IPv4' && !iface.internal) {
                if (iface.address.startsWith('192.168.') || iface.address.startsWith('10.')) {
                    ipEscolhido = iface.address;
                    break;
                }
                if (!ipEscolhido) ipEscolhido = iface.address;
            }
        }
        if (ipEscolhido && ipEscolhido.startsWith('192.168.')) break;
    }

    res.json({ ip: ipEscolhido || 'localhost', porta: Number(PORT) });
});

// 2. Rota acessada pelo CELULAR quando a câmera lê o QR Code
app.get('/api/pix/confirmar/:codigoPix', (req, res) => {
    const { codigoPix } = req.params;
    const valor = req.query.valor || '0.00';

    pagamentosPixPendentes.set(codigoPix, {
        pago: true,
        confirmadoEm: new Date().toISOString()
    });

    console.log(`✅ PIX confirmado pelo celular: ${codigoPix} (R$ ${valor})`);

    res.send(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>PIX Confirmado | Caffè D'Autore</title>
            <style>
                body {
                    margin: 0;
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #f8f4ed;
                    font-family: Arial, sans-serif;
                    color: #38251c;
                    padding: 20px;
                    text-align: center;
                }
                .card {
                    background: #fffdfa;
                    border: 1px solid #e5d8ca;
                    border-radius: 16px;
                    padding: 32px 24px;
                    max-width: 360px;
                    box-shadow: 0 8px 24px rgba(56, 37, 28, 0.08);
                }
                .icon { font-size: 52px; margin-bottom: 12px; }
                h1 { font-size: 22px; margin: 0 0 10px; color: #225c37; }
                p { font-size: 14px; color: #5b3928; line-height: 1.5; }
                .valor { font-size: 20px; font-weight: bold; margin: 16px 0; color: #38251c; }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="icon">✅</div>
                <h1>PIX Confirmado!</h1>
                <div class="valor">R$ ${Number(valor).toFixed(2).replace('.', ',')}</div>
                <p>Leitura realizada com sucesso na <strong>Caffè D'Autore</strong>.</p>
                <p>O botão <strong>Finalizar Pedido</strong> já foi liberado na tela do computador.</p>
            </div>
        </body>
        </html>
    `);
});

// 3. Rota consultada automaticamente pelo COMPUTADOR a cada 2 segundos
app.get('/api/pix/status/:codigoPix', (req, res) => {
    const { codigoPix } = req.params;
    const registro = pagamentosPixPendentes.get(codigoPix);

    res.json({
        pago: Boolean(registro && registro.pago)
    });
});

// ================================================
// HEALTH CHECK & INICIALIZAÇÃO
// ================================================
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', mensagem: 'API Caffè D\'Autore operando!' });
});

app.listen(PORT, '0.0.0.0', async () => {
    console.log(`\n=================================`);
    console.log(`☕ Caffè D'Autore Server rodando na porta ${PORT}`);
    try {
        await query('SELECT NOW()');
        console.log(`✅ Banco de Dados '${process.env.DB_NAME}' conectado com sucesso!`);
    } catch (error) {
        console.error(`❌ FALHA NA CONEXÃO COM O BANCO DE DADOS: ${error.message}`);
    }
    console.log(`=================================\n`);
});