const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const produtoController = require('../controllers/produtoController');

// Configuração de armazenamento do Multer (Salva na pasta 'backend/imagens' com nome <ID>.png)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../imagens'));
    },
    filename: (req, file, cb) => {
        const idProduto = req.params.id;
        cb(null, `${idProduto}.png`);
    }
});

const upload = multer({ storage: storage });

// Rotas CRUD do Produto
router.get('/', produtoController.listarProdutos);
router.get('/:id', produtoController.buscarProdutoPorId);
router.post('/', produtoController.cadastrarProduto);
router.put('/:id', produtoController.atualizarProduto);
router.delete('/:id', produtoController.excluirProduto);

// Rota de Upload da Imagem por ID (Ex: POST /api/produtos/upload/11)
router.post('/upload/:id', upload.single('imagem'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ erro: 'Nenhum arquivo enviado.' });
    }
    res.json({ mensagem: 'Imagem salva com sucesso!', caminho: `/imagens/${req.file.filename}` });
});

module.exports = router;