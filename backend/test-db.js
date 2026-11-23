// backend/test-db.js
const { query, pool } = require('./database');

async function testarConexao() {
    console.log('🔄 Tentando conectar ao PostgreSQL...');
    try {
        // Consulta simples para buscar data/hora e nome do banco ativo
        const resultado = await query('SELECT NOW() AS data_atual, current_database() AS banco_atual');
        
        console.log('\n=================================');
        console.log('✅ TESTE DE CONEXÃO BEM-SUCEDIDO!');
        console.log(`📌 Banco Conectado: ${resultado.rows[0].banco_atual}`);
        console.log(`⏰ Data/Hora do Banco: ${resultado.rows[0].data_atual}`);
        console.log('=================================\n');
    } catch (erro) {
        console.error('\n=================================');
        console.error('❌ ERRO AO CONECTAR NO BANCO DE DADOS:');
        console.error(`Mensagem: ${erro.message}`);
        console.error('Dicas para solução:');
        console.error(' 1. O serviço do PostgreSQL está rodando?');
        console.error(' 2. O banco de dados "cafeteria" foi criado no PostgreSQL?');
        console.error(' 3. A senha do PostgreSQL no arquivo .env está correta?');
        console.log('=================================\n');
    } finally {
        // Fecha a piscina de conexões para encerrar o processo no terminal
        await pool.end();
    }
}

testarConexao();