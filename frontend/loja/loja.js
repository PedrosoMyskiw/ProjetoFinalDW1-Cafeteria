// Armazenamento global do carrinho no localStorage
let carrinho = JSON.parse(localStorage.getItem('carrinho_caffe')) || [];

// Ajuste dinâmico de host para garantir o envio do Cookie de Sessão em qualquer origem (localhost ou 127.0.0.1)
const noBackend = window.location.port === '3001';
const BASE_URL = noBackend ? '' : `${window.location.protocol}//${window.location.hostname}:3001`;

document.addEventListener("DOMContentLoaded", () => {
    inicializarCarrinho();
    verificarSessaoUsuario();
    carregarCategorias();
    carregarProdutos();
    renderizarCarrinho();
});

function fecharCarrinho() {
    const cartSidebar = document.getElementById("cartSidebar");
    const cartOverlay = document.getElementById("cartOverlay");
    
    if (cartSidebar) cartSidebar.classList.remove("active", "aberto");
    if (cartOverlay) cartOverlay.classList.remove("active");
}

function inicializarCarrinho() {
    const openCart = document.getElementById("openCart");
    const closeCart = document.getElementById("closeCart");
    const cartSidebar = document.getElementById("cartSidebar");
    const cartOverlay = document.getElementById("cartOverlay");
    const continuarComprando = document.getElementById("continuarComprando");
    const btnFecharCarrinho = document.getElementById('btnFecharCarrinho');

    function showCart() {
        if (cartSidebar && cartOverlay) {
            cartSidebar.classList.add("active");
            cartOverlay.classList.add("active");
        }
    }

    if (openCart) openCart.addEventListener("click", showCart);
    if (closeCart) closeCart.addEventListener("click", fecharCarrinho);
    if (cartOverlay) cartOverlay.addEventListener("click", fecharCarrinho);
    if (continuarComprando) continuarComprando.addEventListener("click", fecharCarrinho);
    if (btnFecharCarrinho) btnFecharCarrinho.addEventListener("click", fecharCarrinho);
}

// Verificação de sessão com Menu Dropdown de Perfil
async function verificarSessaoUsuario() {
    const containerAuth = document.getElementById("containerAuth");
    if (!containerAuth) return;

    try {
        const urlSessao = `${BASE_URL}/api/auth/sessao`;
        const resposta = await fetch(urlSessao, { credentials: "include" });
        const dados = await resposta.json();

        if (resposta.ok && dados.autenticado) {
            const usuario = dados.usuario;
            const inicial = usuario.nome ? usuario.nome.charAt(0).toUpperCase() : "U";
            const isAdmin = usuario.tipo === "admin" || usuario.tipo === "gerente";

            containerAuth.innerHTML = `
                <div class="user-menu-wrapper" id="userMenuWrapper">
                    <button type="button" class="user-avatar-btn" id="btnUserMenu" title="${usuario.nome}">
                        <span>${inicial}</span>
                    </button>
                    
                    <div class="user-dropdown-menu" id="userDropdown">
                        <div class="dropdown-header">
                            <strong>${usuario.nome}</strong>
                            <small>${usuario.email}</small>
                        </div>
                        <hr class="dropdown-divider">
                        <a href="../perfil/perfil.html" class="dropdown-item">
                            👤 Ver Perfil
                        </a>
                        ${isAdmin ? `
                            <a href="../gerente/gerente.html" class="dropdown-item admin-link">
                                🛠️ Painel Admin
                            </a>
                        ` : ''}
                        <hr class="dropdown-divider">
                        <button type="button" id="btnLogout" class="dropdown-item logout-link">
                            🚪 Sair
                        </button>
                    </div>
                </div>
                <button class="btn-cart" id="openCart">♡ Carrinho</button>
            `;

            inicializarCarrinho();
            inicializarDropdownPerfil();

            const btnLogout = document.getElementById("btnLogout");
            if (btnLogout) {
                btnLogout.addEventListener("click", efetuarLogout);
            }
        }
    } catch (error) {
        console.error("Erro ao verificar sessão:", error);
    }
}

function inicializarDropdownPerfil() {
    const btnUserMenu = document.getElementById("btnUserMenu");
    const userDropdown = document.getElementById("userDropdown");

    if (!btnUserMenu || !userDropdown) return;

    btnUserMenu.addEventListener("click", (e) => {
        e.stopPropagation();
        userDropdown.classList.toggle("active");
    });

    document.addEventListener("click", (e) => {
        if (!userDropdown.contains(e.target) && e.target !== btnUserMenu) {
            userDropdown.classList.remove("active");
        }
    });
}

