/* ==========================================================================
   TELA DE PAGAMENTO E REGISTRO DE PEDIDO (pagamento.js)
   ========================================================================== */

const noBackend = window.location.port === '3001';
const BASE_URL = noBackend ? '' : `${window.location.protocol}//${window.location.hostname}:3001`;

function obterCarrinhoAtual() {
    const params = new URLSearchParams(window.location.search);
    const carrinhoUrl = params.get('carrinho');
    if (carrinhoUrl) {
        try {
            const parsed = JSON.parse(decodeURIComponent(carrinhoUrl));
            if (Array.isArray(parsed) && parsed.length > 0) {
                localStorage.setItem('carrinho_caffe', JSON.stringify(parsed));
                return parsed;
            }
        } catch (e) {
            console.error('Erro ao ler carrinho da URL:', e);
        }
    }

    try {
        const salvo = JSON.parse(localStorage.getItem('carrinho_caffe'));
        return Array.isArray(salvo) ? salvo : [];
    } catch (e) {
        return [];
    }
}

let carrinho = obterCarrinhoAtual();
let totalPedido = 0;
let metodoAtual = 'pix';
let pixConfirmado = false;
let codigoPixAtual = `PIX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
let intervaloVerificacaoPix = null;

document.addEventListener("DOMContentLoaded", async () => {
    await verificarSessaoCheckout();
    carregarResumoCarrinho();
    await inicializarQrCodePixReal();
    validarFormularioPagamento();
});

async function verificarSessaoCheckout() {
    try {
        const respSessao = await fetch(`${BASE_URL}/api/auth/sessao`, { credentials: "include" });
        const dadosSessao = await respSessao.json();

        if (!respSessao.ok || !dadosSessao.autenticado) {
            alert('🔒 Você precisa estar logado para finalizar a compra!');
            window.location.href = '../login/login.html';
            return;
        }

        const badgeUsuario = document.getElementById('usuarioNomeBadge');
        if (badgeUsuario && dadosSessao.usuario) {
            badgeUsuario.textContent = dadosSessao.usuario.nome || 'Cliente';
        }
    } catch (erro) {
        console.error('Erro ao verificar sessão:', erro);
    }
}

function carregarResumoCarrinho() {
    if (carrinho.length === 0) {
        alert('Sua sacola está vazia. Retornando para a loja.');
        window.location.href = '../loja/loja.html';
        return;
    }

    const listaEl = document.getElementById('listaItensResumo');
    totalPedido = 0;

    listaEl.innerHTML = carrinho.map(item => {
        const precoUnit = Number(item.preco) || 0;
        const qtd = Number(item.quantidade) || 1;
        const subtotalItem = precoUnit * qtd;
        totalPedido += subtotalItem;

        const nome = item.nome_produto || item.nome || 'Produto';
        return `
            <li class="resumo-item">
                <div class="resumo-item-nome">
                    <strong>${qtd}x ${nome}</strong>
                    <small>${precoUnit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} cada</small>
                </div>
                <span>${subtotalItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            </li>
        `;
    }).join('');

    const totalFormatado = totalPedido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('valorSubtotal').textContent = totalFormatado;
    document.getElementById('valorTotalFinal').textContent = totalFormatado;
}

/* ==========================================================================
   QR CODE FUNCIONAL + POLLING DE LEITURA PELO CELULAR
   ========================================================================== */
async function inicializarQrCodePixReal() {
    let hostRede = window.location.hostname;
    let portaRede = '3001';

    try {
        const respRede = await fetch(`${BASE_URL}/api/pix/info-rede`);
        if (respRede.ok) {
            const dadosRede = await respRede.json();
            if (dadosRede.ip) hostRede = dadosRede.ip;
            if (dadosRede.porta) portaRede = dadosRede.porta;
        }
    } catch (erro) {
        console.warn('Usando hostname padrão para QR Code:', erro);
    }

    const urlConfirmacaoCelular = `http://${hostRede}:${portaRede}/api/pix/confirmar/${codigoPixAtual}?valor=${totalPedido.toFixed(2)}`;

    const imgQr = document.getElementById('imgQrCodePix');
    if (imgQr) {
        imgQr.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(urlConfirmacaoCelular)}`;
    }

    const infoLinkEl = document.getElementById('infoLinkQr');
    if (infoLinkEl) {
        infoLinkEl.textContent = `Destino do QR: ${urlConfirmacaoCelular}`;
    }

    iniciarVerificacaoLeituraPix();
}

function iniciarVerificacaoLeituraPix() {
    if (intervaloVerificacaoPix) clearInterval(intervaloVerificacaoPix);

    intervaloVerificacaoPix = setInterval(async () => {
        if (pixConfirmado) {
            clearInterval(intervaloVerificacaoPix);
            return;
        }

        try {
            const resp = await fetch(`${BASE_URL}/api/pix/status/${codigoPixAtual}`);
            if (!resp.ok) return;

            const dados = await resp.json();
            if (dados.pago) {
                pixConfirmado = true;
                clearInterval(intervaloVerificacaoPix);

                const badge = document.getElementById('statusPixBadge');
                if (badge) {
                    badge.textContent = '✅ QR Code lido pelo celular! Pagamento aprovado';
                    badge.classList.add('confirmado');
                }

                validarFormularioPagamento();
            }
        } catch (erro) {
            console.error('Erro ao verificar status do PIX:', erro);
        }
    }, 2000);
}

/* ==========================================================================
   SELEÇÃO DE MÉTODO E MÁSCARAS DO CARTÃO
   ========================================================================== */
function selecionarMetodo(metodo, elementoLabel) {
    metodoAtual = metodo;

    document.querySelectorAll('.payment-option').forEach(opt => opt.classList.remove('selected'));
    elementoLabel.classList.add('selected');
    elementoLabel.querySelector('input[type="radio"]').checked = true;

    document.getElementById('areaPix').style.display = metodo === 'pix' ? 'block' : 'none';
    document.getElementById('areaCartao').style.display = (metodo === 'cartao_credito' || metodo === 'cartao_debito') ? 'block' : 'none';
    document.getElementById('areaDinheiro').style.display = metodo === 'dinheiro' ? 'block' : 'none';

    const tituloCartao = document.getElementById('tituloAreaCartao');
    if (tituloCartao) {
        tituloCartao.textContent = metodo === 'cartao_credito'
            ? 'Dados do Cartão de Crédito'
            : 'Dados do Cartão de Débito';
    }

    document.getElementById('mensagemErroPagamento').style.display = 'none';
    validarFormularioPagamento();
}

function formatarNumeroCartao(input) {
    let digits = input.value.replace(/\D/g, '').slice(0, 16);
    input.value = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
    validarFormularioPagamento();
}

function formatarValidadeCartao(input) {
    let digits = input.value.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) {
        input.value = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    } else {
        input.value = digits;
    }
    validarFormularioPagamento();
}

function formatarCvvCartao(input) {
    input.value = input.value.replace(/\D/g, '').slice(0, 4);
    validarFormularioPagamento();
}

/* ==========================================================================
   VALIDAÇÃO PARA LIBERAR O BOTÃO FINALIZAR PEDIDO
   ========================================================================== */
function validarFormularioPagamento() {
    const btnConfirmar = document.getElementById('btnConfirmarPedido');
    if (!btnConfirmar) return;

    if (metodoAtual === 'pix') {
        if (pixConfirmado) {
            btnConfirmar.disabled = false;
            btnConfirmar.textContent = 'Finalizar Pedido';
        } else {
            btnConfirmar.disabled = true;
            btnConfirmar.textContent = 'Aguardando leitura do QR Code...';
        }
        return;
    }

    if (metodoAtual === 'cartao_credito' || metodoAtual === 'cartao_debito') {
        const nome = document.getElementById('inputNomeCartao').value.trim();
        const numero = document.getElementById('inputNumeroCartao').value.replace(/\s/g, '');
        const validade = document.getElementById('inputValidadeCartao').value.trim();
        const cvv = document.getElementById('inputCvvCartao').value.trim();

        const cartaoValido = nome.length >= 3 && numero.length >= 13 && validade.length === 5 && cvv.length >= 3;

        btnConfirmar.disabled = !cartaoValido;
        btnConfirmar.textContent = cartaoValido ? 'Finalizar Pedido' : 'Preencha os dados do cartão...';
        return;
    }

    // Dinheiro
    btnConfirmar.disabled = false;
    btnConfirmar.textContent = 'Finalizar Pedido';
}

/* ==========================================================================
   COMPROVANTE DIGITAL DO PEDIDO
   ========================================================================== */
function formatarNomePagamento(metodo, finalCartao, trocoPara) {
    if (metodo === 'pix') return 'PIX (Aprovado via QR Code)';
    if (metodo === 'cartao_credito') return `Cartão de Crédito${finalCartao ? ` (•••• ${finalCartao})` : ''}`;
    if (metodo === 'cartao_debito') return `Cartão de Débito${finalCartao ? ` (•••• ${finalCartao})` : ''}`;
    if (metodo === 'dinheiro') {
        return trocoPara
            ? `Dinheiro (Troco para ${trocoPara.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`
            : 'Dinheiro (Sem troco)';
    }
    return metodo;
}

function exibirComprovantePedido(dadosPedido, formaPagamento, finalCartao, trocoPara) {
    const idPedido = dadosPedido?.id_pedido || dadosPedido?.id || '001';
    const nomeCliente = document.getElementById('usuarioNomeBadge')?.textContent || 'Cliente';
    const agora = new Date().toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    document.getElementById('compNumeroPedido').textContent = `#${idPedido}`;

    const rodapePdf = document.querySelector('.comprovante-rodape-pdf strong');
    if (rodapePdf) rodapePdf.textContent = `#${idPedido}`;

    document.getElementById('compCliente').textContent = nomeCliente;
    document.getElementById('compDataHora').textContent = agora;
    document.getElementById('compFormaPagamento').textContent = formatarNomePagamento(formaPagamento, finalCartao, trocoPara);

    const listaComp = document.getElementById('compListaItens');
    listaComp.innerHTML = carrinho.map(item => {
        const qtd = Number(item.quantidade) || 1;
        const subtotal = (Number(item.preco) || 0) * qtd;
        const nome = item.nome_produto || item.nome || 'Produto';
        return `
            <li>
                <span>${qtd}x ${nome}</span>
                <strong>${subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
            </li>
        `;
    }).join('');

    document.getElementById('compValorTotal').textContent = totalPedido.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });

    // Limpa o carrinho imediatamente após registrar o pedido
    localStorage.removeItem('carrinho_caffe');

    const overlay = document.getElementById('modalComprovanteOverlay');
    if (overlay) overlay.style.display = 'flex';
}

