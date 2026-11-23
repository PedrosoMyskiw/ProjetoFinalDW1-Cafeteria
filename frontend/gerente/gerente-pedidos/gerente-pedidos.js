/* ==========================================================================
   PAINEL DO GERENTE - GERENCIAMENTO DE PEDIDOS (gerente-pedidos.js)
   ========================================================================== */

const URL_API = `${window.location.protocol}//${window.location.hostname}:3001`;

// Cache global de pedidos para filtragem instantânea
let todosOsPedidosCache = [];

// Verificação de permissão no carregamento
(function verificarPermissao() {
    const usuarioLogado = JSON.parse(localStorage.getItem('usuario_logado'));

    if (!usuarioLogado) {
        window.location.href = '../../login/login.html';
        return;
    }

    const tipo = (usuarioLogado.tipo || usuarioLogado.cargo || '').toLowerCase();
    if (tipo !== 'admin' && tipo !== 'gerente') {
        alert('Acesso restrito a administradores.');
        window.location.href = '../../loja/loja.html';
    }
})();

// Inicializa a página de pedidos
document.addEventListener("DOMContentLoaded", async () => {
    carregarUsuarioSidebar();

    const filtroStatus = document.getElementById("filtroStatusPedido");
    if (filtroStatus) {
        filtroStatus.addEventListener("change", filtrarPedidosPorStatus);
    }

    await listarPedidos();
});

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

/* ==========================================================================
   FORMATAÇÃO DOS DADOS DE PAGAMENTO (COLUNA PRÓPRIA)
   ========================================================================== */