async function efetuarLogout() {
    try {
        const resposta = await fetch(`${BASE_URL}/api/auth/logout`, { method: "POST", credentials: "include" });
        if (resposta.ok) window.location.reload();
    } catch (error) {
        console.error("Erro ao realizar logout:", error);
    }
}

/* ==========================================================================
   CARREGAMENTO E FILTRAGEM POR CATEGORIAS
   ========================================================================== */
async function carregarCategorias() {
    const categoryGrid = document.getElementById('categoryGrid');
    if (!categoryGrid) return;

    try {
        const resposta = await fetch(`${BASE_URL}/api/categorias`, { credentials: "include" });
        const data = await resposta.json();

        const listaCategorias = Array.isArray(data) ? data : (data.categorias || []);

        if (!resposta.ok || listaCategorias.length === 0) {
            categoryGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Nenhuma categoria encontrada.</p>';
            return;
        }

        let htmlAbas = `
            <button type="button" class="category-tab active" onclick="filtrarPorCategoria(null, this)">
                Todas
            </button>
        `;

        htmlAbas += listaCategorias.map(cat => {
            const idCat = cat.id_categoria !== undefined ? cat.id_categoria : cat.id;
            const nomeCat = cat.nome_categoria || cat.nome;

            return `
                <button type="button" class="category-tab" onclick="filtrarPorCategoria(${idCat}, this)">
                    ${nomeCat}
                </button>
            `;
        }).join('');

        categoryGrid.innerHTML = htmlAbas;
    } catch (erro) {
        console.error('Erro ao carregar categorias:', erro);
    }
}

function filtrarPorCategoria(idCategoria, elementoClicado) {
    if (elementoClicado) {
        document.querySelectorAll('.category-tab').forEach(btn => btn.classList.remove('active'));
        elementoClicado.classList.add('active');
    }
    carregarProdutos(idCategoria);
}

/* ==========================================================================
   CARREGAMENTO DE PRODUTOS
   ========================================================================== */

async function carregarProdutos(idCategoria = null) {
    const productGrid = document.getElementById('productGrid');
    if (!productGrid) return;

    try {
        const query = (idCategoria !== null && idCategoria !== undefined) ? `?categoria=${Number(idCategoria)}` : '';
        const url = `${BASE_URL}/api/produtos${query}`;

        const resposta = await fetch(url, { credentials: "include" });
        const produtos = await resposta.json();

        if (!resposta.ok || !Array.isArray(produtos) || produtos.length === 0) {
            productGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 40px 0; color: #827365;">Nenhum produto encontrado nesta categoria. ☕</p>';
            return;
        }

        productGrid.innerHTML = produtos.map(prod => {
            const idProduto = prod.id_produto || prod.id;
            const nomeProduto = prod.nome_produto || prod.nome || 'Produto';
            const catNome = prod.nome_categoria || 'CAFÉ';
            const qtdEstoque = Number(prod.quantidade_estoque) || 0;
            const semEstoque = qtdEstoque <= 0;
            
            const urlImagemCompleta = `${BASE_URL}/imagens/${idProduto}.png`;

            return `
                <article class="product-card">
                    <div class="product-image">
                        <img src="${urlImagemCompleta}" 
                             onerror="this.onerror=null; this.src='${BASE_URL}/imagens/silhueta.png';" 
                             alt="${nomeProduto}">
                    </div>
                    <div class="product-info">
                        <span class="product-category">${catNome}</span>
                        <h3>${nomeProduto}</h3>
                        <p style="color: #827365; font-size: 0.85rem; margin-bottom: 4px;">
                            ${prod.descricao || 'Café especial preparado com grãos selecionados.'}
                        </p>
                        <p style="color: ${semEstoque ? '#d9534f' : '#827365'}; font-size: 0.8rem; font-weight: 500; margin-bottom: 8px;">
                            ${semEstoque ? 'Esgotado' : `Estoque: ${qtdEstoque} un.`}
                        </p>
                        <div class="product-bottom">
                            <strong>R$ ${Number(prod.preco || 0).toFixed(2).replace('.', ',')}</strong>
                            <button type="button" 
                                    ${semEstoque ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''} 
                                    onclick="adicionarAoCarrinho(${idProduto})">+</button>
                        </div>
                    </div>
                </article>
            `;
        }).join('');
    } catch (erro) {
        console.error('Erro ao carregar produtos:', erro);
        productGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #d9534f;">Erro ao carregar produtos.</p>';
    }
}

/* ==========================================================================
   GESTÃO DO CARRINHO
   ========================================================================== */
