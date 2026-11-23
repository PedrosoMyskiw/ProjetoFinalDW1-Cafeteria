document.getElementById('formCadastro').addEventListener('submit', async (e) => {
    e.preventDefault();

    const mensagemDiv = document.getElementById('mensagem');
    mensagemDiv.className = 'mensagem-status';
    mensagemDiv.style.display = 'none';

    // Captura dos valores do formulário (sanitizando o CEP)
    const dadosFormulario = {
        nome: document.getElementById('nome').value,
        email: document.getElementById('email').value,
        senha: document.getElementById('senha').value,
        confirmarSenha: document.getElementById('confirmarSenha').value,
        telefone: document.getElementById('telefone').value,
        cep: document.getElementById('cep').value.replace(/\D/g, ''),
        logradouro: document.getElementById('logradouro').value,
        numero: document.getElementById('numero').value,
        complemento: document.getElementById('complemento').value,
        bairro: document.getElementById('bairro').value,
        cidade: document.getElementById('cidade').value,
        estado: document.getElementById('estado').value
    };

    // Validações no frontend
    if (dadosFormulario.senha.length < 8) {
        exibirMensagem('A senha deve ter no mínimo 8 caracteres.', 'erro');
        return;
    }

    if (dadosFormulario.senha !== dadosFormulario.confirmarSenha) {
        exibirMensagem('As senhas não coincidem.', 'erro');
        return;
    }

    // Define a URL base do backend (Garante funcionamento no Live Server e no Express)
    const urlAPI = window.location.port === '3001' 
        ? '/api/auth/cadastro' 
        : 'http://localhost:3001/api/auth/cadastro';

    try {
        const resposta = await fetch(urlAPI, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dadosFormulario)
        });

        const dados = await resposta.json();

        if (resposta.ok) {
            exibirMensagem('Cadastro realizado com sucesso! Redirecionando para o login...', 'sucesso');
            setTimeout(() => {
                window.location.href = '../login/login.html';
            }, 2000);
        } else {
            exibirMensagem(dados.erro || 'Erro ao efetuar cadastro.', 'erro');
        }
    } catch (error) {
        exibirMensagem('Não foi possível se conectar ao servidor backend na porta 3001.', 'erro');
    }
});

// ================================================
// BUSCA AUTOMÁTICA DE ENDEREÇO VIA API VIACEP
// ================================================
const inputCEP = document.getElementById('cep');

if (inputCEP) {
    // Evento disparado ao sair do campo (blur) ou ao digitar os 8 números
    inputCEP.addEventListener('blur', buscarCEP);
    inputCEP.addEventListener('input', (e) => {
        const cepApenasNumeros = e.target.value.replace(/\D/g, '');
        if (cepApenasNumeros.length === 8) {
            buscarCEP();
        }
    });
}

async function buscarCEP() {
    const cepInput = document.getElementById('cep');
    const cep = cepInput.value.replace(/\D/g, '');

    // Valida se possui exatamente 8 dígitos
    if (cep.length !== 8) {
        return;
    }

    // Indica visualmente o carregamento nos campos
    preencherCamposEndereco('...', '...', '...', '...');

    try {
        const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const dados = await resposta.json();

        if (dados.erro) {
            exibirMensagem('CEP não encontrado. Preencha o endereço manualmente.', 'erro');
            preencherCamposEndereco('', '', '', '');
            return;
        }

        // Preenche os campos com os dados retornados da API
        preencherCamposEndereco(dados.logradouro, dados.bairro, dados.localidade, dados.uf);
        
        // Foca automaticamente no campo Número após o preenchimento
        document.getElementById('numero').focus();

    } catch (error) {
        console.error('Erro ao consultar ViaCEP:', error);
        preencherCamposEndereco('', '', '', '');
    }
}

function preencherCamposEndereco(logradouro, bairro, cidade, estado) {
    document.getElementById('logradouro').value = logradouro;
    document.getElementById('bairro').value = bairro;
    document.getElementById('cidade').value = cidade;
    document.getElementById('estado').value = estado;
}

function exibirMensagem(texto, tipo) {
    const mensagemDiv = document.getElementById('mensagem');
    mensagemDiv.textContent = texto;
    mensagemDiv.className = `mensagem-status ${tipo}`;
    mensagemDiv.style.display = 'block';
}