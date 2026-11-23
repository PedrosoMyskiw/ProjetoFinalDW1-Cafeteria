/**
 * Middleware para verificar se o usuário está logado.
 */
function estáAutenticado(req, res, next) {
    if (req.session && req.session.usuario) {
        return next(); // Usuário autenticado, permite continuar para a rota
    }
    return res.status(401).json({ erro: 'Acesso não autorizado. Faça login para continuar.' });
}

/**
 * Middleware para verificar se o usuário é Administrador.
 */
function ehAdmin(req, res, next) {
    // Primeiro verifica se está logado
    if (!req.session || !req.session.usuario) {
        return res.status(401).json({ erro: 'Acesso não autorizado. Faça login para continuar.' });
    }

    // Em seguida verifica se a role/tipo é admin
    if (req.session.usuario.tipo === 'admin') {
        return next(); // É admin, autoriza o acesso
    }

    return res.status(403).json({ erro: 'Acesso negado. Recurso restrito a administradores.' });
}

module.exports = {
    estáAutenticado,
    ehAdmin
};