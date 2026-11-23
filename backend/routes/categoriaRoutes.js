const express = require('express');
const router = express.Router();
const categoriaController = require('../controllers/categoriaController');

// Mapeamento das Rotas do CRUD de Categorias
router.get('/', categoriaController.listarCategorias);
router.get('/:id', categoriaController.buscarCategoriaPorId);
router.post('/', categoriaController.cadastrarCategoria);
router.put('/:id', categoriaController.atualizarCategoria);
router.delete('/:id', categoriaController.excluirCategoria);

module.exports = router;