function formatarDetalhesPagamentoGerente(pedido) {
    const metodo = (pedido.forma_pagamento || '').toLowerCase();
    const statusPag = (pedido.status_pagamento || 'pendente').toLowerCase();
    const total = Number(pedido.valor_total) || 0;

    let statusTexto = 'Pendente';
    let statusClasse = 'pendente';

    if (statusPag === 'aprovado') {
        statusTexto = 'Pago';
        statusClasse = 'aprovado';
    } else if (statusPag === 'recusado') {
        statusTexto = 'Cancelado';
        statusClasse = 'recusado';
    }

    const tagStatus = `<span class="pag-status ${statusClasse}">${statusTexto}</span>`;

    if (metodo === 'pix') {
        const refPix = pedido.codigo_pix
            ? `<small class="pag-detalhe" title="${pedido.codigo_pix}">Ref: ${pedido.codigo_pix.slice(0, 12)}...</small>`
            : '';
        return `
            <div class="pagamento-coluna">
                <div class="pagamento-badges">
                    <span class="badge-pagamento pix">PIX</span>
                    ${tagStatus}
                </div>
                ${refPix}
            </div>
        `;
    }

    if (metodo === 'credito' || metodo === 'cartao_credito') {
        const final = pedido.final_cartao ? ` •••• ${pedido.final_cartao}` : '';
        return `
            <div class="pagamento-coluna">
                <div class="pagamento-badges">
                    <span class="badge-pagamento cartao">Crédito${final}</span>
                    ${tagStatus}
                </div>
            </div>
        `;
    }

    if (metodo === 'debito' || metodo === 'cartao_debito') {
        const final = pedido.final_cartao ? ` •••• ${pedido.final_cartao}` : '';
        return `
            <div class="pagamento-coluna">
                <div class="pagamento-badges">
                    <span class="badge-pagamento cartao">Débito${final}</span>
                    ${tagStatus}
                </div>
            </div>
        `;
    }

    if (metodo === 'dinheiro') {
        const trocoPara = Number(pedido.troco_para);
        let detalheTroco = '<small class="pag-detalhe">Sem troco</small>';

        if (trocoPara > total) {
            const devolver = (trocoPara - total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const nota = trocoPara.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            detalheTroco = `<small class="pag-detalhe alerta-troco">Troco p/ ${nota} · Devolver <strong>${devolver}</strong></small>`;
        }

        return `
            <div class="pagamento-coluna">
                <div class="pagamento-badges">
                    <span class="badge-pagamento dinheiro">Dinheiro</span>
                    ${tagStatus}
                </div>
                ${detalheTroco}
            </div>
        `;
    }

    return `
        <div class="pagamento-coluna">
            <span class="badge-pagamento">Não informado</span>
        </div>
    `;
}

/* ==========================================================================
   GERENCIAMENTO E LISTAGEM DE PEDIDOS
   ========================================================================== */
function normalizarStatusPedido(status) {
    const s = (status || 'pendente')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

    if (s === 'em preparo' || s === 'em_preparacao') return 'em_preparacao';
    if (s === 'enviado' || s === 'pronto') return 'pronto';
    return s;
}

async function listarPedidos() {
    const tbody = document.getElementById("tabelaPedidosBody");
    if (!tbody) return;

    try {
        const resposta = await fetch(`${URL_API}/api/pedidos/admin/todos`, { credentials: 'include' });
        const pedidos = await resposta.json();

        todosOsPedidosCache = Array.isArray(pedidos) ? pedidos : [];
        filtrarPedidosPorStatus();
    } catch (erro) {
        console.error("Erro ao carregar pedidos:", erro);
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px; color: red;">Erro ao carregar pedidos do servidor.</td></tr>`;
    }
}

function filtrarPedidosPorStatus() {
    const tbody = document.getElementById("tabelaPedidosBody");
    if (!tbody) return;

    const filtroEl = document.getElementById("filtroStatusPedido");
    const valorFiltro = filtroEl ? filtroEl.value : "";
    const statusFiltroNormalizado = valorFiltro ? normalizarStatusPedido(valorFiltro) : "";

    const pedidosFiltrados = statusFiltroNormalizado
        ? todosOsPedidosCache.filter(p => normalizarStatusPedido(p.status) === statusFiltroNormalizado)
        : todosOsPedidosCache;

    if (pedidosFiltrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px; color: #827365;">Nenhum pedido encontrado nesta situação.</td></tr>`;
        return;
    }

    tbody.innerHTML = pedidosFiltrados.map(p => {
        const valor = Number(p.valor_total) || 0;
        const valorFormatado = valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const dataFormatada = p.data_pedido ? new Date(p.data_pedido).toLocaleString('pt-BR') : 'N/A';

        const itensFormatados = Array.isArray(p.itens) && p.itens.length > 0
            ? p.itens.map(i => `${i.quantidade}x ${i.nome_produto}`).join('<br>')
            : 'Sem itens';

        const pagamentoHTML = formatarDetalhesPagamentoGerente(p);

        const statusAtual = normalizarStatusPedido(p.status);
        const estaFinalizado = statusAtual === 'cancelado' || statusAtual === 'concluido';

        return `
            <tr>
                <td style="font-weight: bold;">#${p.id_pedido}</td>
                <td>${p.nome_cliente || 'Cliente Desconhecido'}</td>
                <td><small>${dataFormatada}</small></td>
                <td><small>${itensFormatados}</small></td>
                <td style="font-weight: 600; color: #38251c; white-space: nowrap;">${valorFormatado}</td>
                <td>${pagamentoHTML}</td>
                <td>
                    <select class="select-status-pill"
                            data-status="${statusAtual}"
                            ${estaFinalizado ? `disabled title="Pedido ${statusAtual} não pode ser alterado"` : ''}
                            onchange="alterarStatusPedido(${p.id_pedido}, this.value)">
                        <option value="pendente" ${statusAtual === 'pendente' ? 'selected' : ''}>⏳ Pendente</option>
                        <option value="em_preparacao" ${statusAtual === 'em_preparacao' ? 'selected' : ''}>☕ Em Preparação</option>
                        <option value="pronto" ${statusAtual === 'pronto' ? 'selected' : ''}>🔔 Pronto</option>
                        <option value="concluido" ${statusAtual === 'concluido' ? 'selected' : ''}>✅ Concluído</option>
                        <option value="cancelado" ${statusAtual === 'cancelado' ? 'selected' : ''}>❌ Cancelado</option>
                    </select>
                </td>
            </tr>
        `;
    }).join('');
}

async function alterarStatusPedido(idPedido, novoStatus) {
    if (novoStatus === 'cancelado') {
        const confirmar = confirm(`Atenção: Cancelar o Pedido #${idPedido} devolverá os itens ao estoque e não poderá ser desfeito. Deseja continuar?`);
        if (!confirmar) {
            filtrarPedidosPorStatus();
            return;
        }
    }

    if (novoStatus === 'concluido') {
        const confirmar = confirm(`Deseja confirmar a conclusão do Pedido #${idPedido}? Após concluído, o status não poderá ser alterado.`);
        if (!confirmar) {
            filtrarPedidosPorStatus();
            return;
        }
    }

    try {
        const resposta = await fetch(`${URL_API}/api/pedidos/admin/${idPedido}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ status: novoStatus })
        });

        const dados = await resposta.json();

        if (resposta.ok && dados.sucesso) {
            await listarPedidos();
        } else {
            alert(dados.erro || 'Não foi possível alterar o status do pedido.');
            await listarPedidos();
        }
    } catch (error) {
        console.error('Erro ao atualizar status do pedido:', error);
        alert('Erro ao se conectar ao servidor.');
        await listarPedidos();
    }
}

/* ==========================================================================
   CONTROLE DO MENU SUSPENSO CUSTOMIZADO
   ========================================================================== */
function toggleDropdownFiltro() {
    const dropdown = document.getElementById("dropdownFiltroPedidos");
    if (dropdown) {
        dropdown.classList.toggle("aberto");
    }
}

function selecionarFiltroDropdown(elementoLi) {
    const dropdown = document.getElementById("dropdownFiltroPedidos");
    const inputOculto = document.getElementById("filtroStatusPedido");
    const labelBotao = dropdown.querySelector(".dropdown-selected-label");

    const novoValor = elementoLi.getAttribute("data-value");
    inputOculto.value = novoValor;
    labelBotao.innerHTML = elementoLi.innerHTML;

    dropdown.querySelectorAll(".dropdown-item").forEach(item => item.classList.remove("ativo"));
    elementoLi.classList.add("ativo");

    dropdown.classList.remove("aberto");
    filtrarPedidosPorStatus();
}

document.addEventListener("click", (event) => {
    const dropdown = document.getElementById("dropdownFiltroPedidos");
    if (dropdown && !dropdown.contains(event.target)) {
        dropdown.classList.remove("aberto");
    }
});

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
        window.location.href = '../../login/login.html';
    }
}