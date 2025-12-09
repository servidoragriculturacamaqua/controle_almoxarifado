// CONFIGURAÇÃO DO SUPABASE
const SUPABASE_URL = 'https://fdgxueegvlcyopolswpw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkZ3h1ZWVndmxjeW9wb2xzd3B3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNjUzMzYsImV4cCI6MjA4MDg0MTMzNn0.uWVZfcJ_95IDennMWHpnk2JiGrcun3DnKQPEEC_rYos';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// =======================================================
// --- VARIÁVEIS GLOBAIS ---
// =======================================================
let scannerAtivo = null;
let produtoSelecionado = null;
let produtoEmEdicaoId = null;
let dadosRelatorioAtual = [];
let dadosSaldoEstoque = []; // Para o PDF de inventário

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
    telaMaquinas: document.getElementById('tela-maquinas'),
    telaRelatorios: document.getElementById('tela-relatorios'),
    telaSaldo: document.getElementById('tela-saldo'), // Nova Tela

    // Tela Saldo (Novo)
    tabelaSaldo: document.querySelector('#tabela-saldo tbody'),
    btnPdfSaldo: document.getElementById('btn-pdf-saldo'),
    inputBuscaSaldo: document.getElementById('input-busca-saldo'),
    btnBuscaSaldo: document.getElementById('btn-busca-saldo'),

    // Relatórios
    relDataInicio: document.getElementById('rel-data-inicio'),
    relDataFim: document.getElementById('rel-data-fim'),
    relMaquina: document.getElementById('rel-maquina'),
    relDestino: document.getElementById('rel-destino'),
    btnFiltrarRel: document.getElementById('btn-filtrar-relatorio'),
    containerResultados: document.getElementById('container-resultados-relatorio'),
    tabelaRelatorio: document.querySelector('#tabela-relatorio tbody'),
    btnGerarPdf: document.getElementById('btn-gerar-pdf'),

    // Gestão Produtos
    listaGestao: document.getElementById('lista-gestao-produtos'),
    inputBuscaGestao: document.getElementById('input-busca-gestao'),
    btnBuscaGestao: document.getElementById('btn-busca-gestao'),

    // Movimentação
    containerBuscaManual: document.getElementById('busca-manual-container'),
    inputBuscaMov: document.getElementById('input-busca-manual'),
    btnBuscarMov: document.getElementById('btn-buscar-manual'),
    btnAtivarScanner: document.getElementById('btn-ativar-scanner'),
    areaScannerMov: document.getElementById('area-scanner-mov'),
    formMov: document.getElementById('form-movimentacao'),
    movNome: document.getElementById('mov-nome-produto'),
    movSaldo: document.getElementById('mov-saldo-atual'),
    movCodigo: document.getElementById('mov-codigo-produto'),
    movQtd: document.getElementById('mov-qtd'),
    movDestino: document.getElementById('mov-destino'),
    boxDestino: document.getElementById('box-destino'),
    boxMaquina: document.getElementById('box-maquina'),
    selectMaquina: document.getElementById('mov-select-maquina'),
    btnConfirmarMov: document.getElementById('btn-confirmar-mov'),

    // Cadastro
    tituloCadastro: document.getElementById('titulo-cadastro'),
    cadId: document.getElementById('cad-id-editar'),
    cadCodigo: document.getElementById('cad-codigo'),
    cadNome: document.getElementById('cad-nome'),
    cadUnidade: document.getElementById('cad-unidade'),
    btnSalvarNovo: document.getElementById('btn-salvar-novo'),
    btnScanCad: document.getElementById('btn-scan-cad'),
    areaScannerCad: document.getElementById('reader-cad-container'),

    // Maquinas
    maqNome: document.getElementById('maq-nome'),
    btnAddMaq: document.getElementById('btn-add-maq'),
    listaMaquinas: document.getElementById('lista-maquinas'),
    listaResumo: document.getElementById('lista-resumo')
};

// =======================================================
// --- INICIALIZAÇÃO ---
// =======================================================
window.onload = () => {
    carregarDestinos();
    carregarMaquinasSelect(); 
    atualizarResumo();
};

