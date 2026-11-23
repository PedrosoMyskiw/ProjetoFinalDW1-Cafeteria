const { pool } = require('../database');

/**
 * 1. CRIAR UM NOVO PEDIDO (CLIENTE)
 * Valida sessão, garante registro em clientes, trava estoque (FOR UPDATE), abate,
 * registra o pagamento na tabela `pagamentos` e confirma tudo em transação.
 */
exports.criarPedido = async (req, res) => {
    if (!req.session || !req.session.usuario) {
        return res.status(401).json({ 
            sucesso: false, 
            erro: '🔒 Você precisa estar logado para realizar um pedido.' 
        });
    }

    const id_cliente = req.session.usuario.id || req.session.usuario.id_usuario;
    const {
        itens,
        tipo_atendimento,
        numero_mesa,
        forma_pagamento,
        codigo_pix,
        final_cartao,
        troco_para
    } = req.body;

    if (!itens || !Array.isArray(itens) || itens.length === 0) {
        return res.status(400).json({ sucesso: false, erro: 'O carrinho está vazio.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Garante que o usuário exista na tabela clientes antes de inserir em pedidos (FK fk_pedido_cliente)
        await client.query(
            'INSERT INTO clientes (id_usuario) VALUES ($1) ON CONFLICT (id_usuario) DO NOTHING',
            [id_cliente]
        );

        let valorTotal = 0;
        const itensValidados = [];

        // Trava as linhas dos produtos (FOR UPDATE) e valida estoque suficiente
        for (const item of itens) {
            const idProd = item.id_produto || item.id;
            const prodResult = await client.query(
                'SELECT id_produto, nome, preco, quantidade_estoque, disponivel FROM produtos WHERE id_produto = $1 FOR UPDATE',
                [idProd]
            );

            if (prodResult.rows.length === 0) {
                throw new Error(`Produto ID ${idProd} não foi encontrado.`);
            }

            const produtoBD = prodResult.rows[0];

            if (!produtoBD.disponivel || item.quantidade > produtoBD.quantidade_estoque) {
                throw new Error(`Estoque insuficiente para "${produtoBD.nome}". Disponível: ${produtoBD.quantidade_estoque} un.`);
            }

            const subtotal = Number(produtoBD.preco) * item.quantidade;
            valorTotal += subtotal;

            itensValidados.push({
                id_produto: produtoBD.id_produto,
                quantidade: item.quantidade,
                preco_unitario: produtoBD.preco
            });
        }

        // Registra cabeçalho do pedido
        const atendimentoFinal = tipo_atendimento || 'retirada';
        const mesaFinal = atendimentoFinal === 'local' ? Number(numero_mesa) : null;

        const insertPedidoQuery = `
            INSERT INTO pedidos (id_cliente, valor_total, status, tipo_atendimento, numero_mesa, data_pedido)
            VALUES ($1, $2, 'pendente', $3, $4, NOW())
            RETURNING id_pedido, valor_total, status, data_pedido
        `;
        const resPedido = await client.query(insertPedidoQuery, [
            id_cliente,
            valorTotal,
            atendimentoFinal,
            mesaFinal
        ]);

        const novoPedido = resPedido.rows[0];

        // Insere os itens e abate a quantidade do estoque
        for (const item of itensValidados) {
            await client.query(
                `INSERT INTO itens_pedido (id_pedido, id_produto, quantidade, preco_unitario)
                 VALUES ($1, $2, $3, $4)`,
                [novoPedido.id_pedido, item.id_produto, item.quantidade, item.preco_unitario]
            );

            await client.query(
                `UPDATE produtos SET quantidade_estoque = quantidade_estoque - $1 WHERE id_produto = $2`,
                [item.quantidade, item.id_produto]
            );
        }

        // Normaliza a forma de pagamento para respeitar o CHECK ('pix', 'credito', 'debito', 'dinheiro')
        const mapaPagamento = {
            pix: 'pix',
            cartao_credito: 'credito',
            credito: 'credito',
            cartao_debito: 'debito',
            debito: 'debito',
            dinheiro: 'dinheiro'
        };

        const formaPagamentoDb = mapaPagamento[forma_pagamento] || 'dinheiro';
        const statusPagamentoDb = formaPagamentoDb === 'dinheiro' ? 'pendente' : 'aprovado';

        // Registra o pagamento vinculado ao pedido
        await client.query(
            `INSERT INTO pagamentos (
                id_pedido, forma_pagamento, status, valor, codigo_pix, final_cartao, troco_para
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                novoPedido.id_pedido,
                formaPagamentoDb,
                statusPagamentoDb,
                valorTotal,
                formaPagamentoDb === 'pix' ? (codigo_pix || null) : null,
                (formaPagamentoDb === 'credito' || formaPagamentoDb === 'debito') ? (final_cartao || null) : null,
                formaPagamentoDb === 'dinheiro' && troco_para ? Number(troco_para) : null
            ]
        );

        await client.query('COMMIT');

        return res.status(201).json({
            sucesso: true,
            mensagem: 'Pedido realizado com sucesso!',
            pedido: novoPedido
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Erro no checkout:', error.message);
        return res.status(400).json({ sucesso: false, erro: error.message });
    } finally {
        client.release();
    }
};

/**
 * 2. LISTAR TODOS OS PEDIDOS (PAINEL GERENTE / ADMIN)
 */
exports.listarTodosPedidosAdmin = async (req, res) => {
    if (!req.session || !req.session.usuario || req.session.usuario.tipo !== 'admin') {
        return res.status(403).json({ erro: 'Acesso negado. Requer privilégios de Administrador.' });
    }

    try {
        const queryTexto = `
            SELECT 
                p.id_pedido,
                p.data_pedido,
                p.valor_total,
                p.status,
                p.tipo_atendimento,
                p.numero_mesa,
                u.nome AS nome_cliente,
                u.email AS email_cliente,
                pg.forma_pagamento,
                pg.status AS status_pagamento,
                pg.codigo_pix,
                pg.final_cartao,
                pg.troco_para,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id_produto', ip.id_produto,
                            'nome_produto', pr.nome,
                            'quantidade', ip.quantidade,
                            'preco_unitario', ip.preco_unitario
                        )
                    ) FILTER (WHERE ip.id_item IS NOT NULL), '[]'
                ) AS itens
            FROM pedidos p
            INNER JOIN usuarios u ON p.id_cliente = u.id_usuario
            LEFT JOIN pagamentos pg ON p.id_pedido = pg.id_pedido
            LEFT JOIN itens_pedido ip ON p.id_pedido = ip.id_pedido
            LEFT JOIN produtos pr ON ip.id_produto = pr.id_produto
            GROUP BY 
                p.id_pedido, 
                u.nome, 
                u.email, 
                pg.forma_pagamento, 
                pg.status, 
                pg.codigo_pix, 
                pg.final_cartao, 
                pg.troco_para
            ORDER BY p.id_pedido DESC
        `;
        
        const result = await pool.query(queryTexto);
        return res.json(result.rows);
    } catch (error) {
        console.error('❌ Erro ao buscar pedidos do gerente:', error.message);
        return res.status(500).json({ erro: 'Erro interno ao buscar lista de pedidos.' });
    }
};

/**
 * 3. ATUALIZAR STATUS DO PEDIDO (GERENTE)
 * Se o gerente mudar o status para 'cancelado', estorna automaticamente os itens ao estoque.
 */
exports.atualizarStatusPedido = async (req, res) => {
    if (!req.session || !req.session.usuario || req.session.usuario.tipo !== 'admin') {
        return res.status(403).json({ erro: 'Acesso negado.' });
    }

    const { id } = req.params;
    let { status } = req.body;

    // Normaliza 'em preparo' para 'em_preparacao' caso o frontend envie com espaço
    if (status === 'em preparo') status = 'em_preparacao';

    const statusValidos = ['pendente', 'em_preparacao', 'pronto', 'concluido', 'cancelado'];

    if (!status || !statusValidos.includes(status)) {
        return res.status(400).json({ erro: 'Status inválido informado.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Busca o status atual travando a linha para evitar estorno duplicado
        const pedidoAtual = await client.query(
            'SELECT id_pedido, status FROM pedidos WHERE id_pedido = $1 FOR UPDATE',
            [id]
        );

        if (pedidoAtual.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ erro: 'Pedido não encontrado.' });
        }

        const statusAnterior = pedidoAtual.rows[0].status;

        const result = await client.query(
            'UPDATE pedidos SET status = $1 WHERE id_pedido = $2 RETURNING id_pedido, status',
            [status, id]
        );

        // Se o pedido foi concluído, marca o pagamento em dinheiro (se pendente) como aprovado
        if (status === 'concluido') {
            await client.query(
                `UPDATE pagamentos SET status = 'aprovado', data_pagamento = NOW()
                 WHERE id_pedido = $1 AND status = 'pendente'`,
                [id]
            );
        }

        // Se o pedido foi cancelado agora (e não estava cancelado antes), estorna o estoque
        if (status === 'cancelado' && statusAnterior !== 'cancelado') {
            const resItens = await client.query(
                'SELECT id_produto, quantidade FROM itens_pedido WHERE id_pedido = $1',
                [id]
            );

            for (const item of resItens.rows) {
                await client.query(
                    'UPDATE produtos SET quantidade_estoque = quantidade_estoque + $1 WHERE id_produto = $2',
                    [item.quantidade, item.id_produto]
                );
            }

            await client.query(
                `UPDATE pagamentos SET status = 'recusado' WHERE id_pedido = $1`,
                [id]
            );
        }

        await client.query('COMMIT');

        return res.json({ 
            sucesso: true, 
            mensagem: `Status do pedido #${id} alterado para "${status}".`,
            pedido: result.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Erro ao atualizar status do pedido:', error.message);
        return res.status(500).json({ erro: 'Erro interno ao atualizar status do pedido.' });
    } finally {
        client.release();
    }
};

