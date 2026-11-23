const { pool } = require('../database');

/**
 * Busca os dados completos do perfil do usuário logado (Usuário + Cliente)
 */
exports.obterPerfil = async (req, res) => {
    if (!req.session || !req.session.usuario) {
        return res.status(401).json({ erro: 'Não autorizado. Faça login novamente.' });
    }

    const id_usuario = req.session.usuario.id || req.session.usuario.id_usuario;

    try {
        const queryTexto = `
            SELECT 
                u.id_usuario,
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
        `;

        const result = await pool.query(queryTexto, [id_usuario]);

        if (result.rows.length === 0) {
            return res.status(404).json({ erro: 'Usuário não encontrado.' });
        }

        return res.json(result.rows[0]);
    } catch (error) {
        console.error('❌ Erro ao buscar perfil do usuário:', error.message);
        return res.status(500).json({ erro: 'Erro interno ao buscar perfil.' });
    }
};

/**
 * ATUALIZAR DADOS DO PERFIL (Usuário + Cliente)
 */
exports.atualizarPerfil = async (req, res) => {
    if (!req.session || !req.session.usuario) {
        return res.status(401).json({ sucesso: false, erro: 'Você precisa estar logado.' });
    }

    const id_usuario = req.session.usuario.id || req.session.usuario.id_usuario;
    const { nome, telefone, cep, logradouro, numero, complemento, bairro, cidade, estado } = req.body;

    if (!nome || nome.trim() === '') {
        return res.status(400).json({ sucesso: false, erro: 'O nome é obrigatório.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Atualiza nome na tabela usuarios
        await client.query(
            'UPDATE usuarios SET nome = $1 WHERE id_usuario = $2',
            [nome.trim(), id_usuario]
        );

        // 2. Verifica usando a coluna real id_usuario (não existe id_cliente na tabela)
        const checkCliente = await client.query(
            'SELECT id_usuario FROM clientes WHERE id_usuario = $1',
            [id_usuario]
        );

        if (checkCliente.rows.length > 0) {
            await client.query(`
                UPDATE clientes 
                SET telefone = $1, cep = $2, logradouro = $3, numero = $4, 
                    complemento = $5, bairro = $6, cidade = $7, estado = $8
                WHERE id_usuario = $9
            `, [
                telefone || null,
                cep || null,
                logradouro || null,
                numero || null,
                complemento || null,
                bairro || null,
                cidade || null,
                estado ? estado.toUpperCase().slice(0, 2) : null,
                id_usuario
            ]);
        } else {
            await client.query(`
                INSERT INTO clientes (id_usuario, telefone, cep, logradouro, numero, complemento, bairro, cidade, estado)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [
                id_usuario,
                telefone || null,
                cep || null,
                logradouro || null,
                numero || null,
                complemento || null,
                bairro || null,
                cidade || null,
                estado ? estado.toUpperCase().slice(0, 2) : null
            ]);
        }

        await client.query('COMMIT');

        // Atualiza o nome na sessão atual
        req.session.usuario.nome = nome.trim();

        return res.json({
            sucesso: true,
            mensagem: 'Perfil atualizado com sucesso!'
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Erro ao atualizar perfil:', error.message);
        return res.status(500).json({ sucesso: false, erro: 'Erro interno ao atualizar perfil.' });
    } finally {
        client.release();
    }
};