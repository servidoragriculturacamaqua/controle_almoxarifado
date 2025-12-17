// CONFIGURAÇÃO DO SUPABASE
const SUPABASE_URL = 'https://fdgxueegvlcyopolswpw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkZ3h1ZWVndmxjeW9wb2xzd3B3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNjUzMzYsImV4cCI6MjA4MDg0MTMzNn0.uWVZfcJ_95IDennMWHpnk2JiGrcun3DnKQPEEC_rYos';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- 🔒 SEGURANÇA ---
(async function verificarSessao() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) window.location.href = 'login.html';
})();
async function sairDoSistema() { await sb.auth.signOut(); window.location.href = 'login.html'; }

// --- VARIÁVEIS ---
let scannerAtivo = null, produtoSelecionado = null, produtoEmEdicaoId = null, dadosRelatorioAtual = [], dadosSaldoEstoque = [];
let chartInstance = null;

// --- ELEMENTOS ---
const els = {
    btnHome: document.getElementById('btn-home'), titulo: document.getElementById('titulo-pagina'),
    telaMenu: document.getElementById('tela-menu'), telaMov: document.getElementById('tela-movimentacao'), telaGestao: document.getElementById('tela-gestao'), telaCad: document.getElementById('tela-cadastro'), telaMaquinas: document.getElementById('tela-maquinas'), telaDestinos: document.getElementById('tela-destinos'), telaRelatorios: document.getElementById('tela-relatorios'), telaSaldo: document.getElementById('tela-saldo'),
    tabelaSaldo: document.querySelector('#tabela-saldo tbody'), btnPdfSaldo: document.getElementById('btn-pdf-saldo'), inputBuscaSaldo: document.getElementById('input-busca-saldo'), btnBuscaSaldo: document.getElementById('btn-busca-saldo'),
    relDataInicio: document.getElementById('rel-data-inicio'), relDataFim: document.getElementById('rel-data-fim'), relMaquina: document.getElementById('rel-maquina'), relDestino: document.getElementById('rel-destino'), btnFiltrarRel: document.getElementById('btn-filtrar-relatorio'), containerResultados: document.getElementById('container-resultados-relatorio'), tabelaRelatorio: document.querySelector('#tabela-relatorio tbody'), btnGerarPdf: document.getElementById('btn-gerar-pdf'),
    listaGestao: document.getElementById('lista-gestao-produtos'), inputBuscaGestao: document.getElementById('input-busca-gestao'), btnBuscaGestao: document.getElementById('btn-busca-gestao'),
    containerBuscaManual: document.getElementById('busca-manual-container'), inputBuscaMov: document.getElementById('input-busca-manual'), btnBuscarMov: document.getElementById('btn-buscar-manual'), btnAtivarScanner: document.getElementById('btn-ativar-scanner'), areaScannerMov: document.getElementById('area-scanner-mov'), formMov: document.getElementById('form-movimentacao'), movNome: document.getElementById('mov-nome-produto'), movSaldo: document.getElementById('mov-saldo-atual'), movCodigo: document.getElementById('mov-codigo-produto'), movQtd: document.getElementById('mov-qtd'), movDestino: document.getElementById('mov-destino'), boxDestino: document.getElementById('box-destino'), boxMaquina: document.getElementById('box-maquina'), selectMaquina: document.getElementById('mov-select-maquina'), btnConfirmarMov: document.getElementById('btn-confirmar-mov'),
    tituloCadastro: document.getElementById('titulo-cadastro'), cadId: document.getElementById('cad-id-editar'), cadCodigo: document.getElementById('cad-codigo'), cadNome: document.getElementById('cad-nome'), cadUnidade: document.getElementById('cad-unidade'), btnSalvarNovo: document.getElementById('btn-salvar-novo'), btnScanCad: document.getElementById('btn-scan-cad'), areaScannerCad: document.getElementById('reader-cad-container'),
    maqNome: document.getElementById('maq-nome'), btnAddMaq: document.getElementById('btn-add-maq'), listaMaquinas: document.getElementById('lista-maquinas'),
    destNome: document.getElementById('dest-nome'), btnAddDest: document.getElementById('btn-add-dest'), listaDestinos: document.getElementById('lista-destinos'),
    listaResumo: document.getElementById('lista-resumo'),
    imgLogo: document.getElementById('logo-header')
};

