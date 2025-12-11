// CONFIGURAÇÃO DO SUPABASE
const SUPABASE_URL = 'https://fdgxueegvlcyopolswpw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkZ3h1ZWVndmxjeW9wb2xzd3B3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNjUzMzYsImV4cCI6MjA4MDg0MTMzNn0.uWVZfcJ_95IDennMWHpnk2JiGrcun3DnKQPEEC_rYos';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- 🔒 SEGURANÇA ---
(async function verificarSessao() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) window.location.href = 'login.html';
})();
async function sairDoSistema() { await supabase.auth.signOut(); window.location.href = 'login.html'; }

// --- VARIÁVEIS ---
let scannerAtivo = null, produtoSelecionado = null, produtoEmEdicaoId = null, dadosRelatorioAtual = [], dadosSaldoEstoque = [];

// --- ELEMENTOS ---
const els = {
    btnHome: document.getElementById('btn-home'), titulo: document.getElementById('titulo-pagina'),
    telaMenu: document.getElementById('tela-menu'), telaMov: document.getElementById('tela-movimentacao'), telaGestao: document.getElementById('tela-gestao'), telaCad: document.getElementById('tela-cadastro'), telaMaquinas: document.getElementById('tela-maquinas'), telaRelatorios: document.getElementById('tela-relatorios'), telaSaldo: document.getElementById('tela-saldo'),
    tabelaSaldo: document.querySelector('#tabela-saldo tbody'), btnPdfSaldo: document.getElementById('btn-pdf-saldo'), inputBuscaSaldo: document.getElementById('input-busca-saldo'), btnBuscaSaldo: document.getElementById('btn-busca-saldo'),
    relDataInicio: document.getElementById('rel-data-inicio'), relDataFim: document.getElementById('rel-data-fim'), relMaquina: document.getElementById('rel-maquina'), relDestino: document.getElementById('rel-destino'), btnFiltrarRel: document.getElementById('btn-filtrar-relatorio'), containerResultados: document.getElementById('container-resultados-relatorio'), tabelaRelatorio: document.querySelector('#tabela-relatorio tbody'), btnGerarPdf: document.getElementById('btn-gerar-pdf'),
    listaGestao: document.getElementById('lista-gestao-produtos'), inputBuscaGestao: document.getElementById('input-busca-gestao'), btnBuscaGestao: document.getElementById('btn-busca-gestao'),
    containerBuscaManual: document.getElementById('busca-manual-container'), inputBuscaMov: document.getElementById('input-busca-manual'), btnBuscarMov: document.getElementById('btn-buscar-manual'), btnAtivarScanner: document.getElementById('btn-ativar-scanner'), areaScannerMov: document.getElementById('area-scanner-mov'), formMov: document.getElementById('form-movimentacao'), movNome: document.getElementById('mov-nome-produto'), movSaldo: document.getElementById('mov-saldo-atual'), movCodigo: document.getElementById('mov-codigo-produto'), movQtd: document.getElementById('mov-qtd'), movDestino: document.getElementById('mov-destino'), boxDestino: document.getElementById('box-destino'), boxMaquina: document.getElementById('box-maquina'), selectMaquina: document.getElementById('mov-select-maquina'), btnConfirmarMov: document.getElementById('btn-confirmar-mov'),
    tituloCadastro: document.getElementById('titulo-cadastro'), cadId: document.getElementById('cad-id-editar'), cadCodigo: document.getElementById('cad-codigo'), cadNome: document.getElementById('cad-nome'), cadUnidade: document.getElementById('cad-unidade'), btnSalvarNovo: document.getElementById('btn-salvar-novo'), btnScanCad: document.getElementById('btn-scan-cad'), areaScannerCad: document.getElementById('reader-cad-container'),
    maqNome: document.getElementById('maq-nome'), btnAddMaq: document.getElementById('btn-add-maq'), listaMaquinas: document.getElementById('lista-maquinas'), listaResumo: document.getElementById('lista-resumo')
};

// --- INICIALIZAÇÃO E NAV ---
window.onload = () => { carregarDestinos(); carregarMaquinasSelect(); atualizarResumo(); };
function navegar(destino) {
    document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa')); els.btnHome.style.display = 'block';
    if (destino === 'home') { els.telaMenu.classList.add('ativa'); els.titulo.innerText = 'Menu Principal'; els.btnHome.style.display = 'none'; pararScanner(); atualizarResumo(); }
    else if (destino === 'movimentacao') { els.telaMov.classList.add('ativa'); els.titulo.innerText = 'Movimentação'; resetarMovimentacao(); }
    else if (destino === 'saldo') { els.telaSaldo.classList.add('ativa'); els.titulo.innerText = 'Saldo de Estoque'; carregarTabelaSaldo(); }
    else if (destino === 'relatorios') { els.telaRelatorios.classList.add('ativa'); els.titulo.innerText = 'Histórico'; carregarFiltrosRelatorio(); }
    else if (destino === 'gestao') { els.telaGestao.classList.add('ativa'); els.titulo.innerText = 'Gerenciar Produtos'; carregarListaGestao(); }
    else if (destino === 'cadastro') { els.telaCad.classList.add('ativa'); resetarFormCadastro(); }
    else if (destino === 'maquinas') { els.telaMaquinas.classList.add('ativa'); els.titulo.innerText = 'Máquinas'; carregarListaMaquinasEdit(); }
}
els.btnHome.addEventListener('click', () => navegar('home'));

