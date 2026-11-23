const { query } = require('../database');

// 1. LISTAR TODAS AS CATEGORIAS (ORDEM CRESCENTE)
exports.listarCategorias = async (req, res) => {
    try {
        const queryTexto = `
            SELECT 
                c.id_categoria AS id_categoria,
                c.nome AS nome_categoria,
                c.descricao,
                COUNT(p.id_produto)::int AS total_produtos 
            FROM categorias c 
            LEFT JOIN produtos p ON c.id_categoria = p.id_categoria 
            GROUP BY c.id_categoria, c.nome, c.descricao
            ORDER BY c.id_categoria ASC
        `;
        const result = await query(queryTexto);
        res.json(result.rows);
    } catch (err) {
        console.error('❌ Erro na busca de categorias:', err.message);
        res.status(500).json({ erro: 'Erro ao buscar categorias.' });
    }
};

// 2. BUSCAR CATEGORIA POR ID
exports.buscarCategoriaPorId = async (req, res) => {
    const { id } = req.params;
    try {
        const queryTexto = `
            SELECT 
                id_categoria, 
                nome AS nome_categoria, 
                descricao 
            FROM categorias 
            WHERE id_categoria = $1
        `;
        const result = await query(queryTexto, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ sucesso: false, erro: 'Categoria não encontrada.' });
        }

        res.json({ sucesso: true, categoria: result.rows[0] });
    } catch (err) {
        console.error('❌ Erro ao buscar categoria:', err.message);
        res.status(500).json({ erro: 'Erro ao buscar categoria.' });
    }
};

// 3. CADASTRAR CATEGORIA (COM ID MANUAL)
exports.cadastrarCategoria = async (req, res) => {
    const { id_categoria, nome_categoria, descricao } = req.body;

    if (!id_categoria || !nome_categoria) {
        return res.status(400).json({ erro: 'ID e Nome da categoria são obrigatórios.' });
    }

    try {
        const queryTexto = `
            INSERT INTO categorias (id_categoria, nome, descricao) 
            VALUES ($1, $2, $3) 
            RETURNING id_categoria, nome AS nome_categoria, descricao
        `;
        const result = await query(queryTexto, [id_categoria, nome_categoria, descricao || '']);

        res.status(201).json({
            sucesso: true,
            mensagem: 'Categoria cadastrada com sucesso!',
            categoria: result.rows[0]
        });
    } catch (err) {
        console.error('❌ Erro ao cadastrar categoria:', err.message);
        res.status(500).json({ erro: 'Erro ao cadastrar categoria. Verifique se o ID já existe.' });
    }
};

// 4. ATUALIZAR CATEGORIA EXISTENTE
exports.atualizarCategoria = async (req, res) => {
    const { id } = req.params;
    const { nome_categoria, descricao } = req.body;

    if (!nome_categoria) {
        return res.status(400).json({ erro: 'Nome da categoria é obrigatório.' });
    }

    try {
        const queryTexto = `
            UPDATE categorias 
            SET nome = $1, descricao = $2 
            WHERE id_categoria = $3 
            RETURNING id_categoria, nome AS nome_categoria, descricao
        `;
        const result = await query(queryTexto, [nome_categoria, descricao || '', id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ erro: 'Categoria não encontrada.' });
        }

        res.json({
            sucesso: true,
            mensagem: 'Categoria atualizada com sucesso!',
            categoria: result.rows[0]
        });
    } catch (err) {
        console.error('❌ Erro ao atualizar categoria:', err.message);
        res.status(500).json({ erro: 'Erro ao atualizar categoria.' });
    }
};

// 5. EXCLUIR CATEGORIA
exports.excluirCategoria = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await query('DELETE FROM categorias WHERE id_categoria = $1 RETURNING id_categoria', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ erro: 'Categoria não encontrada.' });
        }

        res.json({ sucesso: true, mensagem: 'Categoria removida com sucesso!' });
    } catch (err) {
        console.error('❌ Erro ao excluir categoria:', err.message);
        res.status(500).json({ erro: 'Não é possível excluir uma categoria vinculada a produtos.' });
    }
};