// --- INICIALIZAÇÃO E NAV ---
window.onload = () => { carregarDestinos(); carregarMaquinasSelect(); atualizarResumo(); carregarGraficoResumo(); };

function navegar(destino) {
    document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa')); els.btnHome.style.display = 'block';
    
    if (destino === 'home') { 
        els.telaMenu.classList.add('ativa'); els.titulo.innerText = 'Menu Principal'; els.btnHome.style.display = 'none'; 
        pararScanner(); atualizarResumo(); carregarGraficoResumo();
    }
    else if (destino === 'movimentacao') { els.telaMov.classList.add('ativa'); els.titulo.innerText = 'Movimentação'; resetarMovimentacao(); carregarDestinos(); }
    else if (destino === 'saldo') { els.telaSaldo.classList.add('ativa'); els.titulo.innerText = 'Saldo de Estoque'; carregarTabelaSaldo(); }
    else if (destino === 'relatorios') { els.telaRelatorios.classList.add('ativa'); els.titulo.innerText = 'Histórico'; carregarFiltrosRelatorio(); }
    else if (destino === 'gestao') { els.telaGestao.classList.add('ativa'); els.titulo.innerText = 'Gerenciar Produtos'; carregarListaGestao(); }
    else if (destino === 'cadastro') { els.telaCad.classList.add('ativa'); resetarFormCadastro(); }
    else if (destino === 'maquinas') { els.telaMaquinas.classList.add('ativa'); els.titulo.innerText = 'Máquinas'; carregarListaMaquinasEdit(); }
    else if (destino === 'destinos') { els.telaDestinos.classList.add('ativa'); els.titulo.innerText = 'Locais / Setores'; carregarListaDestinosEdit(); }
}
els.btnHome.addEventListener('click', () => navegar('home'));

