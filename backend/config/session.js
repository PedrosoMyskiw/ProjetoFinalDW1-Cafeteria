const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { pool } = require('../database');

// Duração de 7 dias (em milissegundos)
const SETE_DIAS = 7 * 24 * 60 * 60 * 1000;

/**
 * Configuração da sessão utilizando PostgreSQL (connect-pg-simple)
 */
const sessionConfig = session({
    store: new pgSession({
        pool: pool,                  // Conexão do database.js
        tableName: 'session',        // Tabela onde as sessões serão salvas no PostgreSQL
        createTableIfMissing: true,  // Cria a tabela no banco automaticamente
        ttl: 7 * 24 * 60 * 60        // Tempo de vida da sessão no PostgreSQL (7 dias em segundos)
    }),
    name: 'caffe.sid',               // Nome padronizado do cookie
    secret: process.env.SESSION_SECRET || 'chave_secreta_padrao_caffe_d_autore',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: SETE_DIAS,           // 7 dias de persistência após fechar a aba
        httpOnly: true,              // Proteção contra ataques XSS
        secure: false,               // Mantido 'false' para ambiente local (HTTP)
        sameSite: 'lax'              // Permite navegação fluida entre origens locais
    }
});

module.exports = sessionConfig;