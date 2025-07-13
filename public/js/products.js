// public/js/products.js
console.log('🔍 products.js carregou');

document.addEventListener('DOMContentLoaded', async () => {
  console.log('⏳ products.js: DOMContentLoaded');
  try {
    console.log('📡 products.js: solicitando /api/produtos');
    const res = await fetch('/api/produtos');
    console.log(`🌐 /api/produtos retornou status ${res.status}`);
    const produtos = await res.json();
    console.log('📦 produtos recebidos:', produtos);

    const container = document.getElementById('product-list');
    container.innerHTML = '';

    if (!produtos.length) {
      container.innerHTML = '<p>Nenhum produto disponível.</p>';
      return;
    }

    produtos.forEach(p => {
      // converte preco de string para float
      const precoNum = parseFloat(p.preco);
      const precoFormatado = isNaN(precoNum)
        ? '—'
        : precoNum.toFixed(2);

      const card = document.createElement('div');
      card.className = 'product-card';
      card.innerHTML = `
        <img src="/imgs/cart.png" alt="${p.nome}" class="product-image">
        <h3 class="product-title">${p.nome}</h3>
        <p class="product-price">R$ ${precoFormatado}</p>
        <button class="details-btn" data-id="${p.id}">Ver Detalhes</button>
      `;
      container.appendChild(card);
      card.querySelector('.details-btn').onclick = () => {
        window.location.href = `product.html?id=${p.id}`;
      };
    });
  } catch (err) {
    console.error('❌ Erro ao carregar produtos:', err);
  }
});
