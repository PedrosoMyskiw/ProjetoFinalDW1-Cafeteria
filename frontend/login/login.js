document.getElementById('formLogin').addEventListener('submit', async (e) => {
    e.preventDefault();

    const mensagemDiv = document.getElementById('mensagem');
    mensagemDiv.className = 'mensagem-status';
    mensagemDiv.style.display = 'none';

    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;

    const noBackend = window.location.port === '3001';
    const urlAPI = noBackend ? '/api/auth/login' : 'http://localhost:3001/api/auth/login';

    try {
        const resposta = await fetch(urlAPI, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, senha })
        });

        const dados = await resposta.json();

        if (resposta.ok) {
            // 1. Salva os dados do usuário autenticado no localStorage
            if (dados.usuario) {
                localStorage.setItem('usuario_logado', JSON.stringify(dados.usuario));
            }

            // 2. Determina o perfil/cargo do usuário
            const tipoUsuario = ((dados.usuario && (dados.usuario.tipo || dados.usuario.cargo)) || '').toLowerCase();

            // 3. Define a URL de destino com base no cargo
            let urlRedirecionamento = '';
            if (tipoUsuario === 'admin' || tipoUsuario === 'gerente') {
                urlRedirecionamento = noBackend ? '../gerente/gerente.html' : 'http://localhost:3001/gerente/gerente.html';
            } else {
                urlRedirecionamento = noBackend ? '../loja/loja.html' : 'http://localhost:3001/loja/loja.html';
            }

            exibirMensagem(`Bem-vindo(a), ${dados.usuario ? dados.usuario.nome : ''}! Redirecionando...`, 'sucesso', 'mensagem');
            
            setTimeout(() => {
                window.location.href = urlRedirecionamento;
            }, 1200);

        } else {
            exibirMensagem(dados.erro || 'Falha no login.', 'erro', 'mensagem');
        }
    } catch (error) {
        console.error("Erro de conexão no login:", error);
        exibirMensagem('Erro de conexão com o servidor.', 'erro', 'mensagem');
    }
});

// ================================================
// REDIRECIONAMENTO PARA RECUPERAÇÃO DE SENHA
// ================================================
const btnEsqueciSenha = document.getElementById('btnEsqueciSenha');
if (btnEsqueciSenha) {
    btnEsqueciSenha.addEventListener('click', (e) => {
        const emailDigitado = document.getElementById('email')?.value.trim();
        if (emailDigitado) {
            e.preventDefault();
            window.location.href = `../esqueci-senha/recuperar-senha.html?email=${encodeURIComponent(emailDigitado)}`;
        }
    });
}

function exibirMensagem(texto, tipo, idElemento) {
    const mensagemDiv = document.getElementById(idElemento);
    if (mensagemDiv) {
        if (!texto) {
            mensagemDiv.style.display = 'none';
            return;
        }
        mensagemDiv.textContent = texto;
        mensagemDiv.className = `mensagem-status ${tipo}`;
        mensagemDiv.style.display = 'block';
    }
}