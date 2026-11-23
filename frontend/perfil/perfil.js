const BASE_URL = `${window.location.protocol}//${window.location.hostname}:3001`;
let usuarioAtual = null;

document.addEventListener("DOMContentLoaded", () => {
    carregarPerfilEHistorico();
});

/* ==========================================================================
   1. CARREGAMENTO DE DADOS E PERFIL
   ========================================================================== */
async function carregarPerfilEHistorico() {
    try {
        // Busca dados completos do cliente no endpoint de perfil
        const respPerfil = await fetch(`${BASE_URL}/api/perfil/meu-perfil`, { credentials: "include" });

        if (!respPerfil.ok) {
            alert('Sessão expirada ou não encontrada. Por favor, faça login novamente.');
            window.location.href = '../login/login.html';
            return;
        }

        const usuario = await respPerfil.json();
        preencherDadosUsuario(usuario);

        // Carrega histórico de pedidos do cliente
        await carregarMeusPedidos();

    } catch (error) {
        console.error('Erro ao carregar dados do perfil:', error);
    }
}

function preencherDadosUsuario(usuario) {
    usuarioAtual = usuario;
    const inicial = usuario.nome ? usuario.nome.charAt(0).toUpperCase() : "U";
    
    // Dados básicos do topo do cartão
    document.getElementById("avatarGrande").textContent = inicial;
    document.getElementById("nomeCliente").textContent = usuario.nome || "Cliente";
    document.getElementById("emailCliente").textContent = usuario.email || "";
    document.getElementById("tipoCliente").textContent = usuario.tipo || "cliente";

    // 1. Telefone
    const elTelefone = document.getElementById("infoTelefone");
    if (elTelefone) {
        elTelefone.textContent = usuario.telefone || "Não informado";
    }

    // 2. CEP
    const elCep = document.getElementById("infoCep");
    if (elCep) {
        elCep.textContent = usuario.cep || "Não informado";
    }

    // 3. Endereço completo (Logradouro, número, complemento e bairro)
    const elEndereco = document.getElementById("infoEndereco");
    if (elEndereco) {
        if (usuario.logradouro) {
            const num = usuario.numero ? `, Nº ${usuario.numero}` : ' (S/N)';
            const comp = usuario.complemento ? ` (${usuario.complemento})` : '';
            const bairro = usuario.bairro ? ` - ${usuario.bairro}` : '';
            elEndereco.textContent = `${usuario.logradouro}${num}${comp}${bairro}`;
        } else {
            elEndereco.textContent = "Não informado";
        }
    }

    // 4. Cidade / Estado (UF)
    const elCidadeUf = document.getElementById("infoCidadeUf");
    if (elCidadeUf) {
        if (usuario.cidade) {
            elCidadeUf.textContent = usuario.estado ? `${usuario.cidade} / ${usuario.estado}` : usuario.cidade;
        } else {
            elCidadeUf.textContent = "Não informado";
        }
    }
}

/* ==========================================================================
   2. EDIÇÃO E ATUALIZAÇÃO DO PERFIL
   ========================================================================== */
function alternarModoEdicao() {
    const modoVis = document.getElementById("modoVisualizacao");
    const formEdit = document.getElementById("formEdicaoPerfil");
    const btnAlternar = document.getElementById("btnAlternarEdicao");

    if (!modoVis || !formEdit) return;

    if (formEdit.style.display === "none" || formEdit.style.display === "") {
        // Preenche os campos do formulário com as informações atuais
        if (usuarioAtual) {
            document.getElementById("editNome").value = usuarioAtual.nome || "";
            document.getElementById("editTelefone").value = usuarioAtual.telefone || "";
            document.getElementById("editCep").value = usuarioAtual.cep || "";
            document.getElementById("editLogradouro").value = usuarioAtual.logradouro || "";
            document.getElementById("editNumero").value = usuarioAtual.numero || "";
            document.getElementById("editComplemento").value = usuarioAtual.complemento || "";
            document.getElementById("editBairro").value = usuarioAtual.bairro || "";
            document.getElementById("editCidade").value = usuarioAtual.cidade || "";
            document.getElementById("editEstado").value = usuarioAtual.estado || "";
        }

        modoVis.style.display = "none";
        formEdit.style.display = "block";
        if (btnAlternar) btnAlternar.style.display = "none";
    } else {
        modoVis.style.display = "block";
        formEdit.style.display = "none";
        if (btnAlternar) btnAlternar.style.display = "inline-block";
    }
}

