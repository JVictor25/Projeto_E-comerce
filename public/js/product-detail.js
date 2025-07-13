// public/js/product-detail.js
document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  try {
    // busca detalhes do produto
    const res = await fetch('/api/produtos');
    const produtos = await res.json();
    const p = produtos.find(x => String(x.id) === id);
    if (!p) throw 'Produto não encontrado';

    document.getElementById('product-name').textContent = p.nome;
    document.getElementById('product-description').textContent = p.descricao;
    document.getElementById('product-price').textContent = Number(p.preco).toFixed(2);
    document.getElementById('product-image').src = '/imgs/cart.png';

    document.getElementById('add-to-cart-btn').onclick = async () => {
      const token = localStorage.getItem('authToken');
      if (!token) return showModal('Faça login antes de adicionar ao carrinho');
      const resp = await fetch('/cart', {
        method: 'POST',
        headers: {
          'Content-Type':'application/json',
          'Authorization':'Bearer '+token
        },
        body: JSON.stringify({ produto_id: p.id, quantidade: 1 })
      });
      const data = await resp.json();
      showModal(data.message);
    };
  } catch (err) {
    console.error(err);
    showModal('Erro ao carregar o produto');
  }
});
// public/js/product-detail.js
console.log('🔍 product-detail.js carregou');

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) {
    showModal('ID de produto ausente na URL');
    return;
  }

  try {
    console.log(`📡 Buscando /api/produtos/${id}`);
    const res = await fetch(`/api/produtos/${id}`);
    if (res.status === 404) {
      showModal('Produto não encontrado');
      return;
    }
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const p = await res.json();
    console.log('📦 Dados do produto:', p);

    // Preencher campos
    document.getElementById('product-name').textContent = p.nome;
    document.getElementById('product-description').textContent = p.descricao;

    // Preço (string → float → toFixed)
    const precoNum = parseFloat(p.preco);
    document.getElementById('product-price').textContent =
      isNaN(precoNum) ? '—' : precoNum.toFixed(2);

    // Categorias
    document.getElementById('product-categories').textContent =
      p.categorias || '—';

    // Imagem (se tiver URL no banco, use-a; se não, cai no ícone genérico)
    document.getElementById('product-image').src =
      p.imagem_url || '/imgs/cart.png';

    // Botão carrinho
    document.getElementById('add-to-cart-btn').onclick = async () => {
      const token = localStorage.getItem('authToken');
      if (!token) {
        showModal('Faça login para adicionar ao carrinho');
        return;
      }
      try {
        const resp = await fetch('/cart', {
          method: 'POST',
          headers: {
            'Content-Type':'application/json',
            'Authorization':'Bearer '+token
          },
          body: JSON.stringify({ produto_id: p.id, quantidade: 1 })
        });
        const data = await resp.json();
        showModal(data.message);
      } catch (err) {
        console.error('❌ Erro ao adicionar ao carrinho:', err);
        showModal('Erro ao adicionar ao carrinho');
      }
    };
  } catch (err) {
    console.error('❌ Erro no product-detail:', err);
    showModal('Erro ao carregar detalhes do produto');
  }
});
