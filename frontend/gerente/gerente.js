/* ==========================================================================
   PAINEL DO GERENTE - VISÃO GERAL / DASHBOARD (gerente.js)
   ========================================================================== */

const URL_API = `${window.location.protocol}//${window.location.hostname}:3001`;

// Verificação de permissão no carregamento
(function verificarPermissao() {
    const usuarioLogado = JSON.parse(localStorage.getItem('usuario_logado'));

    if (!usuarioLogado) {
        window.location.href = '../login/login.html';
        return;
    }

    const tipo = (usuarioLogado.tipo || usuarioLogado.cargo || '').toLowerCase();
    if (tipo !== 'admin' && tipo !== 'gerente') {
        alert('Acesso restrito a administradores.');
        window.location.href = '../loja/loja.html';
    }
})();

// Inicializa o Dashboard
document.addEventListener("DOMContentLoaded", async () => {
    await inicializar();
});

async function inicializar() {
    carregarUsuarioSidebar();
    await carregarDashboard();
}

function carregarUsuarioSidebar() {
    const usuarioLogado = JSON.parse(localStorage.getItem('usuario_logado'));
    if (usuarioLogado) {
        const nomeEl = document.getElementById("sidebar-nome-usuario");
        const cargoEl = document.getElementById("sidebar-cargo-usuario");
        const avatarEl = document.getElementById("sidebar-avatar");

        if (nomeEl) nomeEl.textContent = usuarioLogado.nome || "Gerente";
        if (cargoEl) cargoEl.textContent = usuarioLogado.tipo || "Administrador";
        if (avatarEl && usuarioLogado.nome) {
            avatarEl.textContent = usuarioLogado.nome.charAt(0).toUpperCase();
        }
    }
}

async function carregarDashboard() {
    try {
        const [resProdutos, resCategorias, resPedidos] = await Promise.all([
            fetch(`${URL_API}/api/produtos`, { credentials: 'include' }),
            fetch(`${URL_API}/api/categorias`, { credentials: 'include' }),
            fetch(`${URL_API}/api/pedidos/admin/todos`, { credentials: 'include' })
        ]);

        const produtos = await resProdutos.json();
        const categorias = await resCategorias.json();
        const pedidos = await resPedidos.json();

        const totalProdutos = Array.isArray(produtos) ? produtos.length : 0;
        const totalCategorias = Array.isArray(categorias) ? categorias.length : 0;
        const totalPedidos = Array.isArray(pedidos) ? pedidos.length : 0;

        // Soma o valor das vendas não canceladas
        const totalVendas = Array.isArray(pedidos)
            ? pedidos
                .filter(p => p.status !== 'cancelado')
                .reduce((acc, p) => acc + (Number(p.valor_total) || 0), 0)
            : 0;

        const statProdutos = document.getElementById("statTotalProdutos");
        const statCategorias = document.getElementById("statTotalCategorias");
        const statPedidos = document.getElementById("statTotalPedidos");
        const statVendas = document.getElementById("statVendasTotais");

        if (statProdutos) statProdutos.textContent = totalProdutos;
        if (statCategorias) statCategorias.textContent = totalCategorias;
        if (statPedidos) statPedidos.textContent = totalPedidos;
        if (statVendas) {
            statVendas.textContent = totalVendas.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            });
        }
    } catch (erro) {
        console.error("Erro ao carregar estatísticas do dashboard:", erro);
    }
}

async function fazerLogout() {
    try {
        await fetch(`${URL_API}/api/auth/logout`, {
            method: 'POST',
            credentials: 'include'
        });
    } catch (erro) {
        console.error("Erro ao notificar logout no servidor:", erro);
    } finally {
        localStorage.removeItem('usuario_logado');
        window.location.href = '../login/login.html';
    }
}