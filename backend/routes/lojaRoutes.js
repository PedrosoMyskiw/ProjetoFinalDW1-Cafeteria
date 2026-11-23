const express = require('express');
const router = express.Router();
const lojaController = require('../controllers/lojaController');

// Endpoints da loja
router.get('/produtos', lojaController.listarProdutos);
router.get('/categorias', lojaController.listarCategorias);

module.exports = router;