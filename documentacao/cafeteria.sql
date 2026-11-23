-- =========================================
-- BANCO DE DADOS: CAFFE D'AUTORE
-- =========================================

-- Execute a criação do banco separadamente:
-- CREATE DATABASE caffe_d_autore;

-- Conecte-se ao banco antes de executar o restante.

-- =========================================
-- 1. USUARIOS
-- =========================================

CREATE TABLE usuarios (
    id_usuario SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    tipo VARCHAR(20) NOT NULL
        CHECK (tipo IN ('cliente', 'admin')),
    data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================
-- 2. CLIENTES
-- =========================================

CREATE TABLE clientes (
    id_usuario INTEGER PRIMARY KEY,
    telefone VARCHAR(20),
    endereco VARCHAR(200),

    CONSTRAINT fk_cliente_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario)
        ON DELETE RESTRICT
);

-- =========================================
-- 3. CATEGORIAS
-- =========================================

CREATE TABLE categorias (
    id_categoria SERIAL PRIMARY KEY,
    nome VARCHAR(80) NOT NULL UNIQUE,
    descricao TEXT
);

-- =========================================
-- 4. PRODUTOS
-- =========================================

CREATE TABLE produtos (
    id_produto SERIAL PRIMARY KEY,
    id_categoria INTEGER NOT NULL,
    nome VARCHAR(100) NOT NULL,
    descricao TEXT,
    preco NUMERIC(10,2) NOT NULL CHECK (preco > 0),
    imagem VARCHAR(255),
    disponivel BOOLEAN DEFAULT TRUE,

    CONSTRAINT fk_produto_categoria
        FOREIGN KEY (id_categoria)
        REFERENCES categorias(id_categoria)
        ON DELETE RESTRICT
);

-- =========================================
-- 5. PEDIDOS
-- =========================================

CREATE TABLE pedidos (
    id_pedido SERIAL PRIMARY KEY,
    id_cliente INTEGER NOT NULL,
    data_pedido TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    tipo_atendimento VARCHAR(20) NOT NULL
        CHECK (tipo_atendimento IN ('local', 'retirada')),

    numero_mesa INTEGER,

    status VARCHAR(30) NOT NULL DEFAULT 'pendente'
        CHECK (status IN (
            'pendente',
            'em_preparacao',
            'pronto',
            'concluido',
            'cancelado'
        )),

    valor_total NUMERIC(10,2) NOT NULL
        CHECK (valor_total >= 0),

    CONSTRAINT fk_pedido_cliente
        FOREIGN KEY (id_cliente)
        REFERENCES clientes(id_usuario),

    CONSTRAINT ck_numero_mesa CHECK (
        (
            tipo_atendimento = 'local'
            AND numero_mesa IS NOT NULL
            AND numero_mesa > 0
        )
        OR
        (
            tipo_atendimento = 'retirada'
            AND numero_mesa IS NULL
        )
    )
);

-- =========================================
-- 6. ITENS_PEDIDO
-- =========================================

CREATE TABLE itens_pedido (
    id_item SERIAL PRIMARY KEY,
    id_pedido INTEGER NOT NULL,
    id_produto INTEGER NOT NULL,
    quantidade INTEGER NOT NULL CHECK (quantidade > 0),
    preco_unitario NUMERIC(10,2) NOT NULL
        CHECK (preco_unitario > 0),

    CONSTRAINT fk_item_pedido
        FOREIGN KEY (id_pedido)
        REFERENCES pedidos(id_pedido)
        ON DELETE RESTRICT,

    CONSTRAINT fk_item_produto
        FOREIGN KEY (id_produto)
        REFERENCES produtos(id_produto)
        ON DELETE RESTRICT
);

-- =========================================
-- 7. PAGAMENTOS
-- =========================================

CREATE TABLE pagamentos (
    id_pagamento SERIAL PRIMARY KEY,
    id_pedido INTEGER NOT NULL UNIQUE,

    forma_pagamento VARCHAR(30) NOT NULL
        CHECK (forma_pagamento IN (
            'pix',
            'credito',
            'debito',
            'dinheiro'
        )),

    status VARCHAR(20) NOT NULL DEFAULT 'pendente'
        CHECK (status IN (
            'pendente',
            'aprovado',
            'recusado'
        )),

    valor NUMERIC(10,2) NOT NULL CHECK (valor > 0),
    data_pagamento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_pagamento_pedido
        FOREIGN KEY (id_pedido)
        REFERENCES pedidos(id_pedido)
        ON DELETE RESTRICT
);

-- =========================================
-- 8. INDICES
-- =========================================

CREATE INDEX idx_produtos_categoria
ON produtos(id_categoria);

CREATE INDEX idx_pedidos_cliente
ON pedidos(id_cliente);

CREATE INDEX idx_pedidos_data
ON pedidos(data_pedido);

CREATE INDEX idx_pedidos_status
ON pedidos(status);

CREATE INDEX idx_itens_pedido
ON itens_pedido(id_pedido);

-- =========================================
-- FIM DO SCRIPT
-- =========================================