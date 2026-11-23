const { query } = require('../database');

/**
 * 1. LISTAR PRODUTOS (Com suporte a filtro por query string ?categoria=ID)
 */
exports.listarProdutos = async (req, res) => {
    const { categoria } = req.query;

    try {
        let queryTexto = `
            SELECT 
                p.id_produto, 
                p.nome AS nome_produto, 
                p.descricao,
                p.preco, 
                p.quantidade_estoque,
                p.imagem,
                p.disponivel, 
                p.id_categoria, 
                c.nome AS nome_categoria
            FROM produtos p
            LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
            WHERE p.disponivel = TRUE
        `;
        
        const params = [];

        if (categoria && !isNaN(categoria)) {
            queryTexto += ` AND p.id_categoria = $1`;
            params.push(parseInt(categoria, 10));
        }

        queryTexto += ` ORDER BY p.id_produto ASC`;

        const result = await query(queryTexto, params);
        const linhas = result ? (result.rows || result) : [];

        return res.json(linhas);
    } catch (error) {
        console.error("❌ Erro ao buscar produtos:", error.message);
        return res.status(500).json({ erro: "Erro interno ao buscar produtos." });
    }
};

/**
 * 2. BUSCAR PRODUTO POR ID
 */
exports.buscarProdutoPorId = async (req, res) => {
    const { id } = req.params;
    try {
        const queryTexto = `
            SELECT 
                p.id_produto,
                p.nome AS nome_produto,
                p.descricao,
                p.preco,
                p.quantidade_estoque,
                p.imagem,
                p.disponivel,
                p.id_categoria
            FROM produtos p 
            WHERE p.id_produto = $1
        `;
        const result = await query(queryTexto, [id]);
        const linhas = result ? (result.rows || result) : [];

        if (linhas.length === 0) {
            return res.status(404).json({ sucesso: false, erro: 'Produto não encontrado.' });
        }

        res.json({ sucesso: true, produto: linhas[0] });
    } catch (err) {
        console.error('❌ Erro ao buscar produto:', err.message);
        res.status(500).json({ sucesso: false, erro: 'Erro ao buscar o produto.' });
    }
};

/**
 * 3. CADASTRAR PRODUTO (Inclui quantidade_estoque e suporte a id_produto manual)
 */
exports.cadastrarProduto = async (req, res) => {
    const { id_produto, id_categoria, nome_produto, preco, quantidade_estoque, descricao, imagem } = req.body;

    if (!nome_produto || preco === undefined || !id_categoria) {
        return res.status(400).json({ erro: 'Nome, preço e categoria são obrigatórios.' });
    }

    const estoqueInicial = quantidade_estoque !== undefined ? parseInt(quantidade_estoque, 10) : 0;

    try {
        let queryTexto;
        let params;

        // Como a sequence de id_produto foi removida no seu script SQL, aceita id_produto manual se enviado
        if (id_produto !== undefined && id_produto !== null && id_produto !== '') {
            queryTexto = `
                INSERT INTO produtos (id_produto, id_categoria, nome, descricao, preco, quantidade_estoque, imagem, disponivel) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE) 
                RETURNING id_produto, nome AS nome_produto, preco, quantidade_estoque, disponivel
            `;
            params = [
                parseInt(id_produto, 10),
                id_categoria,
                nome_produto,
                descricao || '',
                preco,
                estoqueInicial,
                imagem || ''
            ];
        } else {
            queryTexto = `
                INSERT INTO produtos (id_categoria, nome, descricao, preco, quantidade_estoque, imagem, disponivel) 
                VALUES ($1, $2, $3, $4, $5, $6, TRUE) 
                RETURNING id_produto, nome AS nome_produto, preco, quantidade_estoque, disponivel
            `;
            params = [
                id_categoria,
                nome_produto,
                descricao || '',
                preco,
                estoqueInicial,
                imagem || ''
            ];
        }

        const result = await query(queryTexto, params);
        const linhas = result ? (result.rows || result) : [];

        res.status(201).json({
            sucesso: true,
            mensagem: 'Produto cadastrado com sucesso!',
            produto: linhas[0]
        });
    } catch (err) {
        console.error('❌ Erro ao cadastrar produto:', err.message);
        res.status(500).json({ erro: 'Erro ao cadastrar produto no banco. Verifique se o ID já existe.' });
    }
};

/**
 * 4. ATUALIZAR PRODUTO EXISTENTE (Inclui quantidade_estoque)
 */
exports.atualizarProduto = async (req, res) => {
    const { id } = req.params;
    const { nome_produto, preco, id_categoria, quantidade_estoque, descricao, imagem, disponivel } = req.body;

    try {
        const queryTexto = `
            UPDATE produtos 
            SET 
                nome = $1, 
                preco = $2, 
                id_categoria = $3, 
                quantidade_estoque = COALESCE($4, quantidade_estoque),
                descricao = $5, 
                imagem = COALESCE($6, imagem), 
                disponivel = $7
            WHERE id_produto = $8
            RETURNING id_produto, nome AS nome_produto, preco, quantidade_estoque, disponivel
        `;
        const isDisponivel = disponivel !== undefined ? disponivel : true;
        const estoqueAtualizado = (quantidade_estoque !== undefined && quantidade_estoque !== '') 
            ? parseInt(quantidade_estoque, 10) 
            : null;

        const result = await query(queryTexto, [
            nome_produto, 
            preco, 
            id_categoria, 
            estoqueAtualizado,
            descricao || '', 
            imagem !== undefined ? imagem : null,
            isDisponivel,
            id
        ]);
        const linhas = result ? (result.rows || result) : [];

        if (linhas.length === 0) {
            return res.status(404).json({ erro: 'Produto não encontrado.' });
        }

        res.json({ sucesso: true, mensagem: 'Produto atualizado com sucesso!', produto: linhas[0] });
    } catch (err) {
        console.error('❌ Erro ao atualizar produto:', err.message);
        res.status(500).json({ erro: 'Erro ao atualizar o produto.' });
    }
};

/**
 * 5. EXCLUIR PRODUTO
 */
exports.excluirProduto = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await query('DELETE FROM produtos WHERE id_produto = $1 RETURNING id_produto', [id]);
        const linhas = result ? (result.rows || result) : [];

        if (linhas.length === 0) {
            return res.status(404).json({ erro: 'Produto não encontrado.' });
        }

        res.json({ sucesso: true, mensagem: 'Produto removido com sucesso!' });
    } catch (err) {
        console.error('❌ Erro ao excluir produto:', err.message);
        res.status(500).json({ erro: 'Não foi possível excluir o produto. Verifique vínculos com pedidos.' });
    }
};