// =======================================================
// --- NAVEGAÇÃO ---
// =======================================================
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
    else if (destino === 'saldo') { // NOVO
        els.telaSaldo.classList.add('ativa');
        els.titulo.innerText = 'Saldo de Estoque';
        carregarTabelaSaldo();
    }
    else if (destino === 'relatorios') {
        els.telaRelatorios.classList.add('ativa');
        els.titulo.innerText = 'Histórico';
        carregarFiltrosRelatorio();
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
    else if (destino === 'maquinas') {
        els.telaMaquinas.classList.add('ativa');
        els.titulo.innerText = 'Máquinas';
        carregarListaMaquinasEdit(); 
    }
}

els.btnHome.addEventListener('click', () => navegar('home'));

// =======================================================
// --- SALDO DE ESTOQUE (INVENTÁRIO) ---
// =======================================================
async function carregarTabelaSaldo(filtro = '') {
    els.tabelaSaldo.innerHTML = '<tr><td colspan="3">Carregando...</td></tr>';
    
    let query = supabase.from('produtos').select('nome, quantidade_atual, unidade').order('nome');
    if (filtro) query = query.ilike('nome', `%${filtro.trim()}%`);
    
    const { data, error } = await query;
    if (error) return;
    
    dadosSaldoEstoque = data; // Salva para PDF

    if (data.length === 0) {
        els.tabelaSaldo.innerHTML = '<tr><td colspan="3">Nenhum produto.</td></tr>';
        return;
    }

    els.tabelaSaldo.innerHTML = data.map(p => {
        const classeBaixo = p.quantidade_atual < 5 ? 'estoque-baixo' : ''; // Vermelho se < 5
        return `
            <tr>
                <td>${p.nome}</td>
                <td style="text-align:center" class="${classeBaixo}">${p.quantidade_atual}</td>
                <td>${p.unidade}</td>
            </tr>
        `;
    }).join('');
}

els.btnBuscaSaldo.addEventListener('click', () => carregarTabelaSaldo(els.inputBuscaSaldo.value));

els.btnPdfSaldo.addEventListener('click', () => {
    if(!dadosSaldoEstoque || dadosSaldoEstoque.length === 0) return alert("Nada para imprimir");
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Inventário de Estoque - Agricultura", 14, 20);
    doc.setFontSize(10);
    doc.text(`Data da Conferência: ${new Date().toLocaleString()}`, 14, 28);

    const linhas = dadosSaldoEstoque.map(p => [p.nome, p.quantidade_atual, p.unidade]);

    doc.autoTable({
        head: [['Produto', 'Quantidade', 'Unidade']],
        body: linhas,
        startY: 35,
        theme: 'striped',
        headStyles: { fillColor: [230, 126, 34] } // Laranja
    });
    
    doc.save("inventario_estoque.pdf");
});


// =======================================================
// --- RELATÓRIOS (HISTÓRICO) ---
// =======================================================
async function carregarFiltrosRelatorio() {
    const { data: maqs } = await supabase.from('maquinas').select('*').order('nome');
    if(maqs) els.relMaquina.innerHTML = '<option value="">Todas as Máquinas</option>' + maqs.map(m => `<option value="${m.id}">${m.nome}</option>`).join('');
    const { data: dests } = await supabase.from('destinos').select('*').order('nome');
    if(dests) els.relDestino.innerHTML = '<option value="">Todos os Destinos</option>' + dests.map(d => `<option value="${d.id}">${d.nome}</option>`).join('');
}

els.btnFiltrarRel.addEventListener('click', async () => {
    els.containerResultados.classList.remove('hidden');
    els.tabelaRelatorio.innerHTML = '<tr><td colspan="5">Pesquisando...</td></tr>';
    
    let query = supabase.from('movimentacoes')
        .select(`criado_em, tipo, quantidade, produtos(nome, unidade), destinos(nome), maquinas(nome)`)
        .order('criado_em', { ascending: false });

    if (els.relDataInicio.value) query = query.gte('criado_em', els.relDataInicio.value + 'T00:00:00');
    if (els.relDataFim.value) query = query.lte('criado_em', els.relDataFim.value + 'T23:59:59');
    if (els.relMaquina.value) query = query.eq('maquina_id', els.relMaquina.value);
    if (els.relDestino.value) query = query.eq('destino_id', els.relDestino.value);

    const { data, error } = await query;
    if (error) return alert("Erro ao buscar.");

    dadosRelatorioAtual = data;
    preencherTabelaRelatorio(data);
});

