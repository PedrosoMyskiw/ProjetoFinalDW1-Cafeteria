const express = require('express');
const router = express.Router();
const pedidoController = require('../controllers/pedidoController');

// Rota para o cliente listar os seus próprios pedidos
router.get('/meus-pedidos', pedidoController.listarMeusPedidos);
// Cancelar pedido pelo próprio cliente
router.patch('/meus-pedidos/:id/cancelar', pedidoController.cancelarMeuPedido);

// Criar novo pedido
router.post('/', pedidoController.criarPedido);

// Rotas Administrativas / Gerente
router.get('/admin/todos', pedidoController.listarTodosPedidosAdmin);
router.patch('/admin/:id/status', pedidoController.atualizarStatusPedido);

module.exports = router;