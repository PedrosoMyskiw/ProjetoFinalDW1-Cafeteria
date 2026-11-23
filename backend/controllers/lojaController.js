const { query } = require('../database');

// 1. LISTAR PRODUTOS (COM FILTRO OPCIONAL POR CATEGORIA VIA QUERY ?categoria=ID)
exports.listarProdutos = async (req, res) => {
    try {
        const { categoria } = req.query;
        let queryTexto = `
            SELECT 
                p.id_produto,
                p.nome AS nome_produto,
                p.descricao,
                p.preco,
                p.quantidade_estoque,
                p.id_categoria,
                c.nome AS nome_categoria
            FROM produtos p 
            LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
        `;
        let params = [];

        if (categoria) {
            queryTexto += ` WHERE p.id_categoria = $1`;
            params.push(categoria);
        }

        queryTexto += ` ORDER BY p.id_produto ASC`;

        const result = await query(queryTexto, params);
        res.json(result.rows);
    } catch (err) {
        console.error('❌ Erro ao listar produtos da loja:', err.message);
        res.status(500).json({ erro: 'Erro ao buscar produtos no banco de dados.' });
    }
};

// 2. LISTAR CATEGORIAS PARA AS ABAS DA LOJA
exports.listarCategorias = async (req, res) => {
    try {
        const queryTexto = `
            SELECT 
                id_categoria,
                nome AS nome_categoria,
                descricao
            FROM categorias 
            ORDER BY id_categoria ASC
        `;
        const result = await query(queryTexto);
        res.json(result.rows);
    } catch (err) {
        console.error('❌ Erro ao listar categorias da loja:', err.message);
        res.status(500).json({ erro: 'Erro ao buscar categorias no banco de dados.' });
    }
};