function preencherTabelaRelatorio(dados) {
    if (!dados || dados.length === 0) {
        els.tabelaRelatorio.innerHTML = '<tr><td colspan="5" style="text-align:center">Nenhum registro.</td></tr>';
        return;
    }
    els.tabelaRelatorio.innerHTML = dados.map(item => {
        const d = new Date(item.criado_em);
        const cor = item.tipo === 'ENTRADA' ? 'green' : 'red';
        let local = item.maquinas ? `🚜 ${item.maquinas.nome}` : (item.destinos ? item.destinos.nome : '-');

        return `
            <tr>
                <td>${d.toLocaleDateString('pt-BR')}<br><small>${d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</small></td>
                <td>${item.produtos?.nome || 'Excluído'}</td>
                <td style="color:${cor}; font-weight:bold">${item.tipo}</td>
                <td>${item.quantidade} ${item.produtos?.unidade || ''}</td>
                <td>${local}</td>
            </tr>`;
    }).join('');
}

els.btnGerarPdf.addEventListener('click', () => {
    if (!dadosRelatorioAtual || dadosRelatorioAtual.length === 0) return alert("Nada para imprimir.");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text("Relatório Histórico", 14, 20); doc.setFontSize(10); doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 28);
    
    const linhas = dadosRelatorioAtual.map(item => [
        new Date(item.criado_em).toLocaleDateString('pt-BR'),
        item.produtos?.nome || '?',
        item.tipo,
        `${item.quantidade} ${item.produtos?.unidade || ''}`,
        item.maquinas ? item.maquinas.nome : (item.destinos ? item.destinos.nome : '')
    ]);

    doc.autoTable({ head: [['Data', 'Produto', 'Tipo', 'Qtd', 'Destino/Maq']], body: linhas, startY: 35, theme: 'grid', headStyles: { fillColor: [41, 128, 185] } });
    doc.save("historico_agricultura.pdf");
});

// =======================================================
// --- OUTRAS LÓGICAS (MANTIDAS) ---
// =======================================================
els.movDestino.addEventListener('change', (e) => {
    const txt = e.target.options[e.target.selectedIndex]?.text.toLowerCase() || '';
    if(txt.includes('frota') || txt.includes('manutenção') || txt.includes('oficina')) els.boxMaquina.classList.remove('hidden');
    else { els.boxMaquina.classList.add('hidden'); els.selectMaquina.value = ""; }
});

function resetarMovimentacao() {
    els.containerBuscaManual.classList.remove('hidden'); els.formMov.classList.add('hidden'); els.areaScannerMov.classList.add('hidden');
    els.inputBuscaMov.value = ''; els.movQtd.value = ''; els.selectMaquina.value = ''; els.boxMaquina.classList.add('hidden');
    pararScanner();
}
els.btnBuscarMov.addEventListener('click', () => { if(els.inputBuscaMov.value) buscarProdutoMov(els.inputBuscaMov.value); });
els.btnAtivarScanner.addEventListener('click', () => { els.areaScannerMov.classList.remove('hidden'); iniciarScanner("reader-mov", (c) => { pararScanner(); buscarProdutoMov(c); }); });
function pararScannerMovimentacao() { pararScanner(); els.areaScannerMov.classList.add('hidden'); }

async function buscarProdutoMov(termoOriginal) {
    const termo = termoOriginal.trim();
    let { data } = await supabase.from('produtos').select('*').eq('codigo_barras', termo).maybeSingle();
    if (!data) { const { data: list } = await supabase.from('produtos').select('*').ilike('nome', `%${termo}%`).limit(1); if (list && list.length > 0) data = list[0]; }
    if (data) {
        produtoSelecionado = data; els.containerBuscaManual.classList.add('hidden'); els.areaScannerMov.classList.add('hidden'); els.formMov.classList.remove('hidden');
        els.movNome.innerText = data.nome; els.movCodigo.innerText = `Cód: ${data.codigo_barras||'Manual'}`; els.movSaldo.innerText = `Saldo: ${data.quantidade_atual} ${data.unidade}`;
        atualizarEstiloBotaoMov();
    } else alert("Produto não encontrado.");
}