// --- FUNÇÕES ---
async function carregarTabelaSaldo(filtro='') {
    els.tabelaSaldo.innerHTML = '<tr><td colspan="3">Carregando...</td></tr>';
    let query = supabase.from('produtos').select('nome, quantidade_atual, unidade').order('nome');
    if (filtro) query = query.ilike('nome', `%${filtro.trim()}%`);
    const { data } = await query; dadosSaldoEstoque = data || [];
    if (!data || data.length === 0) { els.tabelaSaldo.innerHTML = '<tr><td colspan="3">Vazio.</td></tr>'; return; }
    els.tabelaSaldo.innerHTML = data.map(p => `<tr><td>${p.nome}</td><td style="text-align:center" class="${p.quantidade_atual<5?'estoque-baixo':''}">${p.quantidade_atual}</td><td>${p.unidade}</td></tr>`).join('');
}
els.btnBuscaSaldo.addEventListener('click', () => carregarTabelaSaldo(els.inputBuscaSaldo.value));
els.btnPdfSaldo.addEventListener('click', () => {
    if(!dadosSaldoEstoque.length) return alert("Nada para imprimir");
    const { jsPDF } = window.jspdf; const doc = new jsPDF();
    doc.text("Inventário - Agricultura", 14, 20);
    doc.autoTable({ head: [['Produto', 'Qtd', 'Unid']], body: dadosSaldoEstoque.map(p=>[p.nome, p.quantidade_atual, p.unidade]), startY: 30 });
    doc.save("inventario.pdf");
});

async function carregarFiltrosRelatorio() {
    const { data: maqs } = await supabase.from('maquinas').select('*'); if(maqs) els.relMaquina.innerHTML = '<option value="">Todas</option>' + maqs.map(m=>`<option value="${m.id}">${m.nome}</option>`).join('');
    const { data: dests } = await supabase.from('destinos').select('*'); if(dests) els.relDestino.innerHTML = '<option value="">Todos</option>' + dests.map(d=>`<option value="${d.id}">${d.nome}</option>`).join('');
}
els.btnFiltrarRel.addEventListener('click', async () => {
    els.containerResultados.classList.remove('hidden'); els.tabelaRelatorio.innerHTML = '<tr><td colspan="5">Pesquisando...</td></tr>';
    let query = supabase.from('movimentacoes').select(`criado_em, tipo, quantidade, produtos(nome, unidade), destinos(nome), maquinas(nome)`).order('criado_em', { ascending: false });
    if (els.relDataInicio.value) query = query.gte('criado_em', els.relDataInicio.value + 'T00:00:00');
    if (els.relDataFim.value) query = query.lte('criado_em', els.relDataFim.value + 'T23:59:59');
    if (els.relMaquina.value) query = query.eq('maquina_id', els.relMaquina.value);
    if (els.relDestino.value) query = query.eq('destino_id', els.relDestino.value);
    const { data } = await query; dadosRelatorioAtual = data || [];
    if (!data || !data.length) { els.tabelaRelatorio.innerHTML = '<tr><td colspan="5">Nenhum registro.</td></tr>'; return; }
    els.tabelaRelatorio.innerHTML = data.map(i => `<tr><td>${new Date(i.criado_em).toLocaleDateString()}</td><td>${i.produtos?.nome}</td><td style="color:${i.tipo==='ENTRADA'?'green':'red'}">${i.tipo}</td><td>${i.quantidade}</td><td>${i.maquinas?.nome || i.destinos?.nome || '-'}</td></tr>`).join('');
});
els.btnGerarPdf.addEventListener('click', () => {
    if(!dadosRelatorioAtual.length) return alert("Nada para imprimir.");
    const { jsPDF } = window.jspdf; const doc = new jsPDF(); doc.text("Histórico", 14, 20);
    doc.autoTable({ head: [['Data', 'Produto', 'Tipo', 'Qtd', 'Local']], body: dadosRelatorioAtual.map(i=>[new Date(i.criado_em).toLocaleDateString(), i.produtos?.nome, i.tipo, i.quantidade, i.maquinas?.nome||i.destinos?.nome||'']), startY:30 });
    doc.save("historico.pdf");
});