/**
 * 4. LISTAR PEDIDOS DO CLIENTE LOGADO COM ITENS COMPRADOS
 */
exports.listarMeusPedidos = async (req, res) => {
    if (!req.session || !req.session.usuario) {
        return res.status(401).json({ erro: 'Você precisa estar logado.' });
    }

    const id_cliente = req.session.usuario.id || req.session.usuario.id_usuario;

    try {
        const queryTexto = `
            SELECT 
                p.id_pedido, 
                p.data_pedido, 
                p.valor_total, 
                p.status, 
                p.tipo_atendimento,
                pg.forma_pagamento,
                pg.status AS status_pagamento,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id_produto', ip.id_produto,
                            'nome_produto', pr.nome,
                            'quantidade', ip.quantidade,
                            'preco_unitario', ip.preco_unitario
                        )
                    ) FILTER (WHERE ip.id_item IS NOT NULL), '[]'
                ) AS itens
            FROM pedidos p
            LEFT JOIN pagamentos pg ON p.id_pedido = pg.id_pedido
            LEFT JOIN itens_pedido ip ON p.id_pedido = ip.id_pedido
            LEFT JOIN produtos pr ON ip.id_produto = pr.id_produto
            WHERE p.id_cliente = $1
            GROUP BY p.id_pedido, pg.forma_pagamento, pg.status
            ORDER BY p.id_pedido DESC
        `;
        const result = await pool.query(queryTexto, [id_cliente]);
        return res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar meus pedidos:', error.message);
        return res.status(500).json({ erro: 'Erro interno ao carregar seus pedidos.' });
    }
};

