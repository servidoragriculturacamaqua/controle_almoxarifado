// CONFIGURAÇÃO DO SUPABASE
const SUPABASE_URL = 'https://fdgxueegvlcyopolswpw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkZ3h1ZWVndmxjeW9wb2xzd3B3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNjUzMzYsImV4cCI6MjA4MDg0MTMzNn0.uWVZfcJ_95IDennMWHpnk2JiGrcun3DnKQPEEC_rYos';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// VARIÁVEIS DE CONTROLE
let scannerAtivo = null;
let produtoSelecionado = null;

// ELEMENTOS DOM
const els = {
    btnHome: document.getElementById('btn-home'),
    titulo: document.getElementById('titulo-pagina'),
    
    // Telas
    telaMenu: document.getElementById('tela-menu'),
    telaMov: document.getElementById('tela-movimentacao'),
    telaCad: document.getElementById('tela-cadastro'),

    // Elementos Movimentação
    areaScannerMov: document.getElementById('area-scanner-mov'),
    formMov: document.getElementById('form-movimentacao'),
    movNome: document.getElementById('mov-nome-produto'),
    movSaldo: document.getElementById('mov-saldo-atual'),
    movQtd: document.getElementById('mov-qtd'),
    movDestino: document.getElementById('mov-destino'),
    boxDestino: document.getElementById('box-destino'),
    btnConfirmarMov: document.getElementById('btn-confirmar-mov'),
    radiosMov: document.getElementsByName('tipo_mov'),

    // Elementos Cadastro
    cadCodigo: document.getElementById('cad-codigo'),
    cadNome: document.getElementById('cad-nome'),
    cadUnidade: document.getElementById('cad-unidade'),
    btnSalvarNovo: document.getElementById('btn-salvar-novo'),
    btnScanCad: document.getElementById('btn-scan-cad'),
    areaScannerCad: document.getElementById('reader-cad-container'),

    // Dashboard
    listaResumo: document.getElementById('lista-resumo')
};

// --- INICIALIZAÇÃO ---
window.onload = () => {
    carregarDestinos();
    atualizarResumo();
};

// --- NAVEGAÇÃO ---
function navegar(destino) {
    // Esconde todas as telas
    document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
    els.btnHome.style.display = 'block';

    if (destino === 'home') {
        els.telaMenu.classList.add('ativa');
        els.titulo.innerText = 'Menu Principal';
        els.btnHome.style.display = 'none';
        pararScanner(); // Garante que a câmera desliga ao voltar pro menu
        atualizarResumo();
    } 
    else if (destino === 'movimentacao') {
        els.telaMov.classList.add('ativa');
        els.titulo.innerText = 'Movimentação';
        resetarMovimentacao(); // Reseta estado e liga câmera
    } 
    else if (destino === 'cadastro') {
        els.telaCad.classList.add('ativa');
        els.titulo.innerText = 'Novo Cadastro';
        els.cadCodigo.value = '';
        els.cadNome.value = '';
    }
}

els.btnHome.addEventListener('click', () => navegar('home'));

// --- SISTEMA DE SCANNER ---

function iniciarScanner(elementoId, callbackSucesso) {
    if (scannerAtivo) scannerAtivo.clear();
    
    scannerAtivo = new Html5Qrcode(elementoId);
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    
    scannerAtivo.start({ facingMode: "environment" }, config, (decodedText) => {
        // Ao ler com sucesso:
        scannerAtivo.stop();
        scannerAtivo = null;
        callbackSucesso(decodedText);
    }).catch(err => console.error("Erro Câmera", err));
}

function pararScanner() {
    if (scannerAtivo) {
        scannerAtivo.stop().catch(err => console.log("Scanner já parado"));
        scannerAtivo = null;
    }
}

// --- TELA DE MOVIMENTAÇÃO ---

function resetarMovimentacao() {
    els.formMov.classList.add('hidden');
    els.areaScannerMov.classList.remove('hidden');
    els.movQtd.value = '';
    
    // Inicia câmera automaticamente ao entrar na tela
    iniciarScanner("reader-mov", processarCodigoMovimentacao);
}

