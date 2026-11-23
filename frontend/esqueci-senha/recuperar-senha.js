/* ==========================================================================
   RECUPERAÇÃO E REDEFINIÇÃO DE SENHA (recuperar-senha.js)
   ========================================================================== */

const noBackend = window.location.port === '3001';
const BASE_URL = noBackend ? '' : `${window.location.protocol}//${window.location.hostname}:3001`;

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const emailUrl = params.get('email');

    if (emailUrl) {
        const inputEmail = document.getElementById('emailRecuperacao');
        if (inputEmail) inputEmail.value = emailUrl;
    }

    const inputCodigo = document.getElementById('codigoVerificacao');
    if (inputCodigo) {
        inputCodigo.addEventListener('input', () => {
            inputCodigo.value = inputCodigo.value.replace(/\D/g, '').slice(0, 6);
        });
    }

    document.getElementById('formSolicitarCodigo').addEventListener('submit', solicitarCodigoEmail);
    document.getElementById('formRedefinirSenha').addEventListener('submit', redefinirSenhaFinal);
});

function exibirFeedback(mensagem, tipo) {
    const box = document.getElementById('boxFeedback');
    if (!box) return;

    box.textContent = mensagem;
    box.className = `feedback-box ${tipo}`;
    box.style.display = 'block';
}

const ICONE_OLHO_ABERTO = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
    </svg>
`;

const ICONE_OLHO_FECHADO = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
        <line x1="1" y1="1" x2="23" y2="23"></line>
    </svg>
`;

function alternarVisibilidadeSenha(idInput, botao) {
    const input = document.getElementById(idInput);
    if (!input) return;

    if (input.type === 'password') {
        input.type = 'text';
        botao.innerHTML = ICONE_OLHO_FECHADO;
        botao.setAttribute('aria-label', 'Ocultar senha');
    } else {
        input.type = 'password';
        botao.innerHTML = ICONE_OLHO_ABERTO;
        botao.setAttribute('aria-label', 'Mostrar senha');
    }
}

/* ==========================================================================
   ETAPA 1: ENVIAR CÓDIGO DE 6 DÍGITOS PARA O E-MAIL
   ========================================================================== */
async function solicitarCodigoEmail(event) {
    event.preventDefault();

    const email = document.getElementById('emailRecuperacao').value.trim();
    const btnEnviar = document.getElementById('btnEnviarCodigo');

    if (!email) {
        exibirFeedback('Informe um endereço de e-mail válido.', 'erro');
        return;
    }

    btnEnviar.disabled = true;
    btnEnviar.textContent = 'Enviando...';

    try {
        const resp = await fetch(`${BASE_URL}/api/auth/solicitar-codigo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const dados = await resp.json();

        if (resp.ok) {
            exibirFeedback(
                dados.mensagem || 'Código enviado! Verifique sua caixa de entrada (e spam) e preencha abaixo.',
                'sucesso'
            );
            document.getElementById('codigoVerificacao').focus();
        } else {
            exibirFeedback(dados.erro || 'Não foi possível enviar o código.', 'erro');
        }
    } catch (erro) {
        console.error('Erro ao solicitar código:', erro);
        exibirFeedback('Erro de conexão com o servidor.', 'erro');
    } finally {
        btnEnviar.disabled = false;
        btnEnviar.textContent = 'Reenviar código';
    }
}

/* ==========================================================================
   ETAPA 2: VALIDAR CÓDIGO + NOVA SENHA + CONFIRMAÇÃO
   ========================================================================== */
async function redefinirSenhaFinal(event) {
    event.preventDefault();

    const email = document.getElementById('emailRecuperacao').value.trim();
    const codigo = document.getElementById('codigoVerificacao').value.trim();
    const novaSenha = document.getElementById('novaSenha').value;
    const confirmarNovaSenha = document.getElementById('confirmarNovaSenha').value;
    const btnSalvar = document.getElementById('btnSalvarNovaSenha');

    if (!email) {
        exibirFeedback('Preencha o seu e-mail cadastrado acima.', 'erro');
        return;
    }

    if (codigo.length !== 6) {
        exibirFeedback('O código de verificação deve conter 6 dígitos.', 'erro');
        return;
    }

    if (novaSenha.length < 8) {
        exibirFeedback('A nova senha deve ter no mínimo 8 caracteres.', 'erro');
        return;
    }

    if (novaSenha !== confirmarNovaSenha) {
        exibirFeedback('A nova senha e a confirmação não coincidem.', 'erro');
        return;
    }

    btnSalvar.disabled = true;
    btnSalvar.textContent = 'Salvando nova senha...';

    try {
        const resp = await fetch(`${BASE_URL}/api/auth/redefinir-senha`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, codigo, novaSenha })
        });

        const dados = await resp.json();

        if (resp.ok) {
            exibirFeedback('Senha alterada com sucesso! Redirecionando para o login...', 'sucesso');
            setTimeout(() => {
                window.location.href = '../login/login.html';
            }, 1800);
        } else {
            exibirFeedback(dados.erro || 'Código inválido ou expirado.', 'erro');
            btnSalvar.disabled = false;
            btnSalvar.textContent = 'Salvar Nova Senha';
        }
    } catch (erro) {
        console.error('Erro ao redefinir senha:', erro);
        exibirFeedback('Erro ao conectar com o servidor para salvar a senha.', 'erro');
        btnSalvar.disabled = false;
        btnSalvar.textContent = 'Salvar Nova Senha';
    }
}