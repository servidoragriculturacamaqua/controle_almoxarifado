// CONFIGURAÇÃO DO SUPABASE
const SUPABASE_URL = 'https://fdgxueegvlcyopolswpw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkZ3h1ZWVndmxjeW9wb2xzd3B3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNjUzMzYsImV4cCI6MjA4MDg0MTMzNn0.uWVZfcJ_95IDennMWHpnk2JiGrcun3DnKQPEEC_rYos';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// VARIÁVEIS GLOBAIS
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

    // Movimentação - Busca e Scanner
    containerBuscaManual: document.getElementById('busca-manual-container'),
    inputBusca: document.getElementById('input-busca-manual'),
    btnBuscarManual: document.getElementById('btn-buscar-manual'),
    btnAtivarScanner: document.getElementById('btn-ativar-scanner'),
    areaScannerMov: document.getElementById('area-scanner-mov'),
    
    // Movimentação - Formulário
    formMov: document.getElementById('form-movimentacao'),
    movNome: document.getElementById('mov-nome-produto'),
    movCodigo: document.getElementById('mov-codigo-produto'),
    movSaldo: document.getElementById('mov-saldo-atual'),
    movQtd: document.getElementById('mov-qtd'),
    movDestino: document.getElementById('mov-destino'),
    boxDestino: document.getElementById('box-destino'),
    btnConfirmarMov: document.getElementById('btn-confirmar-mov'),
    radiosMov: document.getElementsByName('tipo_mov'),

    // Cadastro
    cadCodigo: document.getElementById('cad-codigo'),
    cadNome: document.getElementById('cad-nome'),
    cadUnidade: document.getElementById('cad-unidade'),
    btnSalvarNovo: document.getElementById('btn-salvar-novo'),
    btnScanCad: document.getElementById('btn-scan-cad'),
    areaScannerCad: document.getElementById('reader-cad-container'),

    // Resumo
    listaResumo: document.getElementById('lista-resumo')
};

window.onload = () => {
    carregarDestinos();
    atualizarResumo();
};

// --- NAVEGAÇÃO ---
function navegar(destino) {
    document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
    els.btnHome.style.display = 'block';

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
    else if (destino === 'cadastro') {
        els.telaCad.classList.add('ativa');
        els.titulo.innerText = 'Novo Cadastro';
        els.cadCodigo.value = '';
        els.cadNome.value = '';
    }
}

els.btnHome.addEventListener('click', () => navegar('home'));

// --- LÓGICA DE MOVIMENTAÇÃO ---

function resetarMovimentacao() {
    // Exibe a busca e esconde o form de resultado
    els.containerBuscaManual.classList.remove('hidden');
    els.formMov.classList.add('hidden');
    els.areaScannerMov.classList.add('hidden');
    
    els.inputBusca.value = '';
    els.movQtd.value = '';
    pararScanner();
}

// 1. Botão Buscar Manual (Código ou Nome)
els.btnBuscarManual.addEventListener('click', async () => {
    const termo = els.inputBusca.value.trim();
    if (!termo) return alert("Digite um código ou nome.");
    buscarProduto(termo);
});

// 2. Botão Ativar Scanner
els.btnAtivarScanner.addEventListener('click', () => {
    els.areaScannerMov.classList.remove('hidden');
    iniciarScanner("reader-mov", (codigoLido) => {
        // Callback de sucesso do scanner
        pararScanner();
        els.areaScannerMov.classList.add('hidden');
        buscarProduto(codigoLido);
    });
});

function pararScannerMovimentacao() {
    pararScanner();
    els.areaScannerMov.classList.add('hidden');
}

// BUSCA UNIFICADA (Serve tanto pro scanner quanto pro manual)
async function buscarProduto(termo) {
    // Tenta achar pelo código exato
    let { data, error } = await supabase
        .from('produtos')
        .select('*')
        .eq('codigo_barras', termo)
        .single();

    // Se não achou por código, tenta por nome (case insensitive)
    if (!data) {
        const { data: list, error: errNome } = await supabase
            .from('produtos')
            .select('*')
            .ilike('nome', `%${termo}%`)
            .limit(1); // Pega o primeiro que encontrar parecido
        
        if (list && list.length > 0) {
            data = list[0];
        }
    }

    if (data) {
        exibirFormularioMovimento(data);
    } else {
        alert("Produto não encontrado! Verifique o código ou nome.");
    }
}

