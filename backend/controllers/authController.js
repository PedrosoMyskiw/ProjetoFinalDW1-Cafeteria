const bcrypt = require('bcrypt');
const { query, pool } = require('../database');

// Constante para definir a duração do cookie (ex: 7 dias em milissegundos)
const DURACAO_COOKIE = 7 * 24 * 60 * 60 * 1000;

/**
 * Cadastro de novo Cliente com Endereço Detalhado
 */
async function cadastrar(req, res) {
    const { 
        nome, email, senha, confirmarSenha, telefone, 
        cep, logradouro, numero, complemento, bairro, cidade, estado 
    } = req.body;

    // 1. Validações de campos obrigatórios
    if (!nome || !email || !senha || !confirmarSenha) {
        return res.status(400).json({ erro: 'Preencha todos os campos obrigatórios.' });
    }

    if (senha.length < 8) {
        return res.status(400).json({ erro: 'A senha deve ter no mínimo 8 caracteres.' });
    }

    if (senha !== confirmarSenha) {
        return res.status(400).json({ erro: 'A senha e a confirmação de senha não coincidem.' });
    }

    const client = await pool.connect();

    try {
        // 2. Verificar se o e-mail já existe
        const usuarioExistente = await client.query(
            'SELECT id_usuario FROM usuarios WHERE email = $1',
            [email.toLowerCase().trim()]
        );

        if (usuarioExistente.rows.length > 0) {
            client.release();
            return res.status(400).json({ erro: 'O e-mail informado já está cadastrado.' });
        }

        // 3. Hash da senha
        const saltRounds = 10;
        const senhaHash = await bcrypt.hash(senha, saltRounds);

        // 4. Início da Transação SQL
        await client.query('BEGIN');

        // Inserir na tabela usuarios (Padrão: tipo 'cliente')
        const insertUsuarioQuery = `
            INSERT INTO usuarios (nome, email, senha_hash, tipo)
            VALUES ($1, $2, $3, $4)
            RETURNING id_usuario, nome, email, tipo
        `;
        const resUsuario = await client.query(insertUsuarioQuery, [
            nome.trim(),
            email.toLowerCase().trim(),
            senhaHash,
            'cliente'
        ]);

        const novoUsuario = resUsuario.rows[0];

        // Inserir na tabela clientes com endereço detalhado
        const insertClienteQuery = `
            INSERT INTO clientes (
                id_usuario, telefone, cep, logradouro, numero, complemento, bairro, cidade, estado
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `;
        await client.query(insertClienteQuery, [
            novoUsuario.id_usuario,
            telefone ? telefone.trim() : null,
            cep ? cep.trim() : null,
            logradouro ? logradouro.trim() : null,
            numero ? numero.trim() : null,
            complemento ? complemento.trim() : null,
            bairro ? bairro.trim() : null,
            cidade ? cidade.trim() : null,
            estado ? estado.trim().toUpperCase() : null
        ]);

        await client.query('COMMIT');

        return res.status(201).json({
            mensagem: 'Cadastro realizado com sucesso!',
            usuario: {
                id: novoUsuario.id_usuario,
                nome: novoUsuario.nome,
                email: novoUsuario.email,
                tipo: novoUsuario.tipo
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro no cadastro:', error);
        return res.status(500).json({ erro: 'Erro interno ao realizar cadastro. Tente novamente.' });
    } finally {
        client.release();
    }
}

/**
 * Autenticação / Login de Usuários com Geração e Persistência de Cookies
 */
async function login(req, res) {
    const { email, senha } = req.body;

    if (!email || !senha) {
        return res.status(400).json({ erro: 'Informe e-mail e senha.' });
    }

    try {
        // 1. Buscar usuário no PostgreSQL pelo e-mail
        const result = await query(
            'SELECT id_usuario, nome, email, senha_hash, tipo FROM usuarios WHERE email = $1',
            [email.toLowerCase().trim()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
        }

        const usuario = result.rows[0];

        // 2. Comparar a senha digitada com o hash salvo no banco
        const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);

        if (!senhaValida) {
            return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
        }

        // 3. Regenerar o ID da sessão antes de autenticar (Prevenção contra Session Fixation)
        req.session.regenerate((err) => {
            if (err) {
                console.error('Erro ao regenerar sessão:', err);
                return res.status(500).json({ erro: 'Erro ao processar login.' });
            }

            // Configura o tempo de vida do cookie de sessão para persistir após fechar o navegador
            req.session.cookie.maxAge = DURACAO_COOKIE;

            // Salvar dados do usuário na sessão
            req.session.usuario = {
                id: usuario.id_usuario,
                nome: usuario.nome,
                email: usuario.email,
                tipo: usuario.tipo || 'cliente'
            };

            // [OPCIONAL / EXIGÊNCIA ACADÊMICA] Criação de cookie explícito diretamente na resposta HTTP
            res.cookie('usuario_logado', usuario.id_usuario, {
                maxAge: DURACAO_COOKIE,
                httpOnly: true,
                sameSite: 'lax',
                secure: false // Altere para true apenas se utilizar protocolo HTTPS
            });

            // Retorna o objeto usuario contendo 'tipo' para o frontend ler no loja.js
            return res.json({
                mensagem: 'Login realizado com sucesso!',
                usuario: req.session.usuario
            });
        });

    } catch (error) {
        console.error('Erro no login:', error);
        return res.status(500).json({ erro: 'Erro interno ao realizar login.' });
    }
}

/**
 * Verifica o status da sessão e retorna os dados completos do usuário e endereço
 */
async function obterSessao(req, res) {
    if (req.session && req.session.usuario) {
        try {
            // Busca os dados cadastrais atualizados do cliente + endereço
            const result = await query(`
                SELECT 
                    u.id_usuario AS id,
                    u.nome,
                    u.email,
                    u.tipo,
                    c.telefone,
                    c.cep,
                    c.logradouro,
                    c.numero,
                    c.complemento,
                    c.bairro,
                    c.cidade,
                    c.estado
                FROM usuarios u
                LEFT JOIN clientes c ON u.id_usuario = c.id_usuario
                WHERE u.id_usuario = $1
            `, [req.session.usuario.id]);

            const usuarioCompleto = result.rows.length > 0 ? result.rows[0] : req.session.usuario;

            return res.json({
                autenticado: true,
                usuario: usuarioCompleto
            });
        } catch (error) {
            console.error('Erro ao obter sessão completa:', error);
            return res.json({
                autenticado: true,
                usuario: req.session.usuario
            });
        }
    }
    return res.status(401).json({ autenticado: false, mensagem: 'Nenhuma sessão ativa encontrada.' });
}
/**
 * Realiza o Logout e limpa todos os cookies de sessão do navegador
 */
function logout(req, res) {
    if (req.session) {
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({ erro: 'Não foi possível encerrar a sessão.' });
            }

            // Limpa o cookie de sessão do express-session
            res.clearCookie('caffe.sid');

            // Limpa o cookie direto (caso utilizado)
            res.clearCookie('usuario_logado');

            return res.json({ mensagem: 'Logout realizado com sucesso.' });
        });
    } else {
        res.clearCookie('caffe.sid');
        res.clearCookie('usuario_logado');
        return res.json({ mensagem: 'Sessão encerrada.' });
    }
}

module.exports = {
    cadastrar,
    login,
    obterSessao,
    logout
};