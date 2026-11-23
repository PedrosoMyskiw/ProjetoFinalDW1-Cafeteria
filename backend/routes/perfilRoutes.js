const express = require('express');
const router = express.Router();
const perfilController = require('../controllers/perfilController');

router.get('/meu-perfil', perfilController.obterPerfil);
router.put('/meu-perfil', perfilController.atualizarPerfil);

module.exports = router;