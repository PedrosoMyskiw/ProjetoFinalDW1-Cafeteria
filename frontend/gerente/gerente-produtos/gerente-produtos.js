/* ==========================================================================
   PAINEL DO GERENTE - GERENCIAMENTO DE PRODUTOS (gerente-produtos.js)
   ========================================================================== */

const URL_API = `${window.location.protocol}//${window.location.hostname}:3001`;
const SILHUETA_URL = `${URL_API}/imagens/silhueta.png`;

// Estados globais para Produtos
let oQueEstaFazendo = '';
let produtoAtual = null;

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

// Inicializa a página de produtos
document.addEventListener("DOMContentLoaded", async () => {
    bloquearAtributos(true);
    visibilidadeDosBotoes('inline', 'none', 'none', 'none', 'none', 'none');
    carregarImagem(null);

    carregarUsuarioSidebar();
    await carregarCategorias();
    await listar();
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

async function carregarCategorias() {
    const select = document.getElementById("selectId_categoria");
    if (!select) return;

    try {
        const resposta = await fetch(`${URL_API}/api/categorias`, { credentials: 'include' });
        const data = await resposta.json();

        select.innerHTML = '<option value="">-- Selecione uma Categoria --</option>';
        const listaCategorias = Array.isArray(data) ? data : (data.categorias || []);

        listaCategorias.forEach(cat => {
            select.innerHTML += `<option value="${cat.id_categoria}">${cat.nome_categoria || cat.nome}</option>`;
        });
    } catch (erro) {
        console.error("Erro ao carregar categorias:", erro);
        select.innerHTML = '<option value="">Erro ao carregar categorias</option>';
    }
}

function carregarImagem(id) {
    const img = document.getElementById('imgProduto');
    if (!img) return;

    if (!id) {
        img.src = SILHUETA_URL;
        return;
    }
    img.src = `${URL_API}/imagens/${id}.png?t=${new Date().getTime()}`;
    img.onerror = () => { img.src = SILHUETA_URL; };
}

function acionarUpload() {
    if (oQueEstaFazendo !== 'inserindo' && oQueEstaFazendo !== 'alterando') {
        mostrarAviso("Clique em Inserir ou Alterar primeiro para poder escolher uma imagem.");
        return;
    }
    document.getElementById('inputImagem').click();
}

function previewImagem() {
    const inputFiles = document.getElementById('inputImagem').files;
    if (inputFiles.length > 0) {
        const url = URL.createObjectURL(inputFiles[0]);
        document.getElementById('imgProduto').src = url;
        mostrarAviso("Imagem escolhida! Clique em Salvar para concluir.");
    }
}

async function uploadImagemParaServidor(id) {
    const inputFiles = document.getElementById('inputImagem').files;
    if (inputFiles.length === 0) return;

    const formData = new FormData();
    formData.append('imagem', inputFiles[0]);

    try {
        await fetch(`${URL_API}/api/produtos/upload/${id}`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });
    } catch (erro) {
        console.error("Erro ao enviar imagem:", erro);
    }
}

async function procurePorChavePrimaria(chave) {
    try {
        const resposta = await fetch(`${URL_API}/api/produtos/${chave}`, { credentials: 'include' });
        if (!resposta.ok) return null;
        const data = await resposta.json();
        return data.sucesso !== undefined ? (data.sucesso ? data.produto : null) : data;
    } catch (erro) {
        return null;
    }
}

async function procure() {
    const id_produto = document.getElementById("inputId_produto").value.trim();
    if (isNaN(id_produto) || !Number.isInteger(Number(id_produto)) || id_produto === "") {
        mostrarAviso("O ID precisa ser um número inteiro válido.");
        return;
    }

    produtoAtual = await procurePorChavePrimaria(id_produto);
    oQueEstaFazendo = '';

    if (produtoAtual) {
        mostrarDadosProduto(produtoAtual);
        carregarImagem(id_produto);
        document.getElementById("inputId_produto").readOnly = true;
        visibilidadeDosBotoes('inline', 'none', 'inline', 'inline', 'none', 'inline');
        mostrarAviso("Produto encontrado no banco. Você pode Alterar ou Excluir.");
    } else {
        limparAtributosExcetoId();
        carregarImagem(null);
        document.getElementById("inputId_produto").readOnly = true;
        visibilidadeDosBotoes('inline', 'inline', 'none', 'none', 'none', 'inline');
        mostrarAviso("Produto não encontrado. Clique em Inserir para cadastrar.");
    }
}

function mostrarDadosProduto(p) {
    document.getElementById("inputId_produto").value = p.id_produto;
    document.getElementById("inputNome_produto").value = p.nome_produto || p.nome;
    document.getElementById("selectId_categoria").value = p.id_categoria || "";
    document.getElementById("inputQuantidade_estoque").value = p.quantidade_estoque || 0;
    document.getElementById("inputPreco").value = p.preco || 0.00;
    bloquearAtributos(true);
}

function inserir() {
    oQueEstaFazendo = 'inserindo';
    limparAtributosExcetoId();
    bloquearAtributos(false);
    document.getElementById("inputId_produto").readOnly = true;
    visibilidadeDosBotoes('none', 'none', 'none', 'none', 'inline', 'inline');
    mostrarAviso("INSERINDO - Preencha os dados e clique em Salvar para cadastrar.");
}

function alterar() {
    oQueEstaFazendo = 'alterando';
    bloquearAtributos(false);
    document.getElementById("inputId_produto").readOnly = true;
    visibilidadeDosBotoes('none', 'none', 'none', 'none', 'inline', 'inline');
    mostrarAviso("ALTERANDO - Modifique os dados e clique em Salvar.");
}

function excluir() {
    bloquearAtributos(true);
    document.getElementById("inputId_produto").readOnly = true;
    visibilidadeDosBotoes('none', 'none', 'none', 'none', 'inline', 'inline');
    oQueEstaFazendo = 'excluindo';
    mostrarAviso("EXCLUINDO - Clique em Salvar para confirmar a exclusão definitiva.");
}

async function salvar() {
    let id_produto = document.getElementById("inputId_produto").value.trim();
    const nome_produto = document.getElementById("inputNome_produto").value.trim();
    const id_categoria = document.getElementById("selectId_categoria").value || null;
    const quantidade_estoque = parseInt(document.getElementById("inputQuantidade_estoque").value) || 0;
    const preco = parseFloat(document.getElementById("inputPreco").value) || 0.0;

    const dadosProduto = {
        id_produto: parseInt(id_produto, 10),
        nome_produto: nome_produto,
        id_categoria: id_categoria ? parseInt(id_categoria, 10) : null,
        quantidade_estoque: quantidade_estoque,
        preco: preco
    };

    try {
        if (oQueEstaFazendo === 'inserindo') {
            const resposta = await fetch(`${URL_API}/api/produtos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(dadosProduto)
            });
            const data = await resposta.json();

            if (!resposta.ok) {
                mostrarAviso(`Erro: ${data.erro || data.mensagem || 'Não foi possível cadastrar'}`);
                return;
            }

            await uploadImagemParaServidor(id_produto);
            mostrarAviso("Produto inserido com sucesso!");

        } else if (oQueEstaFazendo === 'alterando') {
            const resposta = await fetch(`${URL_API}/api/produtos/${id_produto}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(dadosProduto)
            });

            if (!resposta.ok) {
                mostrarAviso("Erro ao atualizar o produto no servidor.");
                return;
            }

            await uploadImagemParaServidor(id_produto);
            mostrarAviso("Produto alterado com sucesso!");

        } else if (oQueEstaFazendo === 'excluindo') {
            const resposta = await fetch(`${URL_API}/api/produtos/${id_produto}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!resposta.ok) {
                mostrarAviso("Erro ao excluir o produto.");
                return;
            }

            carregarImagem(null);
            mostrarAviso("Produto excluído com sucesso!");
        }

        cancelarOperacao();
        await listar();

    } catch (erro) {
        console.error("Erro ao salvar:", erro);
        mostrarAviso("Erro de conexão ao efetuar operação no servidor.");
    }
}

function cancelarOperacao() {
    const inputId = document.getElementById("inputId_produto");
    if (inputId) {
        inputId.value = "";
        inputId.readOnly = false;
    }
    limparAtributos();
    bloquearAtributos(true);
    oQueEstaFazendo = '';
    carregarImagem(null);
    visibilidadeDosBotoes('inline', 'none', 'none', 'none', 'none', 'none');
    mostrarAviso("Digite um ID acima e clique em pesquisar para começar.");
}

async function listar() {
    const tbody = document.getElementById("outputSaida");
    if (!tbody) return;

    try {
        const resposta = await fetch(`${URL_API}/api/produtos`, { credentials: 'include' });
        const produtos = await resposta.json();

        let html = "";
        if (Array.isArray(produtos) && produtos.length > 0) {
            produtos.forEach(prod => {
                const precoNum = Number(prod.preco) || 0;
                const precoFormatado = precoNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                const idProd = prod.id_produto || prod.id;

                html += `
                    <tr style="border-bottom: 1px solid #e5d8ca;">
                        <td style="padding: 12px 10px;">
                            <img src="${URL_API}/imagens/${idProd}.png"
                                 onerror="this.onerror=null; this.src='${SILHUETA_URL}';"
                                 style="width: 42px; height: 42px; object-fit: cover; border-radius: 8px;" />
                        </td>
                        <td style="padding: 12px 10px; font-weight: bold; color: var(--marrom-escuro, #493629);">${idProd}</td>
                        <td style="padding: 12px 10px;">${prod.nome_produto || prod.nome}</td>
                        <td style="padding: 12px 10px; color: #827365;">${prod.nome_categoria || prod.categoria_nome || 'Sem Categoria'}</td>
                        <td style="padding: 12px 10px; font-weight: 500;">${precoFormatado}</td>
                        <td style="padding: 12px 10px;">${prod.quantidade_estoque || 0}</td>
                        <td style="padding: 12px 10px; text-align: center;">
                            <button type="button"
                                    class="btn-select-category"
                                    onclick="carregarProdutoParaEdicao(${idProd})"
                                    title="Selecionar Produto">
                                Selecionar
                            </button>
                        </td>
                    </tr>
                `;
            });
        } else {
            html = `<tr><td colspan="7" style="text-align: center; padding: 25px; color: #827365;">Nenhum produto cadastrado.</td></tr>`;
        }
        tbody.innerHTML = html;
    } catch (erro) {
        console.error("Erro ao listar produtos:", erro);
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 25px; color: #d9534f;">Erro ao carregar lista de produtos.</td></tr>`;
    }
}

function carregarProdutoParaEdicao(id) {
    document.getElementById("inputId_produto").value = id;
    procure();
}

function bloquearAtributos(soLeitura) {
    document.getElementById("inputNome_produto").readOnly = soLeitura;
    document.getElementById("selectId_categoria").disabled = soLeitura;
    document.getElementById("inputQuantidade_estoque").readOnly = soLeitura;
    document.getElementById("inputPreco").readOnly = soLeitura;
}

function limparAtributos() {
    document.getElementById("inputId_produto").value = "";
    document.getElementById("inputNome_produto").value = "";
    document.getElementById("selectId_categoria").value = "";
    document.getElementById("inputQuantidade_estoque").value = "";
    document.getElementById("inputPreco").value = "";
}

function limparAtributosExcetoId() {
    document.getElementById("inputNome_produto").value = "";
    document.getElementById("selectId_categoria").value = "";
    document.getElementById("inputQuantidade_estoque").value = "";
    document.getElementById("inputPreco").value = "";
}

function mostrarAviso(mensagem) {
    const aviso = document.getElementById("divAviso");
    if (aviso) {
        aviso.style.display = 'block';
        aviso.innerHTML = mensagem;
    }
}

function visibilidadeDosBotoes(btP, btI, btA, btE, btS, btC) {
    document.getElementById("btProcure").style.display = btP;
    document.getElementById("btInserir").style.display = btI;
    document.getElementById("btAlterar").style.display = btA;
    document.getElementById("btExcluir").style.display = btE;

    const elSalvar = document.getElementById("btSalvar");
    if (elSalvar) elSalvar.style.display = btS;

    const elCancelar = document.getElementById("btnCancelar");
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