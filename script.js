// CONFIGURAÇÃO DO SUPABASE
const SUPABASE_URL = 'https://fdgxueegvlcyopolswpw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkZ3h1ZWVndmxjeW9wb2xzd3B3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNjUzMzYsImV4cCI6MjA4MDg0MTMzNn0.uWVZfcJ_95IDennMWHpnk2JiGrcun3DnKQPEEC_rYos';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// =======================================================
// --- VARIÁVEIS GLOBAIS ---
// =======================================================
let scannerAtivo = null;
let produtoSelecionado = null; // Para movimentação
let produtoEmEdicaoId = null;  // Para saber se é novo cadastro ou edição

// =======================================================
// --- ELEMENTOS DO HTML (DOM) ---
// =======================================================
const els = {
    btnHome: document.getElementById('btn-home'),
    titulo: document.getElementById('titulo-pagina'),
    
    // Telas
    telaMenu: document.getElementById('tela-menu'),
    telaMov: document.getElementById('tela-movimentacao'),
    telaGestao: document.getElementById('tela-gestao'),
    telaCad: document.getElementById('tela-cadastro'),

    // Tela de Gestão
    listaGestao: document.getElementById('lista-gestao-produtos'),
    inputBuscaGestao: document.getElementById('input-busca-gestao'),
    btnBuscaGestao: document.getElementById('btn-busca-gestao'),

    // Tela de Movimentação
    inputBuscaMov: document.getElementById('input-busca-manual'),
    btnBuscarMov: document.getElementById('btn-buscar-manual'),
    btnAtivarScanner: document.getElementById('btn-ativar-scanner'),
    areaScannerMov: document.getElementById('area-scanner-mov'),
    formMov: document.getElementById('form-movimentacao'),
    containerBuscaManual: document.getElementById('busca-manual-container'),
    
    // Campos do Formulário de Movimentação
    movNome: document.getElementById('mov-nome-produto'),
    movSaldo: document.getElementById('mov-saldo-atual'),
    movCodigo: document.getElementById('mov-codigo-produto'),
    movQtd: document.getElementById('mov-qtd'),
    movDestino: document.getElementById('mov-destino'),
    btnConfirmarMov: document.getElementById('btn-confirmar-mov'),
    boxDestino: document.getElementById('box-destino'),

    // Tela de Cadastro / Edição
    tituloCadastro: document.getElementById('titulo-cadastro'),
    cadId: document.getElementById('cad-id-editar'),
    cadCodigo: document.getElementById('cad-codigo'),
    cadNome: document.getElementById('cad-nome'),
    cadUnidade: document.getElementById('cad-unidade'),
    btnSalvarNovo: document.getElementById('btn-salvar-novo'),
    btnScanCad: document.getElementById('btn-scan-cad'),
    areaScannerCad: document.getElementById('reader-cad-container'),

    // Resumo na Home
    listaResumo: document.getElementById('lista-resumo')
};

// =======================================================
// --- INICIALIZAÇÃO ---
// =======================================================
window.onload = () => {
    carregarDestinos();
    atualizarResumo();
};

// =======================================================
// --- NAVEGAÇÃO ENTRE TELAS ---
// =======================================================
function navegar(destino) {
    // Esconde todas as telas
    document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
    els.btnHome.style.display = 'block';
    
    // Lógica para cada tela
    if (destino === 'home') {
        els.telaMenu.classList.add('ativa');
        els.titulo.innerText = 'Menu Principal';
        els.btnHome.style.display = 'none';
        pararScanner();
        atualizarResumo();
    } 
    else if (destino === 'movimentacao') {
        els.telaMov.classList.add('ativa');
        els.titulo.innerText = 'Movimentação';
        resetarMovimentacao();
    }
    else if (destino === 'gestao') {
        els.telaGestao.classList.add('ativa');
        els.titulo.innerText = 'Gerenciar Produtos';
        carregarListaGestao();
    }
    else if (destino === 'cadastro') {
        els.telaCad.classList.add('ativa');
        resetarFormCadastro();
    }
}

els.btnHome.addEventListener('click', () => navegar('home'));

// =======================================================
// --- LÓGICA DE GESTÃO (LISTAR / EDITAR / EXCLUIR) ---
// =======================================================

async function carregarListaGestao(filtro = '') {
    els.listaGestao.innerHTML = '<p style="text-align:center">Carregando...</p>';
    
    let query = supabase.from('produtos').select('*').order('nome');

    if (filtro) {
        // .trim() evita buscar espaços vazios
        query = query.ilike('nome', `%${filtro.trim()}%`);
    }

    const { data, error } = await query;

    if (error) return alert("Erro ao carregar itens.");
    
    if (!data || data.length === 0) {
        els.listaGestao.innerHTML = '<p style="text-align:center">Nenhum produto encontrado.</p>';
        return;
    }

    els.listaGestao.innerHTML = data.map(p => `
        <li class="item-gestao">
            <div>
                <strong>${p.nome}</strong><br>
                <small>Cód: ${p.codigo_barras || '-'}</small><br>
                <span style="color:var(--primary)">Estoque: ${p.quantidade_atual} ${p.unidade}</span>
            </div>
            <div class="acoes-gestao">
                <button onclick="prepararEdicao(${p.id})" class="btn-icon-acao cor-edit">
                    <span class="material-icons">edit</span>
                </button>
                <button onclick="excluirProduto(${p.id})" class="btn-icon-acao cor-del">
                    <span class="material-icons">delete</span>
                </button>
            </div>
        </li>
    `).join('');
}