/**
 * 5. CANCELAR PEDIDO PELO CLIENTE (Apenas status 'pendente') + ESTORNO DE ESTOQUE
 */
exports.cancelarMeuPedido = async (req, res) => {
    if (!req.session || !req.session.usuario) {
        return res.status(401).json({ sucesso: false, erro: 'Você precisa estar logado.' });
    }

    const { id } = req.params;
    const id_cliente = req.session.usuario.id || req.session.usuario.id_usuario;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Trava a linha e verifica se pertence ao cliente e está 'pendente'
        const result = await client.query(
            `UPDATE pedidos 
             SET status = 'cancelado' 
             WHERE id_pedido = $1 AND id_cliente = $2 AND status = 'pendente'
             RETURNING id_pedido, status`,
            [id, id_cliente]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                sucesso: false, 
                erro: 'Não foi possível cancelar. O pedido não foi encontrado ou já mudou de status.' 
            });
        }

        // Busca os itens do pedido cancelado e devolve ao estoque
        const resItens = await client.query(
            'SELECT id_produto, quantidade FROM itens_pedido WHERE id_pedido = $1',
            [id]
        );

        for (const item of resItens.rows) {
            await client.query(
                'UPDATE produtos SET quantidade_estoque = quantidade_estoque + $1 WHERE id_produto = $2',
                [item.quantidade, item.id_produto]
            );
        }

        await client.query(
            `UPDATE pagamentos SET status = 'recusado' WHERE id_pedido = $1`,
            [id]
        );

        await client.query('COMMIT');

        return res.json({
            sucesso: true,
            mensagem: `Pedido #${id} cancelado e itens devolvidos ao estoque com sucesso.`,
            pedido: result.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Erro ao cancelar pedido pelo cliente:', error.message);
        return res.status(500).json({ sucesso: false, erro: 'Erro interno ao tentar cancelar o pedido.' });
    } finally {
        client.release();
    }
};