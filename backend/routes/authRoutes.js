const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { estáAutenticado, ehAdmin } = require('../middlewares/authMiddleware');

// Rotas públicas de Autenticação
router.post('/cadastro', authController.cadastrar);
router.post('/login', authController.login);

// Rotas de verificação e encerramento de sessão
router.get('/sessao', authController.obterSessao);
router.post('/logout', authController.logout);

// Exemplo de rota protegida exclusiva para Administradores
router.get('/admin/dashboard', ehAdmin, (req, res) => {
    res.json({ mensagem: 'Acesso autorizado ao painel do administrador!', admin: req.session.usuario });
});

module.exports = router;