// --- GRÁFICO (DASHBOARD) ---
async function carregarGraficoResumo() {
    const canvas = document.getElementById('graficoEstoque');
    if (!canvas) return; // Se não estiver na tela home, ignora
    const ctx = canvas.getContext('2d');

    let { data } = await sb.from('produtos').select('nome, quantidade_atual').order('quantidade_atual', {ascending: false}).limit(5);

    let nomes, qtds;
    if (!data || data.length === 0 || (data[0] && data[0].quantidade_atual === 0)) {
        nomes = ['Exemplo Adubo', 'Exemplo Ureia', 'Exemplo Diesel', 'Exemplo Sementes', 'Exemplo Peças'];
        qtds = [50, 40, 30, 20, 10];
    } else {
        nomes = data.map(d => d.nome);
        qtds = data.map(d => d.quantidade_atual);
    }

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: nomes,
            datasets: [{
                label: 'Estoque',
                data: qtds,
                backgroundColor: ['rgba(39, 174, 96, 0.7)', 'rgba(41, 128, 185, 0.7)', 'rgba(230, 126, 34, 0.7)', 'rgba(142, 68, 173, 0.7)', 'rgba(44, 62, 80, 0.7)'],
                borderColor: ['#27ae60', '#2980b9', '#e67e22', '#8e44ad', '#2c3e50'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

// --- HELPER PDF (CABEÇALHO) ---
function getLogoBase64() {
    if (!els.imgLogo) return null;
    const canvas = document.createElement("canvas");
    canvas.width = els.imgLogo.naturalWidth;
    canvas.height = els.imgLogo.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(els.imgLogo, 0, 0);
    return canvas.toDataURL("image/png");
}
function adicionarCabecalhoPdf(doc, tituloDoc) {
    try { const logoData = getLogoBase64(); if(logoData) doc.addImage(logoData, 'PNG', 14, 10, 25, 25); } catch(e) {}
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text("PREFEITURA MUNICIPAL DE CAMAQUÃ", 105, 18, { align: "center" });
    doc.setFontSize(10); doc.text("SECRETARIA MUNICIPAL DE AGRICULTURA E ABASTECIMENTO", 105, 24, { align: "center" });
    doc.setFontSize(14); doc.text(tituloDoc, 105, 40, { align: "center" }); doc.setLineWidth(0.5); doc.line(14, 45, 196, 45);
}

// --- FUNÇÕES GERAIS ---
async function carregarTabelaSaldo(filtro='') {
    els.tabelaSaldo.innerHTML = '<tr><td colspan="3">Carregando...</td></tr>';
    let query = sb.from('produtos').select('nome, quantidade_atual, unidade').order('nome');
    if (filtro) query = query.ilike('nome', `%${filtro.trim()}%`);
    const { data } = await query; dadosSaldoEstoque = data || [];
    if (!data || data.length === 0) { els.tabelaSaldo.innerHTML = '<tr><td colspan="3">Vazio.</td></tr>'; return; }
    els.tabelaSaldo.innerHTML = data.map(p => `<tr><td>${p.nome}</td><td style="text-align:center" class="${p.quantidade_atual<5?'estoque-baixo':''}">${p.quantidade_atual}</td><td>${p.unidade}</td></tr>`).join('');
}
els.btnBuscaSaldo.addEventListener('click', () => carregarTabelaSaldo(els.inputBuscaSaldo.value));

els.btnPdfSaldo.addEventListener('click', () => {
    if(!dadosSaldoEstoque.length) return Swal.fire('Atenção', 'Nada para imprimir.', 'warning');
    const { jsPDF } = window.jspdf; const doc = new jsPDF();
    adicionarCabecalhoPdf(doc, "INVENTÁRIO DE ESTOQUE");
    doc.autoTable({ head: [['Produto', 'Qtd', 'Unid']], body: dadosSaldoEstoque.map(p=>[p.nome, p.quantidade_atual, p.unidade]), startY: 50, theme: 'grid' });
    doc.save("inventario_agricultura.pdf");
});

async function carregarFiltrosRelatorio() {
    const { data: maqs } = await sb.from('maquinas').select('*'); if(maqs) els.relMaquina.innerHTML = '<option value="">Todas</option>' + maqs.map(m=>`<option value="${m.id}">${m.nome}</option>`).join('');
    const { data: dests } = await sb.from('destinos').select('*'); if(dests) els.relDestino.innerHTML = '<option value="">Todos</option>' + dests.map(d=>`<option value="${d.id}">${d.nome}</option>`).join('');
}
els.btnFiltrarRel.addEventListener('click', async () => {
    els.containerResultados.classList.remove('hidden'); els.tabelaRelatorio.innerHTML = '<tr><td colspan="5">Pesquisando...</td></tr>';
    let query = sb.from('movimentacoes').select(`criado_em, tipo, quantidade, produtos(nome, unidade), destinos(nome), maquinas(nome)`).order('criado_em', { ascending: false });
    if (els.relDataInicio.value) query = query.gte('criado_em', els.relDataInicio.value + 'T00:00:00');
    if (els.relDataFim.value) query = query.lte('criado_em', els.relDataFim.value + 'T23:59:59');
    if (els.relMaquina.value) query = query.eq('maquina_id', els.relMaquina.value);
    if (els.relDestino.value) query = query.eq('destino_id', els.relDestino.value);
    const { data } = await query; dadosRelatorioAtual = data || [];
    if (!data || !data.length) { els.tabelaRelatorio.innerHTML = '<tr><td colspan="5">Nenhum registro.</td></tr>'; return; }
    els.tabelaRelatorio.innerHTML = data.map(i => `<tr><td>${new Date(i.criado_em).toLocaleDateString()}</td><td>${i.produtos?.nome}</td><td style="color:${i.tipo==='ENTRADA'?'green':'red'}">${i.tipo}</td><td>${i.quantidade}</td><td>${i.maquinas?.nome || i.destinos?.nome || '-'}</td></tr>`).join('');
});

els.btnGerarPdf.addEventListener('click', () => {
    if(!dadosRelatorioAtual.length) return Swal.fire('Atenção', 'Nada para imprimir.', 'warning');
    const { jsPDF } = window.jspdf; const doc = new jsPDF();
    adicionarCabecalhoPdf(doc, "HISTÓRICO DE MOVIMENTAÇÃO");
    doc.autoTable({ head: [['Data', 'Produto', 'Tipo', 'Qtd', 'Local']], body: dadosRelatorioAtual.map(i=>[new Date(i.criado_em).toLocaleDateString(), i.produtos?.nome, i.tipo, i.quantidade, i.maquinas?.nome||i.destinos?.nome||'']), startY: 50, theme: 'grid' });
    doc.save("historico_agricultura.pdf");
});

// --- LÓGICA DE MOVIMENTAÇÃO ---
els.movDestino.addEventListener('change', (e) => { const txt = e.target.options[e.target.selectedIndex]?.text.toLowerCase() || ''; if(txt.includes('frota')||txt.includes('manutenção')||txt.includes('oficina')) { els.boxMaquina.classList.remove('hidden'); carregarMaquinasSelect(); } else { els.boxMaquina.classList.add('hidden'); els.selectMaquina.value = ""; } });
function resetarMovimentacao() { els.containerBuscaManual.classList.remove('hidden'); els.formMov.classList.add('hidden'); els.areaScannerMov.classList.add('hidden'); els.inputBuscaMov.value=''; els.movQtd.value=''; els.selectMaquina.value=''; els.boxMaquina.classList.add('hidden'); pararScanner(); }
els.btnBuscarMov.addEventListener('click', () => { if(els.inputBuscaMov.value) buscarProdutoMov(els.inputBuscaMov.value); });
els.btnAtivarScanner.addEventListener('click', () => { els.areaScannerMov.classList.remove('hidden'); iniciarScanner("reader-mov", c => { pararScanner(); buscarProdutoMov(c); }); });
function pararScannerMovimentacao() { pararScanner(); els.areaScannerMov.classList.add('hidden'); }
async function buscarProdutoMov(termo) {
    termo = termo.trim(); let { data } = await sb.from('produtos').select('*').eq('codigo_barras', termo).maybeSingle();
    if (!data) { const {data:l} = await sb.from('produtos').select('*').ilike('nome', `%${termo}%`).limit(1); if(l&&l.length) data=l[0]; }
    if (data) { produtoSelecionado = data; els.containerBuscaManual.classList.add('hidden'); els.areaScannerMov.classList.add('hidden'); els.formMov.classList.remove('hidden'); els.movNome.innerText = data.nome; els.movCodigo.innerText = data.codigo_barras||'Manual'; els.movSaldo.innerText = `Saldo: ${data.quantidade_atual} ${data.unidade}`; atualizarEstiloBotaoMov(); } else Swal.fire('Erro', 'Produto não encontrado.', 'error');
}
els.btnConfirmarMov.addEventListener('click', async () => {
    const tipo = document.querySelector('input[name="tipo_mov"]:checked').value; const qtd = parseFloat(els.movQtd.value); let maq = null;
    if(!els.boxMaquina.classList.contains('hidden')) { maq = els.selectMaquina.value; if(!maq && tipo === 'SAIDA') return Swal.fire('Atenção', 'Selecione a máquina.', 'warning'); if(!maq) maq=null; }
    if (!qtd || qtd <= 0) return Swal.fire('Atenção', 'Quantidade inválida.', 'warning');
    let novoSaldo = parseFloat(produtoSelecionado.quantidade_atual); if (tipo === 'SAIDA') { if (qtd > novoSaldo) return Swal.fire('Erro', 'Saldo insuficiente.', 'error'); novoSaldo -= qtd; } else novoSaldo += qtd;
    const {error:e1} = await sb.from('movimentacoes').insert({ produto_id: produtoSelecionado.id, tipo, quantidade: qtd, destino_id: (tipo==='SAIDA'?els.movDestino.value:null), maquina_id: (tipo==='SAIDA'?maq:null) });
    const {error:e2} = await sb.from('produtos').update({ quantidade_atual: novoSaldo }).eq('id', produtoSelecionado.id);
    if (!e1 && !e2) { Swal.fire({ title: 'Sucesso!', text: 'Movimentação realizada.', icon: 'success', timer: 1500, showConfirmButton: false }); setTimeout(() => navegar('home'), 1500); } else Swal.fire('Erro', 'Falha ao salvar.', 'error');
});
function atualizarEstiloBotaoMov() { const tipo = document.querySelector('input[name="tipo_mov"]:checked').value; if (tipo === 'ENTRADA') { els.boxDestino.style.display = 'none'; els.boxMaquina.style.display = 'none'; els.btnConfirmarMov.innerText="ENTRADA"; els.btnConfirmarMov.style.backgroundColor="var(--primary)"; } else { els.boxDestino.style.display = 'block'; els.btnConfirmarMov.innerText="SAÍDA"; els.btnConfirmarMov.style.backgroundColor="var(--saida)"; const txt = els.movDestino.options[els.movDestino.selectedIndex]?.text.toLowerCase() || ''; if(txt.includes('frota')||txt.includes('manutenção')) els.boxMaquina.classList.remove('hidden'); } }
document.querySelectorAll('input[name="tipo_mov"]').forEach(r => r.addEventListener('change', atualizarEstiloBotaoMov));

// CRUDs (Produtos)
els.btnSalvarNovo.addEventListener('click', async () => { const cod = els.cadCodigo.value.trim(), nome = els.cadNome.value.trim(), unid = els.cadUnidade.value; if (!nome) return Swal.fire('Atenção', 'Nome é obrigatório.', 'warning'); const dados = { codigo_barras: cod, nome, unidade: unid }; let err = null; if (produtoEmEdicaoId) { const {error} = await sb.from('produtos').update(dados).eq('id', produtoEmEdicaoId); err=error; } else { dados.quantidade_atual = 0; const {error} = await sb.from('produtos').insert(dados); err=error; } if (!err) { Swal.fire({ title: 'Salvo!', icon: 'success', timer: 1000, showConfirmButton: false }); navegar(produtoEmEdicaoId ? 'gestao' : 'home'); } else Swal.fire('Erro', 'Falha ao salvar.', 'error'); });
async function carregarListaGestao(f='') { els.listaGestao.innerHTML = 'Carregando...'; let q = sb.from('produtos').select('*').order('nome'); if(f) q=q.ilike('nome',`%${f.trim()}%`); const { data } = await q; if (!data || !data.length) { els.listaGestao.innerHTML='Vazio.'; return; } els.listaGestao.innerHTML = data.map(p => `<li class="lista-custom"><div><strong>${p.nome}</strong><br><small>${p.codigo_barras||'-'}</small></div><div><button onclick="prepararEdicao(${p.id})" style="border:none;background:none;color:blue;margin-right:10px;">Edit</button><button onclick="excluirProduto(${p.id})" style="border:none;background:none;color:red;">Del</button></div></li>`).join(''); }
els.btnBuscaGestao.addEventListener('click', () => carregarListaGestao(els.inputBuscaGestao.value));
window.prepararEdicao = async (id) => { const {data} = await sb.from('produtos').select('*').eq('id',id).single(); if(data) { els.telaGestao.classList.remove('ativa'); els.telaCad.classList.add('ativa'); els.titulo.innerText='Editar'; produtoEmEdicaoId=data.id; els.cadCodigo.value=data.codigo_barras||''; els.cadNome.value=data.nome; els.cadUnidade.value=data.unidade; } };
window.excluirProduto = async (id) => { const result = await Swal.fire({ title: 'Excluir produto?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Sim' }); if(result.isConfirmed) { const {error} = await sb.from('produtos').delete().eq('id',id); if(error) Swal.fire('Erro', 'Item em uso.', 'error'); else { Swal.fire('Excluído!', '', 'success'); carregarListaGestao(); } } };
function resetarFormCadastro() { produtoEmEdicaoId=null; els.titulo.innerText='Novo'; els.cadCodigo.value=''; els.cadNome.value=''; els.cadUnidade.value='un'; }

// MÁQUINAS (COM HISTÓRICO)
els.btnAddMaq.addEventListener('click', async () => { const n = els.maqNome.value.trim(); if(!n) return; await sb.from('maquinas').insert({nome:n}); els.maqNome.value=''; carregarListaMaquinasEdit(); carregarMaquinasSelect(); });
async function carregarListaMaquinasEdit() { 
    const {data} = await sb.from('maquinas').select('*').order('nome'); 
    if(data) els.listaMaquinas.innerHTML = data.map(m=>`
        <li class="lista-custom">
            <span>${m.nome}</span>
            <div class="acoes-lista">
                <button onclick="verHistoricoGeral(${m.id}, 'maquina', '${m.nome}')" class="btn-icon-acao cor-hist" title="Ver Histórico"><span class="material-icons">history</span></button>
                <button onclick="excluirMaquina(${m.id})" class="btn-icon-acao cor-del" title="Excluir"><span class="material-icons">delete</span></button>
            </div>
        </li>`).join(''); 
}
window.excluirMaquina = async (id) => { const result = await Swal.fire({ title: 'Excluir máquina?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' }); if(result.isConfirmed) { const {error} = await sb.from('maquinas').delete().eq('id',id); if(error) Swal.fire('Erro', 'Em uso.', 'error'); else { Swal.fire('Excluído', '', 'success'); carregarListaMaquinasEdit(); } } };
async function carregarMaquinasSelect() { const {data} = await sb.from('maquinas').select('*').order('nome'); if(data) els.selectMaquina.innerHTML='<option value="">Selecione...</option>'+data.map(m=>`<option value="${m.id}">${m.nome}</option>`).join(''); }

// LOCAIS (COM HISTÓRICO)
els.btnAddDest.addEventListener('click', async () => { const n = els.destNome.value.trim(); if(!n) return Swal.fire('Atenção', 'Digite nome.', 'warning'); const { error } = await sb.from('destinos').insert({nome:n}); if(error) Swal.fire('Erro', 'Falha.', 'error'); else { els.destNome.value=''; carregarListaDestinosEdit(); carregarDestinos(); } });
async function carregarListaDestinosEdit() { 
    els.listaDestinos.innerHTML = 'Carregando...'; 
    const {data} = await sb.from('destinos').select('*').order('nome'); 
    if(data) els.listaDestinos.innerHTML = data.map(d=>`
        <li class="lista-custom">
            <span>${d.nome}</span>
            <div class="acoes-lista">
                <button onclick="verHistoricoGeral(${d.id}, 'destino', '${d.nome}')" class="btn-icon-acao cor-hist" title="Ver Histórico"><span class="material-icons">history</span></button>
                <button onclick="excluirDestino(${d.id})" class="btn-icon-acao cor-del" title="Excluir"><span class="material-icons">delete</span></button>
            </div>
        </li>`).join(''); 
}
window.excluirDestino = async (id) => { const result = await Swal.fire({ title: 'Excluir local?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' }); if(result.isConfirmed) { const {error} = await sb.from('destinos').delete().eq('id',id); if(error) Swal.fire('Erro', 'Em uso.', 'error'); else { Swal.fire('Excluído', '', 'success'); carregarListaDestinosEdit(); carregarDestinos(); } } };
async function carregarDestinos() { const {data} = await sb.from('destinos').select('*').order('nome'); if(data) els.movDestino.innerHTML = data.map(d=>`<option value="${d.id}">${d.nome}</option>`).join(''); }

// *** FUNÇÃO DO DOSSIÊ (POPUP) ***
window.verHistoricoGeral = async (id, tipo, nome) => {
    Swal.fire({ title: 'Carregando...', didOpen: () => Swal.showLoading() });
    const campoFiltro = (tipo === 'maquina') ? 'maquina_id' : 'destino_id';
    const { data } = await sb.from('movimentacoes').select('quantidade, criado_em, produtos(nome, unidade)').eq(campoFiltro, id).order('criado_em', { ascending: false }).limit(20);

    if (!data || data.length === 0) return Swal.fire('Histórico Vazio', `Nenhum registro encontrado para ${nome}.`, 'info');

    let htmlTable = `<div style="max-height:300px; overflow-y:auto; text-align:left; margin-bottom:15px;">
        <table style="width:100%; font-size:0.9rem; border-collapse: collapse;">
            <thead><tr style="border-bottom:2px solid #ddd; color:#27ae60;"><th>Data</th><th>Item</th><th>Qtd</th></tr></thead>
            <tbody>`;
    data.forEach(item => {
        htmlTable += `<tr style="border-bottom:1px solid #eee;"><td style="padding:8px 0;">${new Date(item.criado_em).toLocaleDateString()}</td><td style="padding:8px 0;">${item.produtos?.nome || '?'}</td><td style="padding:8px 0; font-weight:bold;">${item.quantidade} ${item.produtos?.unidade}</td></tr>`;
    });
    htmlTable += `</tbody></table></div>`;
    
    // Botão para baixar o PDF deste dossiê
    htmlTable += `<button onclick="baixarPdfDossie(${id}, '${tipo}', '${nome}')" class="btn-action" style="padding:10px; background-color:#c0392b; display:flex; align-items:center; justify-content:center; gap:8px;"><span class="material-icons">picture_as_pdf</span> BAIXAR DOSSIÊ PDF</button>`;

    Swal.fire({ title: `Histórico: ${nome}`, html: htmlTable, width: '600px', showConfirmButton: false, showCloseButton: true });
};

// *** FUNÇÃO PDF DOSSIÊ ***
window.baixarPdfDossie = async (id, tipo, nome) => {
    const campoFiltro = (tipo === 'maquina') ? 'maquina_id' : 'destino_id';
    const { data } = await sb.from('movimentacoes').select('quantidade, criado_em, tipo, produtos(nome, unidade)').eq(campoFiltro, id).order('criado_em', { ascending: false });

    if (!data || !data.length) return;

    const { jsPDF } = window.jspdf; 
    const doc = new jsPDF();
    
    adicionarCabecalhoPdf(doc, `DOSSIÊ: ${nome.toUpperCase()}`);
    
    doc.autoTable({ 
        head: [['Data', 'Produto', 'Tipo', 'Qtd']], 
        body: data.map(i=>[new Date(i.criado_em).toLocaleDateString(), i.produtos?.nome, i.tipo, `${i.quantidade} ${i.produtos?.unidade}`]), 
        startY: 50, theme: 'grid' 
    });
    
    doc.save(`historico_${nome.replace(/ /g,"_")}.pdf`);
};

// --- UTILITÁRIOS ---
function iniciarScanner(elemId, cb) { if(scannerAtivo) scannerAtivo.clear().catch(()=>{}); scannerAtivo = new Html5Qrcode(elemId); const config = { fps: 20, qrbox: { width: 320, height: 100 }, aspectRatio: 2.0, experimentalFeatures: { useBarCodeDetectorIfSupported: true } }; scannerAtivo.start({ facingMode: "environment" }, config, cb).catch(err => Swal.fire('Erro Câmera', err, 'error')); }
function pararScanner() { if(scannerAtivo) { scannerAtivo.stop().catch(()=>{}); scannerAtivo=null; } }
els.btnScanCad.addEventListener('click', () => { els.areaScannerCad.classList.remove('hidden'); iniciarScanner("reader-cad", c => { els.cadCodigo.value=c; pararScannerCadastro(); }); });
function pararScannerCadastro() { pararScanner(); els.areaScannerCad.classList.add('hidden'); }
async function atualizarResumo() { const {data} = await sb.from('movimentacoes').select('tipo, quantidade, produtos(nome, unidade)').order('criado_em',{ascending:false}).limit(4); if(data) els.listaResumo.innerHTML = data.map(m=>`<li><span>${m.produtos.nome}</span><strong>${m.tipo==='ENTRADA'?'+':'-'}${m.quantidade}</strong></li>`).join(''); }