els.movDestino.addEventListener('change', (e) => {
    const txt = e.target.options[e.target.selectedIndex]?.text.toLowerCase() || '';
    if(txt.includes('frota')||txt.includes('manutenção')||txt.includes('oficina')) els.boxMaquina.classList.remove('hidden');
    else { els.boxMaquina.classList.add('hidden'); els.selectMaquina.value = ""; }
});
function resetarMovimentacao() { els.containerBuscaManual.classList.remove('hidden'); els.formMov.classList.add('hidden'); els.areaScannerMov.classList.add('hidden'); els.inputBuscaMov.value=''; els.movQtd.value=''; els.selectMaquina.value=''; els.boxMaquina.classList.add('hidden'); pararScanner(); }
els.btnBuscarMov.addEventListener('click', () => { if(els.inputBuscaMov.value) buscarProdutoMov(els.inputBuscaMov.value); });
els.btnAtivarScanner.addEventListener('click', () => { els.areaScannerMov.classList.remove('hidden'); iniciarScanner("reader-mov", c => { pararScanner(); buscarProdutoMov(c); }); });
function pararScannerMovimentacao() { pararScanner(); els.areaScannerMov.classList.add('hidden'); }
async function buscarProdutoMov(termo) {
    termo = termo.trim();
    let { data } = await supabase.from('produtos').select('*').eq('codigo_barras', termo).maybeSingle();
    if (!data) { const {data:l} = await supabase.from('produtos').select('*').ilike('nome', `%${termo}%`).limit(1); if(l&&l.length) data=l[0]; }
    if (data) {
        produtoSelecionado = data; els.containerBuscaManual.classList.add('hidden'); els.areaScannerMov.classList.add('hidden'); els.formMov.classList.remove('hidden');
        els.movNome.innerText = data.nome; els.movCodigo.innerText = data.codigo_barras||'Manual'; els.movSaldo.innerText = `Saldo: ${data.quantidade_atual} ${data.unidade}`; atualizarEstiloBotaoMov();
    } else alert("Não encontrado.");
}
els.btnConfirmarMov.addEventListener('click', async () => {
    const tipo = document.querySelector('input[name="tipo_mov"]:checked').value; const qtd = parseFloat(els.movQtd.value);
    let maq = null; if(!els.boxMaquina.classList.contains('hidden')) { maq = els.selectMaquina.value; if(!maq && tipo === 'SAIDA') return alert("Selecione máquina."); if(!maq) maq=null; }
    if (!qtd || qtd <= 0) return alert("Qtd inválida.");
    let novoSaldo = parseFloat(produtoSelecionado.quantidade_atual);
    if (tipo === 'SAIDA') { if (qtd > novoSaldo) return alert("Saldo insuficiente."); novoSaldo -= qtd; } else novoSaldo += qtd;
    const {error:e1} = await supabase.from('movimentacoes').insert({ produto_id: produtoSelecionado.id, tipo, quantidade: qtd, destino_id: (tipo==='SAIDA'?els.movDestino.value:null), maquina_id: (tipo==='SAIDA'?maq:null) });
    const {error:e2} = await supabase.from('produtos').update({ quantidade_atual: novoSaldo }).eq('id', produtoSelecionado.id);
    if (!e1 && !e2) { alert("Sucesso!"); navegar('home'); } else alert("Erro.");
});
function atualizarEstiloBotaoMov() {
    const tipo = document.querySelector('input[name="tipo_mov"]:checked').value;
    if (tipo === 'ENTRADA') { els.boxDestino.style.display = 'none'; els.boxMaquina.style.display = 'none'; els.btnConfirmarMov.innerText="ENTRADA"; els.btnConfirmarMov.style.backgroundColor="var(--primary)"; }
    else { els.boxDestino.style.display = 'block'; els.btnConfirmarMov.innerText="SAÍDA"; els.btnConfirmarMov.style.backgroundColor="var(--saida)"; const txt = els.movDestino.options[els.movDestino.selectedIndex]?.text.toLowerCase() || ''; if(txt.includes('frota')||txt.includes('manutenção')) els.boxMaquina.classList.remove('hidden'); }
}
document.querySelectorAll('input[name="tipo_mov"]').forEach(r => r.addEventListener('change', atualizarEstiloBotaoMov));