function concluirEVoltarLoja() {
    window.location.href = '../loja/loja.html?limpar_carrinho=1';
}

/* ==========================================================================
   ENVIO FINAL DO PEDIDO PARA A API
   ========================================================================== */
async function confirmarERegistrarPedido() {
    if (carrinho.length === 0) return;

    if (metodoAtual === 'pix' && !pixConfirmado) {
        return;
    }

    const btnConfirmar = document.getElementById('btnConfirmarPedido');
    const msgErro = document.getElementById('mensagemErroPagamento');
    msgErro.style.display = 'none';

    const trocoInput = document.getElementById('inputTroco');
    const trocoPara = (metodoAtual === 'dinheiro' && trocoInput)
        ? (parseFloat(trocoInput.value) || null)
        : null;

    if (metodoAtual === 'dinheiro' && trocoPara !== null && trocoPara < totalPedido) {
        msgErro.textContent = 'O valor para troco deve ser maior ou igual ao total do pedido.';
        msgErro.style.display = 'block';
        return;
    }

    let finalCartao = null;
    if (metodoAtual === 'cartao_credito' || metodoAtual === 'cartao_debito') {
        const numLimpo = document.getElementById('inputNumeroCartao').value.replace(/\s/g, '');
        finalCartao = numLimpo.slice(-4);
    }

    btnConfirmar.disabled = true;
    btnConfirmar.textContent = 'Registrando pedido...';

    try {
        const resposta = await fetch(`${BASE_URL}/api/pedidos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                itens: carrinho,
                tipo_atendimento: 'retirada',
                forma_pagamento: metodoAtual,
                codigo_pix: metodoAtual === 'pix' ? codigoPixAtual : null,
                final_cartao: finalCartao,
                troco_para: trocoPara
            })
        });

        const dados = await resposta.json();

        if (resposta.ok && dados.sucesso) {
            btnConfirmar.textContent = 'Pedido Confirmado ✓';
            exibirComprovantePedido(dados.pedido, metodoAtual, finalCartao, trocoPara);
        } else {
            msgErro.textContent = dados.erro || dados.mensagem || 'Erro ao processar a compra.';
            msgErro.style.display = 'block';
            btnConfirmar.disabled = false;
            btnConfirmar.textContent = 'Finalizar Pedido';
        }
    } catch (error) {
        console.error('Erro ao finalizar compra:', error);
        msgErro.textContent = 'Não foi possível conectar ao servidor para concluir a compra.';
        msgErro.style.display = 'block';
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = 'Finalizar Pedido';
    }
}