async function adicionarAoCarrinho(idProduto) {
    try {
        const resposta = await fetch(`${BASE_URL}/api/produtos`, { credentials: "include" });
        const produtos = await resposta.json();
        
        const lista = Array.isArray(produtos) ? produtos : (produtos.rows || []);
        const produto = lista.find(p => (p.id_produto || p.id) === idProduto);

        if (!produto) return;

        const itemExistente = carrinho.find(item => item.id === idProduto);

        if (itemExistente) {
            itemExistente.quantidade += 1;
        } else {
            carrinho.push({
                id: idProduto,
                nome: produto.nome_produto || produto.nome,
                preco: Number(produto.preco),
                quantidade: 1
            });
        }

        salvarEAtualizarCarrinho();

        const cartSidebar = document.getElementById("cartSidebar");
        const cartOverlay = document.getElementById("cartOverlay");
        if (cartSidebar && cartOverlay) {
            cartSidebar.classList.add("active");
            cartOverlay.classList.add("active");
        }
    } catch (erro) {
        console.error('Erro ao adicionar produto:', erro);
    }
}

function alterarQuantidade(idProduto, mudanca) {
    const item = carrinho.find(i => i.id === idProduto);
    if (!item) return;

    item.quantidade += mudanca;

    if (item.quantidade <= 0) {
        carrinho = carrinho.filter(i => i.id !== idProduto);
    }

    salvarEAtualizarCarrinho();
}

function removerDoCarrinho(idProduto) {
    carrinho = carrinho.filter(i => i.id !== idProduto);
    salvarEAtualizarCarrinho();
}

function salvarEAtualizarCarrinho() {
    localStorage.setItem('carrinho_caffe', JSON.stringify(carrinho));
    renderizarCarrinho();
}

function renderizarCarrinho() {
    const cartItems = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');
    if (!cartItems || !cartTotal) return;

    if (carrinho.length === 0) {
        cartItems.innerHTML = `
            <div class="cart-empty">
                <span>☕</span>
                <h3>Seu carrinho está vazio</h3>
                <p>Que tal escolher um café especial?</p>
                <button type="button" id="continuarComprando" onclick="fecharCarrinho()">EXPLORAR PRODUTOS</button>
            </div>
        `;
        cartTotal.innerText = 'R$ 0,00';
        atualizarContadorHeader(0);
        return;
    }

    let total = 0;
    let totalItens = 0;

    cartItems.innerHTML = carrinho.map(item => {
        const subtotal = item.preco * item.quantidade;
        total += subtotal;
        totalItens += item.quantidade;

        return `
            <div class="cart-item">
                <div class="cart-item-info">
                    <h4>${item.nome}</h4>
                    <p>R$ ${item.preco.toFixed(2).replace('.', ',')}</p>
                    <button type="button" onclick="removerDoCarrinho(${item.id})">Remover</button>
                </div>
                <div class="cart-quantity">
                    <button type="button" onclick="alterarQuantidade(${item.id}, -1)">-</button>
                    <span>${item.quantidade}</span>
                    <button type="button" onclick="alterarQuantidade(${item.id}, 1)">+</button>
                </div>
            </div>
        `;
    }).join('');

    cartTotal.innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
    atualizarContadorHeader(totalItens);

    const btnCheckout = document.getElementById('finalizarCompra');
    if (btnCheckout) {
        btnCheckout.onclick = finalizarCompra;
    }
}

function atualizarContadorHeader(qtd) {
    const btnCart = document.getElementById('openCart');
    if (btnCart) {
        btnCart.innerHTML = `♡ Carrinho ${qtd > 0 ? `<span>${qtd}</span>` : ''}`;
    }
}

async function finalizarCompra() {
    if (carrinho.length === 0) {
        alert('Seu carrinho está vazio!');
        return;
    }

    try {
        const respSessao = await fetch(`${BASE_URL}/api/auth/sessao`, { credentials: "include" });
        const dadosSessao = await respSessao.json();

        if (!respSessao.ok || !dadosSessao.autenticado) {
            alert('🔒 Você precisa estar logado para realizar a compra!');
            window.location.href = '../login/login.html';
            return;
        }

        // Salva no localStorage E envia via parâmetro na URL para não perder entre portas/hosts
        localStorage.setItem('carrinho_caffe', JSON.stringify(carrinho));
        const carrinhoCodificado = encodeURIComponent(JSON.stringify(carrinho));
        window.location.href = `../pagamento/pagamento.html?carrinho=${carrinhoCodificado}`;
    } catch (error) {
        console.error('Erro ao verificar sessão antes do pagamento:', error);
        alert('Não foi possível conectar ao servidor.');
    }
}