els.btnBuscaGestao.addEventListener('click', () => {
    carregarListaGestao(els.inputBuscaGestao.value);
});

window.excluirProduto = async (id) => {
    if(!confirm("Tem certeza? Isso removerá o produto da lista.")) return;
    const { error } = await supabase.from('produtos').delete().eq('id', id);
    if (error) {
        alert("Erro: Este produto possui histórico de movimentação e não pode ser excluído.");
    } else {
        alert("Produto excluído.");
        carregarListaGestao();
    }
};

window.prepararEdicao = async (id) => {
    const { data } = await supabase.from('produtos').select('*').eq('id', id).single();
    if(data) {
        els.telaGestao.classList.remove('ativa');
        els.telaCad.classList.add('ativa');
        els.titulo.innerText = 'Editar Produto';
        els.tituloCadastro.innerText = 'Editando: ' + data.nome;

        produtoEmEdicaoId = data.id;
        els.cadCodigo.value = data.codigo_barras || '';
        els.cadNome.value = data.nome;
        els.cadUnidade.value = data.unidade;
    }
};

// =======================================================
// --- LÓGICA DE CADASTRO (SALVAR) ---
// =======================================================

function resetarFormCadastro() {
    produtoEmEdicaoId = null;
    els.titulo.innerText = 'Novo Cadastro';
    els.tituloCadastro.innerText = 'Cadastrar Novo Item';
    els.cadCodigo.value = '';
    els.cadNome.value = '';
    els.cadUnidade.value = 'un';
}

els.btnSalvarNovo.addEventListener('click', async () => {
    // .trim() remove espaços antes e depois (Correção Scanner)
    const cod = els.cadCodigo.value.trim();
    const nome = els.cadNome.value.trim();
    const unid = els.cadUnidade.value;

    if (!nome) return alert("Nome é obrigatório.");

    const dados = { codigo_barras: cod, nome: nome, unidade: unid };
    let erro = null;

    if (produtoEmEdicaoId) {
        const { error } = await supabase.from('produtos').update(dados).eq('id', produtoEmEdicaoId);
        erro = error;
    } else {
        dados.quantidade_atual = 0;
        const { error } = await supabase.from('produtos').insert(dados);
        erro = error;
    }

    if (!erro) {
        alert(produtoEmEdicaoId ? "Atualizado com sucesso!" : "Cadastrado com sucesso!");
        if(produtoEmEdicaoId) navegar('gestao');
        else navegar('home');
    } else {
        alert("Erro ao salvar. Verifique se o código já existe.");
        console.error(erro);
    }
});

// Scanner Cadastro
els.btnScanCad.addEventListener('click', () => {
    els.areaScannerCad.classList.remove('hidden');
    iniciarScanner("reader-cad", (codigo) => {
        els.cadCodigo.value = codigo;
        pararScannerCadastro();
    });
});
function pararScannerCadastro() {
    pararScanner();
    els.areaScannerCad.classList.add('hidden');
}

// =======================================================
// --- LÓGICA DE MOVIMENTAÇÃO (BUSCA / ENTRADA / SAIDA) ---
// =======================================================

function resetarMovimentacao() {
    els.containerBuscaManual.classList.remove('hidden');
    els.formMov.classList.add('hidden');
    els.areaScannerMov.classList.add('hidden');
    els.inputBuscaMov.value = '';
    els.movQtd.value = '';
    pararScanner();
}

els.btnBuscarMov.addEventListener('click', () => {
    const termo = els.inputBuscaMov.value;
    if(termo) buscarProdutoMov(termo);
});

els.btnAtivarScanner.addEventListener('click', () => {
    els.areaScannerMov.classList.remove('hidden');
    iniciarScanner("reader-mov", (codigo) => {
        pararScanner();
        buscarProdutoMov(codigo);
    });
});

function pararScannerMovimentacao() {
    pararScanner();
    els.areaScannerMov.classList.add('hidden');
}

