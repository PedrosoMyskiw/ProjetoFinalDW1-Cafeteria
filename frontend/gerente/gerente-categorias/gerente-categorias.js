/* ==========================================================================
   PAINEL DO GERENTE - GERENCIAMENTO DE CATEGORIAS (gerente-categorias.js)
   ========================================================================== */

const URL_API = `${window.location.protocol}//${window.location.hostname}:3001`;

// Estados globais para Categorias
let oQueEstaFazendoCat = '';
let categoriaAtual = null;

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

// Inicializa a página de categorias
document.addEventListener("DOMContentLoaded", async () => {
    bloquearAtributosCategoria(true);
    visibilidadeBotoesCategoria('inline', 'none', 'none', 'none', 'none', 'none');

    carregarUsuarioSidebar();
    await listarCategoriasNoPainel();
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

async function listarCategoriasNoPainel() {
    const gridCategorias = document.getElementById("grid-categorias");
    if (!gridCategorias) return;

    try {
        const resposta = await fetch(`${URL_API}/api/categorias`, { credentials: 'include' });
        const data = await resposta.json();
        const listaCategorias = Array.isArray(data) ? data : (data.categorias || []);

        let html = "";
        if (listaCategorias.length > 0) {
            listaCategorias.forEach(cat => {
                const idCat = cat.id_categoria;
                const nomeCat = cat.nome_categoria || cat.nome || 'Categoria sem nome';
                const descCat = cat.descricao || 'Sem descrição cadastrada.';

                html += `
                    <article class="category-admin-card">
                        <div class="category-admin-info">
                            <div class="category-admin-header">
                                <span class="category-id-badge">ID #${idCat}</span>
                                <h3>${nomeCat}</h3>
                            </div>
                            <p>${descCat}</p>
                        </div>
                        <button type="button"
                                class="btn-select-category"
                                onclick="carregarCategoriaParaEdicao(${idCat})"
                                title="Selecionar Categoria">
                            Selecionar
                        </button>
                    </article>
                `;
            });
        } else {
            html = "<p style='grid-column: 1/-1; padding: 20px; color: #827365; text-align: center;'>Nenhuma categoria cadastrada.</p>";
        }

        gridCategorias.innerHTML = html;
    } catch (erro) {
        console.error("Erro ao listar categorias no painel:", erro);
        gridCategorias.innerHTML = "<p style='grid-column: 1/-1; text-align: center;'>Erro ao carregar categorias.</p>";
    }
}

async function procurePorChavePrimariaCategoria(chave) {
    try {
        const resposta = await fetch(`${URL_API}/api/categorias/${chave}`, { credentials: 'include' });
        if (!resposta.ok) return null;
        const data = await resposta.json();
        return data.sucesso !== undefined ? (data.sucesso ? data.categoria : null) : data;
    } catch (erro) {
        return null;
    }
}

async function procureCategoria() {
    const id_categoria = document.getElementById("inputId_categoria").value.trim();
    if (isNaN(id_categoria) || !Number.isInteger(Number(id_categoria)) || id_categoria === "") {
        mostrarAvisoCat("O ID precisa ser um número inteiro válido.");
        return;
    }

    categoriaAtual = await procurePorChavePrimariaCategoria(id_categoria);
    oQueEstaFazendoCat = '';

    if (categoriaAtual) {
        mostrarDadosCategoria(categoriaAtual);
        document.getElementById("inputId_categoria").readOnly = true;
        visibilidadeBotoesCategoria('inline', 'none', 'inline', 'inline', 'none', 'inline');
        mostrarAvisoCat("Categoria encontrada no banco. Você pode Alterar ou Excluir.");
    } else {
        limparAtributosCategoriaExcetoId();
        document.getElementById("inputId_categoria").readOnly = true;
        visibilidadeBotoesCategoria('inline', 'inline', 'none', 'none', 'none', 'inline');
        mostrarAvisoCat("Categoria não encontrada. Clique em Inserir para cadastrar.");
    }
}

function mostrarDadosCategoria(c) {
    document.getElementById("inputId_categoria").value = c.id_categoria;
    document.getElementById("inputNome_categoria").value = c.nome_categoria || c.nome;
    document.getElementById("inputDescricao_categoria").value = c.descricao || "";
    bloquearAtributosCategoria(true);
}

function inserirCategoria() {
    oQueEstaFazendoCat = 'inserindo';
    limparAtributosCategoriaExcetoId();
    bloquearAtributosCategoria(false);
    document.getElementById("inputId_categoria").readOnly = true;
    visibilidadeBotoesCategoria('none', 'none', 'none', 'none', 'inline', 'inline');
    mostrarAvisoCat("INSERINDO - Preencha os dados e clique em Salvar.");
}

function alterarCategoria() {
    oQueEstaFazendoCat = 'alterando';
    bloquearAtributosCategoria(false);
    document.getElementById("inputId_categoria").readOnly = true;
    visibilidadeBotoesCategoria('none', 'none', 'none', 'none', 'inline', 'inline');
    mostrarAvisoCat("ALTERANDO - Modifique os dados e clique em Salvar.");
}

function excluirCategoria() {
    bloquearAtributosCategoria(true);
    document.getElementById("inputId_categoria").readOnly = true;
    visibilidadeBotoesCategoria('none', 'none', 'none', 'none', 'inline', 'inline');
    oQueEstaFazendoCat = 'excluindo';
    mostrarAvisoCat("EXCLUINDO - Clique em Salvar para confirmar a exclusão.");
}

async function salvarCategoria() {
    const id_categoria = document.getElementById("inputId_categoria").value.trim();
    const nome_categoria = document.getElementById("inputNome_categoria").value.trim();
    const descricao = document.getElementById("inputDescricao_categoria").value.trim();

    if (!nome_categoria) {
        mostrarAvisoCat("O nome da categoria é obrigatório!");
        return;
    }

    const dadosCat = {
        id_categoria: parseInt(id_categoria, 10),
        nome_categoria,
        descricao
    };

    try {
        if (oQueEstaFazendoCat === 'inserindo') {
            const resposta = await fetch(`${URL_API}/api/categorias`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(dadosCat)
            });
            const data = await resposta.json();
            if (!resposta.ok) {
                mostrarAvisoCat(`Erro: ${data.erro || data.mensagem || 'Não foi possível cadastrar.'}`);
                return;
            }
            mostrarAvisoCat("Categoria inserida com sucesso!");

        } else if (oQueEstaFazendoCat === 'alterando') {
            const resposta = await fetch(`${URL_API}/api/categorias/${id_categoria}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(dadosCat)
            });
            if (!resposta.ok) {
                mostrarAvisoCat("Erro ao atualizar categoria no servidor.");
                return;
            }
            mostrarAvisoCat("Categoria alterada com sucesso!");

        } else if (oQueEstaFazendoCat === 'excluindo') {
            const resposta = await fetch(`${URL_API}/api/categorias/${id_categoria}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (!resposta.ok) {
                mostrarAvisoCat("Erro ao excluir categoria.");
                return;
            }
            mostrarAvisoCat("Categoria excluída com sucesso!");
        }

        cancelarPesquisaCategoria();
        await listarCategoriasNoPainel();

    } catch (erro) {
        console.error("Erro ao salvar categoria:", erro);
        mostrarAvisoCat("Erro de conexão ao efetuar operação.");
    }
}

function cancelarPesquisaCategoria() {
    const inputId = document.getElementById("inputId_categoria");
    if (inputId) {
        inputId.value = "";
        inputId.readOnly = false;
    }
    limparAtributosCategoriaExcetoId();
    bloquearAtributosCategoria(true);
    oQueEstaFazendoCat = '';
    visibilidadeBotoesCategoria('inline', 'none', 'none', 'none', 'none', 'none');
    mostrarAvisoCat("Digite um ID acima e clique em pesquisar para gerenciar a categoria.");
}

function carregarCategoriaParaEdicao(id) {
    document.getElementById("inputId_categoria").value = id;
    procureCategoria();
}

function bloquearAtributosCategoria(soLeitura) {
    document.getElementById("inputNome_categoria").readOnly = soLeitura;
    document.getElementById("inputDescricao_categoria").readOnly = soLeitura;
}

function limparAtributosCategoriaExcetoId() {
    document.getElementById("inputNome_categoria").value = "";
    document.getElementById("inputDescricao_categoria").value = "";
}

function mostrarAvisoCat(mensagem) {
    const aviso = document.getElementById("divAvisoCategoria");
    if (aviso) {
        aviso.style.display = 'block';
        aviso.style.background = 'var(--green-soft, #e8f5e9)';
        aviso.style.color = 'var(--green-dark, #2e7d32)';
        aviso.innerHTML = mensagem;
    }
}

function visibilidadeBotoesCategoria(btP, btI, btA, btE, btS, btC) {
    document.getElementById("btProcureCat").style.display = btP;
    document.getElementById("btInserirCat").style.display = btI;
    document.getElementById("btAlterarCat").style.display = btA;
    document.getElementById("btExcluirCat").style.display = btE;

    const elSalvar = document.getElementById("btSalvarCat");
    if (elSalvar) elSalvar.style.display = btS;

    const elCancelar = document.getElementById("btnCancelarCat");
    if (elCancelar) elCancelar.style.display = btC;
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
        window.location.href = '../../login/login.html';
    }
}