els.btnConfirmarMov.addEventListener('click', async () => {
    const tipo = document.querySelector('input[name="tipo_mov"]:checked').value; const qtd = parseFloat(els.movQtd.value); const destinoId = els.movDestino.value;
    let maquinaId = null; if(!els.boxMaquina.classList.contains('hidden')) { maquinaId = els.selectMaquina.value; if(!maquinaId && tipo === 'SAIDA') return alert("Selecione qual máquina."); if(maquinaId === "") maquinaId = null; }
    if (!qtd || qtd <= 0) return alert("Qtd inválida.");
    let novoSaldo = parseFloat(produtoSelecionado.quantidade_atual);
    if (tipo === 'SAIDA') { if (qtd > novoSaldo) return alert("Saldo insuficiente."); novoSaldo -= qtd; } else novoSaldo += qtd;
    const { error: e1 } = await supabase.from('movimentacoes').insert({ produto_id: produtoSelecionado.id, tipo, quantidade: qtd, destino_id: (tipo==='SAIDA'?destinoId:null), maquina_id: (tipo==='SAIDA'?maquinaId:null) });
    const { error: e2 } = await supabase.from('produtos').update({ quantidade_atual: novoSaldo }).eq('id', produtoSelecionado.id);
    if (!e1 && !e2) { alert("Sucesso!"); navegar('home'); } else alert("Erro ao salvar.");
});

document.querySelectorAll('input[name="tipo_mov"]').forEach(r => r.addEventListener('change', atualizarEstiloBotaoMov));
function atualizarEstiloBotaoMov() {
    const tipo = document.querySelector('input[name="tipo_mov"]:checked').value;
    if (tipo === 'ENTRADA') { els.boxDestino.style.display = 'none'; els.boxMaquina.style.display = 'none'; els.btnConfirmarMov.innerText = "CONFIRMAR ENTRADA"; els.btnConfirmarMov.style.backgroundColor = "var(--primary)"; } 
    else { els.boxDestino.style.display = 'block'; const txt = els.movDestino.options[els.movDestino.selectedIndex]?.text.toLowerCase() || ''; if(txt.includes('frota')||txt.includes('manutenção')) { els.boxMaquina.classList.remove('hidden'); els.boxMaquina.style.display='block'; } els.btnConfirmarMov.innerText = "CONFIRMAR SAÍDA"; els.btnConfirmarMov.style.backgroundColor = "var(--saida)"; }
}

els.btnSalvarNovo.addEventListener('click', async () => {
    const cod = els.cadCodigo.value.trim(); const nome = els.cadNome.value.trim(); const unid = els.cadUnidade.value;
    if (!nome) return alert("Nome obrigatório.");
    const dados = { codigo_barras: cod, nome, unidade: unid }; let erro = null;
    if (produtoEmEdicaoId) { const {error} = await supabase.from('produtos').update(dados).eq('id', produtoEmEdicaoId); erro = error; }
    else { dados.quantidade_atual = 0; const {error} = await supabase.from('produtos').insert(dados); erro = error; }
    if (!erro) { alert("Salvo!"); if(produtoEmEdicaoId) navegar('gestao'); else navegar('home'); } else alert("Erro.");
});
async function carregarListaGestao(filtro='') {
    els.listaGestao.innerHTML = 'Carregando...'; let query = supabase.from('produtos').select('*').order('nome'); if (filtro) query = query.ilike('nome', `%${filtro.trim()}%`); const { data } = await query;
    if (!data || data.length === 0) { els.listaGestao.innerHTML = 'Nada encontrado.'; return; }
    els.listaGestao.innerHTML = data.map(p => `<li class="lista-custom"><div><strong>${p.nome}</strong><br><small>${p.codigo_barras||'-'}</small><br><span style="color:green">${p.quantidade_atual} ${p.unidade}</span></div><div class="acoes-gestao"><button onclick="prepararEdicao(${p.id})" class="btn-icon-acao cor-edit"><span class="material-icons">edit</span></button><button onclick="excluirProduto(${p.id})" class="btn-icon-acao cor-del"><span class="material-icons">delete</span></button></div></li>`).join('');
}
els.btnBuscaGestao.addEventListener('click', () => carregarListaGestao(els.inputBuscaGestao.value));
window.prepararEdicao = async (id) => { const { data } = await supabase.from('produtos').select('*').eq('id', id).single(); if(data) { els.telaGestao.classList.remove('ativa'); els.telaCad.classList.add('ativa'); els.titulo.innerText = 'Editar'; els.tituloCadastro.innerText = 'Editando: ' + data.nome; produtoEmEdicaoId = data.id; els.cadCodigo.value = data.codigo_barras||''; els.cadNome.value = data.nome; els.cadUnidade.value = data.unidade; } };
window.excluirProduto = async (id) => { if(confirm("Excluir?")) { const {error} = await supabase.from('produtos').delete().eq('id', id); if(error) alert("Item usado."); else carregarListaGestao(); } };
function resetarFormCadastro() { produtoEmEdicaoId = null; els.titulo.innerText = 'Novo'; els.cadCodigo.value=''; els.cadNome.value=''; els.cadUnidade.value='un'; }