async function buscarProdutoMov(termoOriginal) {
    // .trim() para limpar espaços do scanner
    const termo = termoOriginal.trim();

    // 1. Busca Exata (Código)
    let { data } = await supabase
        .from('produtos')
        .select('*')
        .eq('codigo_barras', termo)
        .maybeSingle();

    // 2. Busca Aproximada (Nome)
    if (!data) {
        const { data: list } = await supabase
            .from('produtos')
            .select('*')
            .ilike('nome', `%${termo}%`)
            .limit(1);
        if (list && list.length > 0) data = list[0];
    }

    if (data) {
        produtoSelecionado = data;
        
        els.containerBuscaManual.classList.add('hidden');
        els.areaScannerMov.classList.add('hidden');
        els.formMov.classList.remove('hidden');
        
        els.movNome.innerText = data.nome;
        els.movCodigo.innerText = `Cód: ${data.codigo_barras || 'Manual'}`;
        els.movSaldo.innerText = `Saldo: ${data.quantidade_atual} ${data.unidade}`;
        atualizarEstiloBotaoMov();
    } else {
        alert(`Produto não encontrado: "${termo}".\nVerifique se o código está correto.`);
    }
}

// Lógica de Movimentação (Transação)
els.btnConfirmarMov.addEventListener('click', async () => {
    const tipo = document.querySelector('input[name="tipo_mov"]:checked').value;
    const qtd = parseFloat(els.movQtd.value);
    const destino = els.movDestino.value;

    if (!qtd || qtd <= 0) return alert("Quantidade inválida.");
    
    let novoSaldo = parseFloat(produtoSelecionado.quantidade_atual);
    if (tipo === 'SAIDA') {
        if (qtd > novoSaldo) return alert("Saldo insuficiente.");
        novoSaldo -= qtd;
    } else {
        novoSaldo += qtd;
    }

    const { error: e1 } = await supabase.from('movimentacoes').insert({
        produto_id: produtoSelecionado.id,
        tipo: tipo,
        quantidade: qtd,
        destino_id: (tipo === 'SAIDA' ? destino : null)
    });

    const { error: e2 } = await supabase.from('produtos')
        .update({ quantidade_atual: novoSaldo })
        .eq('id', produtoSelecionado.id);

    if (!e1 && !e2) {
        alert("Movimentação registrada com sucesso!");
        navegar('home');
    } else {
        alert("Erro ao salvar dados.");
    }
});

// Atualização visual dos botões Entrada/Saída
document.querySelectorAll('input[name="tipo_mov"]').forEach(r => {
    r.addEventListener('change', atualizarEstiloBotaoMov);
});

function atualizarEstiloBotaoMov() {
    const tipo = document.querySelector('input[name="tipo_mov"]:checked').value;
    if (tipo === 'ENTRADA') {
        els.boxDestino.style.display = 'none';
        els.btnConfirmarMov.innerText = "CONFIRMAR ENTRADA";
        els.btnConfirmarMov.style.backgroundColor = "var(--primary)";
    } else {
        els.boxDestino.style.display = 'block';
        els.btnConfirmarMov.innerText = "CONFIRMAR SAÍDA";
        els.btnConfirmarMov.style.backgroundColor = "var(--saida)";
    }
}

// =======================================================
// --- FUNÇÃO DE SCANNER (OTIMIZADA PARA CÓDIGO DE BARRAS) ---
// =======================================================
function iniciarScanner(elemId, callback) {
    if (scannerAtivo) {
        scannerAtivo.clear().catch(err => console.error("Scanner clear error", err));
    }

    scannerAtivo = new Html5Qrcode(elemId);
    
    // Configura os formatos de barra mais comuns
    const formatos = [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39
    ];

    const config = { 
        fps: 10, 
        // Caixa retangular (larga) para encaixar o código de barras
        qrbox: { width: 300, height: 150 },
        aspectRatio: 1.0,
        formatsToSupport: formatos,
        // Tenta usar o detector nativo do Android (Muito mais rápido)
        experimentalFeatures: {
            useBarCodeDetectorIfSupported: true
        }
    };
    
    scannerAtivo.start(
        { facingMode: "environment" }, 
        config, 
        (decodedText) => {
            // Sucesso
            callback(decodedText);
        }
    ).catch(err => {
        alert("Erro na câmera. Tente afastar o celular para focar melhor.");
        console.error(err);
    });
}

function pararScanner() {
    if (scannerAtivo) {
        scannerAtivo.stop().catch(()=>{});
        scannerAtivo = null;
    }
}

// =======================================================
// --- UTILITÁRIOS GERAIS ---
// =======================================================
async function carregarDestinos() {
    const { data } = await supabase.from('destinos').select('*');
    if (data) els.movDestino.innerHTML = data.map(d => `<option value="${d.id}">${d.nome}</option>`).join('');
}

async function atualizarResumo() {
    const { data } = await supabase.from('movimentacoes')
        .select(`tipo, quantidade, produtos (nome, unidade)`)
        .order('criado_em', { ascending: false }).limit(4);

    if (data) {
        els.listaResumo.innerHTML = data.map(m => {
            const cor = m.tipo === 'ENTRADA' ? 'green' : 'orange';
            const sinal = m.tipo === 'ENTRADA' ? '+' : '-';
            return `<li><span>${m.produtos.nome}</span><strong style="color:${cor}">${sinal}${m.quantidade} ${m.produtos.unidade}</strong></li>`;
        }).join('');
    }
}