async function processarCodigoMovimentacao(codigo) {
    els.areaScannerMov.classList.add('hidden'); // Esconde câmera

    // Busca produto no banco
    const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .eq('codigo_barras', codigo)
        .single();

    if (data) {
        produtoSelecionado = data;
        els.movNome.innerText = data.nome;
        els.movSaldo.innerText = `Saldo Atual: ${data.quantidade_atual} ${data.unidade}`;
        els.formMov.classList.remove('hidden'); // Mostra formulário
    } else {
        alert("Produto não encontrado! Vá em 'Cadastrar Novo Item'.");
        resetarMovimentacao();
    }
}

// Controle Visual Entrada/Saída
els.radiosMov.forEach(radio => {
    radio.addEventListener('change', (e) => {
        const tipo = e.target.value;
        if (tipo === 'ENTRADA') {
            els.boxDestino.style.display = 'none';
            els.btnConfirmarMov.innerText = "CONFIRMAR ENTRADA";
            els.btnConfirmarMov.classList.add('verde');
        } else {
            els.boxDestino.style.display = 'block';
            els.btnConfirmarMov.innerText = "CONFIRMAR SAÍDA";
            els.btnConfirmarMov.classList.remove('verde');
        }
    });
});

els.btnConfirmarMov.addEventListener('click', async () => {
    const tipo = document.querySelector('input[name="tipo_mov"]:checked').value;
    const qtd = parseFloat(els.movQtd.value);
    const destino = els.movDestino.value;

    if (!qtd || qtd <= 0) return alert("Digite uma quantidade válida.");
    
    let novoSaldo = parseFloat(produtoSelecionado.quantidade_atual);
    
    if (tipo === 'SAIDA') {
        if (qtd > novoSaldo) return alert("Saldo insuficiente!");
        novoSaldo -= qtd;
    } else {
        novoSaldo += qtd;
    }

    // Salvar no Supabase
    const { error: errMov } = await supabase.from('movimentacoes').insert({
        produto_id: produtoSelecionado.id,
        tipo: tipo,
        quantidade: qtd,
        destino_id: (tipo === 'SAIDA' ? destino : null)
    });

    const { error: errProd } = await supabase.from('produtos')
        .update({ quantidade_atual: novoSaldo })
        .eq('id', produtoSelecionado.id);

    if (!errMov && !errProd) {
        alert("Sucesso!");
        navegar('home'); // Volta pro menu
    } else {
        alert("Erro ao salvar.");
    }
});

// --- TELA DE CADASTRO ---

els.btnScanCad.addEventListener('click', () => {
    els.areaScannerCad.classList.remove('hidden');
    iniciarScanner("reader-cad", (codigo) => {
        els.cadCodigo.value = codigo;
        els.areaScannerCad.classList.add('hidden');
    });
});

function pararScannerCadastro() {
    pararScanner();
    els.areaScannerCad.classList.add('hidden');
}

els.btnSalvarNovo.addEventListener('click', async () => {
    const cod = els.cadCodigo.value;
    const nome = els.cadNome.value;
    const unid = els.cadUnidade.value;

    if (!cod || !nome) return alert("Preencha código e nome.");

    const { error } = await supabase.from('produtos').insert({
        codigo_barras: cod,
        nome: nome,
        unidade: unid,
        quantidade_atual: 0
    });

    if (!error) {
        alert("Produto Cadastrado!");
        navegar('home');
    } else {
        alert("Erro! Código possivelmente já existe.");
    }
});

// --- UTILITÁRIOS ---

async function carregarDestinos() {
    const { data } = await supabase.from('destinos').select('*');
    if (data) {
        els.movDestino.innerHTML = data.map(d => `<option value="${d.id}">${d.nome}</option>`).join('');
    }
}

async function atualizarResumo() {
    // Pega os 5 últimos movimentados
    const { data } = await supabase
        .from('produtos')
        .select('nome, quantidade_atual, unidade')
        .order('id', { ascending: false }) // Simplificação para demo
        .limit(5);

    if (data) {
        els.listaResumo.innerHTML = data.map(p => `
            <li>
                <span>${p.nome}</span>
                <strong>${p.quantidade_atual} ${p.unidade}</strong>
            </li>
        `).join('');
    }
}