els.btnAddMaq.addEventListener('click', async () => { const nome = els.maqNome.value.trim(); if(!nome) return alert("Digite o nome."); const { error } = await supabase.from('maquinas').insert({ nome }); if(!error) { els.maqNome.value=''; carregarListaMaquinasEdit(); carregarMaquinasSelect(); alert("Cadastrado!"); } else alert("Erro."); });
async function carregarListaMaquinasEdit() { els.listaMaquinas.innerHTML = 'Carregando...'; const { data } = await supabase.from('maquinas').select('*').order('nome'); if(data) els.listaMaquinas.innerHTML = data.map(m => `<li class="lista-custom"><span>🚜 ${m.nome}</span><button onclick="excluirMaquina(${m.id})" style="color:red;border:none;background:none;cursor:pointer;"><span class="material-icons">delete</span></button></li>`).join(''); }
window.excluirMaquina = async (id) => { if(!confirm("Excluir?")) return; const { error } = await supabase.from('maquinas').delete().eq('id', id); if(error) alert("Em uso."); else carregarListaMaquinasEdit(); };
async function carregarMaquinasSelect() { const { data } = await supabase.from('maquinas').select('*').order('nome'); if(data) els.selectMaquina.innerHTML = '<option value="">Selecione...</option>' + data.map(m => `<option value="${m.id}">${m.nome}</option>`).join(''); }

function iniciarScanner(elemId, cb) { if (scannerAtivo) scannerAtivo.clear().catch(()=>{}); scannerAtivo = new Html5Qrcode(elemId); const config = { fps: 10, qrbox: { width: 300, height: 150 }, aspectRatio: 1.0, experimentalFeatures: { useBarCodeDetectorIfSupported: true } }; scannerAtivo.start({ facingMode: "environment" }, config, (t) => cb(t)).catch(err => alert("Erro Cam")); }
function pararScanner() { if (scannerAtivo) { scannerAtivo.stop().catch(()=>{}); scannerAtivo = null; } }
els.btnScanCad.addEventListener('click', () => { els.areaScannerCad.classList.remove('hidden'); iniciarScanner("reader-cad", (c) => { els.cadCodigo.value = c; pararScannerCadastro(); }); });
function pararScannerCadastro() { pararScanner(); els.areaScannerCad.classList.add('hidden'); }
async function carregarDestinos() { const { data } = await supabase.from('destinos').select('*'); if (data) els.movDestino.innerHTML = data.map(d => `<option value="${d.id}">${d.nome}</option>`).join(''); }
async function atualizarResumo() { const { data } = await supabase.from('movimentacoes').select(`tipo, quantidade, produtos(nome, unidade)`).order('criado_em', { ascending: false }).limit(4); if (data) els.listaResumo.innerHTML = data.map(m => `<li><span>${m.produtos.nome}</span><strong>${m.tipo==='ENTRADA'?'+':'-'}${m.quantidade}</strong></li>`).join(''); }