function exibirFormularioMovimento(produto) {
    produtoSelecionado = produto;
    
    // Esconde a busca e mostra o formulário
    els.containerBuscaManual.classList.add('hidden');
    els.formMov.classList.remove('hidden');

    els.movNome.innerText = produto.nome;
    els.movCodigo.innerText = `Cód: ${produto.codigo_barras || 'S/N'}`;
    els.movSaldo.innerText = `Estoque Atual: ${produto.quantidade_atual} ${produto.unidade}`;
    
    // Define a cor do botão baseado no tipo atual
    atualizarEstiloBotaoMov();
}

// Lógica de Entrada e Saída
els.radiosMov.forEach(radio => {
    radio.addEventListener('change', atualizarEstiloBotaoMov);
});

function atualizarEstiloBotaoMov() {
    const tipo = document.querySelector('input[name="tipo_mov"]:checked').value;
    if (tipo === 'ENTRADA') {
        els.boxDestino.style.display = 'none';
        els.btnConfirmarMov.innerText = "CONFIRMAR ENTRADA";
        els.btnConfirmarMov.style.backgroundColor = "var(--primary)"; // Verde
    } else {
        els.boxDestino.style.display = 'block';
        els.btnConfirmarMov.innerText = "CONFIRMAR SAÍDA";
        els.btnConfirmarMov.style.backgroundColor = "var(--saida)"; // Laranja
    }
}

els.btnConfirmarMov.addEventListener('click', async () => {
    const tipo = document.querySelector('input[name="tipo_mov"]:checked').value;
    const qtd = parseFloat(els.movQtd.value);
    const destino = els.movDestino.value;

    if (!qtd || qtd <= 0) return alert("Quantidade inválida.");
    
    let novoSaldo = parseFloat(produtoSelecionado.quantidade_atual);
    
    if (tipo === 'SAIDA') {
        if (qtd > novoSaldo) return alert(`Saldo insuficiente! Você tem ${novoSaldo}.`);
        novoSaldo -= qtd;
    } else {
        novoSaldo += qtd;
    }

    // Salvar Movimentação
    const { error: errMov } = await supabase.from('movimentacoes').insert({
        produto_id: produtoSelecionado.id,
        tipo: tipo,
        quantidade: qtd,
        destino_id: (tipo === 'SAIDA' ? destino : null)
    });

    // Atualizar Produto
    const { error: errProd } = await supabase.from('produtos')
        .update({ quantidade_atual: novoSaldo })
        .eq('id', produtoSelecionado.id);

    if (!errMov && !errProd) {
        alert("Movimentação realizada!");
        navegar('home');
    } else {
        alert("Erro ao salvar no sistema.");
        console.error(errMov, errProd);
    }
});

// --- SCANNER GENÉRICO ---
function iniciarScanner(elementoId, callback) {
    if (scannerAtivo) scannerAtivo.clear();
    scannerAtivo = new Html5Qrcode(elementoId);
    
    scannerAtivo.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: { width: 250, height: 250 } }, 
        (decodedText) => callback(decodedText)
    ).catch(err => alert("Erro ao abrir câmera: " + err));
}

function pararScanner() {
    if (scannerAtivo) {
        scannerAtivo.stop().catch(() => {});
        scannerAtivo = null;
    }
}

// --- CADASTRO ---
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

els.btnSalvarNovo.addEventListener('click', async () => {
    const cod = els.cadCodigo.value;
    const nome = els.cadNome.value;
    const unid = els.cadUnidade.value;

    if (!nome) return alert("Preencha o nome.");

    const { error } = await supabase.from('produtos').insert({
        codigo_barras: cod, nome: nome, unidade: unid, quantidade_atual: 0
    });

    if (!error) {
        alert("Cadastrado com sucesso!");
        navegar('home');
    } else {
        alert("Erro! Código duplicado?");
    }
});

// --- LOADERS ---
async function carregarDestinos() {
    const { data } = await supabase.from('destinos').select('*');
    if (data) els.movDestino.innerHTML = data.map(d => `<option value="${d.id}">${d.nome}</option>`).join('');
}

async function atualizarResumo() {
    // Lista as ultimas movimentações para dar feedback visual
    const { data } = await supabase
        .from('movimentacoes')
        .select(`
            tipo, quantidade, criado_em,
            produtos (nome, unidade)
        `)
        .order('criado_em', { ascending: false })
        .limit(5);

    if (data) {
        els.listaResumo.innerHTML = data.map(m => {
            const cor = m.tipo === 'ENTRADA' ? 'green' : 'orange';
            const sinal = m.tipo === 'ENTRADA' ? '+' : '-';
            return `
            <li>
                <span>${m.produtos.nome}</span>
                <strong style="color:${cor}">${sinal}${m.quantidade} ${m.produtos.unidade}</strong>
            </li>`;
        }).join('');
    }
}