async function salvarAlteracoesPerfil(event) {
    event.preventDefault();

    const dadosAtualizados = {
        nome: document.getElementById("editNome").value,
        telefone: document.getElementById("editTelefone").value,
        cep: document.getElementById("editCep").value,
        logradouro: document.getElementById("editLogradouro").value,
        numero: document.getElementById("editNumero").value,
        complemento: document.getElementById("editComplemento").value,
        bairro: document.getElementById("editBairro").value,
        cidade: document.getElementById("editCidade").value,
        estado: document.getElementById("editEstado").value
    };

    try {
        const resposta = await fetch(`${BASE_URL}/api/perfil/meu-perfil`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(dadosAtualizados)
        });

        const resultado = await resposta.json();

        if (resposta.ok && resultado.sucesso) {
            alert(resultado.mensagem || 'Perfil atualizado com sucesso!');
            alternarModoEdicao();
            await carregarPerfilEHistorico(); // Recarrega os dados exibidos na tela
        } else {
            alert(resultado.erro || 'Erro ao atualizar dados.');
        }
    } catch (error) {
        console.error('Erro ao atualizar perfil:', error);
        alert('Erro ao se conectar com o servidor.');
    }
}

/* ==========================================================================
   3. HISTÓRICO DE PEDIDOS E CANCELAMENTO
   ========================================================================== */
async function carregarMeusPedidos() {
    const container = document.getElementById("containerMeusPedidos");
    if (!container) return;

    try {
        const resposta = await fetch(`${BASE_URL}/api/pedidos/meus-pedidos`, { credentials: "include" });
        const pedidos = await resposta.json();

        if (!resposta.ok || !Array.isArray(pedidos) || pedidos.length === 0) {
            container.innerHTML = `<p class="empty-text">Você ainda não realizou nenhum pedido. ☕</p>`;
            return;
        }

        container.innerHTML = pedidos.map(ped => {
            const dataFmt = ped.data_pedido ? new Date(ped.data_pedido).toLocaleDateString('pt-BR') : 'N/A';
            const valorFmt = (Number(ped.valor_total) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            
            const statusAtual = (ped.status || 'pendente').toLowerCase();
            const statusClass = `status-${statusAtual.replace(/\s+/g, '-')}`;

            // Renderiza a lista de produtos do pedido
            const itensHTML = Array.isArray(ped.itens) && ped.itens.length > 0
                ? ped.itens.map(item => `
                    <li style="display: flex; justify-content: space-between; font-size: 0.85rem; color: #5a483a; padding: 3px 0;">
                        <span>${item.quantidade}x ${item.nome_produto}</span>
                        <span>${(Number(item.preco_unitario) * item.quantidade).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </li>
                  `).join('')
                : '<li style="font-size: 0.85rem; color: #827365;">Nenhum item detalhado.</li>';

            const podeCancelar = statusAtual === 'pendente';
            const btnCancelarHTML = podeCancelar
                ? `<button type="button" class="btn-cancelar-pedido" onclick="cancelarPedido(${ped.id_pedido})">Cancelar Pedido</button>`
                : '';

            return `
                <article class="pedido-item-card">
                    <div class="pedido-top">
                        <span class="pedido-id">Pedido #${ped.id_pedido}</span>
                        <span class="pedido-status ${statusClass}">${ped.status || 'Pendente'}</span>
                    </div>
                    
                    <div class="pedido-info" style="margin-bottom: 10px;">
                        <span>Data: ${dataFmt}</span>
                        <span>Tipo: ${ped.tipo_atendimento || 'Retirada'}</span>
                        <strong>${valorFmt}</strong>
                    </div>

                    <!-- Lista de Produtos -->
                    <div style="background: #f8f3ed; border-radius: 8px; padding: 10px 14px; margin-top: 10px;">
                        <strong style="font-size: 0.8rem; color: #827365; text-transform: uppercase; letter-spacing: 0.5px;">Itens do Pedido:</strong>
                        <ul style="list-style: none; margin-top: 6px; padding: 0;">
                            ${itensHTML}
                        </ul>
                    </div>

                    ${podeCancelar ? `<div class="pedido-actions">${btnCancelarHTML}</div>` : ''}
                </article>
            `;
        }).join('');

    } catch (error) {
        console.error('Erro ao buscar meus pedidos:', error);
        container.innerHTML = `<p class="empty-text" style="color: #d9534f;">Erro ao carregar o histórico de pedidos.</p>`;
    }
}

async function cancelarPedido(idPedido) {
    if (!confirm(`Deseja realmente cancelar o Pedido #${idPedido}?`)) return;

    try {
        const resposta = await fetch(`${BASE_URL}/api/pedidos/meus-pedidos/${idPedido}/cancelar`, {
            method: 'PATCH',
            credentials: 'include'
        });

        const dados = await resposta.json();

        if (resposta.ok && dados.sucesso) {
            alert(dados.mensagem);
            await carregarMeusPedidos(); // Recarrega a lista para atualizar a tela
        } else {
            alert(dados.erro || 'Erro ao cancelar pedido.');
        }
    } catch (error) {
        console.error('Erro ao cancelar pedido:', error);
        alert('Erro ao se conectar ao servidor.');
    }
}