els.btnSalvarNovo.addEventListener('click', async () => {
    const cod = els.cadCodigo.value.trim(), nome = els.cadNome.value.trim(), unid = els.cadUnidade.value;
    if (!nome) return alert("Nome obrigatório.");
    const dados = { codigo_barras: cod, nome, unidade: unid }; let err = null;
    if (produtoEmEdicaoId) { const {error} = await supabase.from('produtos').update(dados).eq('id', produtoEmEdicaoId); err=error; }
    else { dados.quantidade_atual = 0; const {error} = await supabase.from('produtos').insert(dados); err=error; }
    if (!err) { alert("Salvo!"); navegar(produtoEmEdicaoId ? 'gestao' : 'home'); } else alert("Erro.");
});
async function carregarListaGestao(f='') {
    els.listaGestao.innerHTML = 'Carregando...'; let q = supabase.from('produtos').select('*').order('nome'); if(f) q=q.ilike('nome',`%${f.trim()}%`);
    const { data } = await q; if (!data || !data.length) { els.listaGestao.innerHTML='Vazio.'; return; }
    els.listaGestao.innerHTML = data.map(p => `<li class="lista-custom"><div><strong>${p.nome}</strong><br><small>${p.codigo_barras||'-'}</small></div><div><button onclick="prepararEdicao(${p.id})" style="border:none;background:none;color:blue;margin-right:10px;">Edit</button><button onclick="excluirProduto(${p.id})" style="border:none;background:none;color:red;">Del</button></div></li>`).join('');
}
els.btnBuscaGestao.addEventListener('click', () => carregarListaGestao(els.inputBuscaGestao.value));
window.prepararEdicao = async (id) => { const {data} = await supabase.from('produtos').select('*').eq('id',id).single(); if(data) { els.telaGestao.classList.remove('ativa'); els.telaCad.classList.add('ativa'); els.titulo.innerText='Editar'; produtoEmEdicaoId=data.id; els.cadCodigo.value=data.codigo_barras||''; els.cadNome.value=data.nome; els.cadUnidade.value=data.unidade; } };
window.excluirProduto = async (id) => { if(confirm("Excluir?")) { const {error} = await supabase.from('produtos').delete().eq('id',id); if(error) alert("Erro (Item em uso)."); else carregarListaGestao(); } };
function resetarFormCadastro() { produtoEmEdicaoId=null; els.titulo.innerText='Novo'; els.cadCodigo.value=''; els.cadNome.value=''; els.cadUnidade.value='un'; }

els.btnAddMaq.addEventListener('click', async () => { const n = els.maqNome.value.trim(); if(!n) return; await supabase.from('maquinas').insert({nome:n}); els.maqNome.value=''; carregarListaMaquinasEdit(); carregarMaquinasSelect(); });
async function carregarListaMaquinasEdit() { const {data} = await supabase.from('maquinas').select('*').order('nome'); if(data) els.listaMaquinas.innerHTML = data.map(m=>`<li class="lista-custom"><span>${m.nome}</span><button onclick="excluirMaquina(${m.id})" style="color:red;border:none;background:none;">Del</button></li>`).join(''); }
window.excluirMaquina = async (id) => { if(confirm("Excluir?")) { const {error} = await supabase.from('maquinas').delete().eq('id',id); if(error) alert("Em uso."); else carregarListaMaquinasEdit(); } };
async function carregarMaquinasSelect() { const {data} = await supabase.from('maquinas').select('*').order('nome'); if(data) els.selectMaquina.innerHTML='<option value="">Selecione...</option>'+data.map(m=>`<option value="${m.id}">${m.nome}</option>`).join(''); }

function iniciarScanner(elemId, cb) { if(scannerAtivo) scannerAtivo.clear().catch(()=>{}); scannerAtivo = new Html5Qrcode(elemId); scannerAtivo.start({facingMode:"environment"}, {fps:10, qrbox:{width:300,height:150}, aspectRatio:1.0, experimentalFeatures:{useBarCodeDetectorIfSupported:true}}, cb).catch(err=>alert("Erro Câmera")); }
function pararScanner() { if(scannerAtivo) { scannerAtivo.stop().catch(()=>{}); scannerAtivo=null; } }
els.btnScanCad.addEventListener('click', () => { els.areaScannerCad.classList.remove('hidden'); iniciarScanner("reader-cad", c => { els.cadCodigo.value=c; pararScannerCadastro(); }); });
function pararScannerCadastro() { pararScanner(); els.areaScannerCad.classList.add('hidden'); }
async function carregarDestinos() { const {data} = await supabase.from('destinos').select('*'); if(data) els.movDestino.innerHTML = data.map(d=>`<option value="${d.id}">${d.nome}</option>`).join(''); }
async function atualizarResumo() { const {data} = await supabase.from('movimentacoes').select('tipo, quantidade, produtos(nome, unidade)').order('criado_em',{ascending:false}).limit(4); if(data) els.listaResumo.innerHTML = data.map(m=>`<li><span>${m.produtos.nome}</span><strong>${m.tipo==='ENTRADA'?'+':'-'}${m.quantidade}</strong></li>`).join(''); }