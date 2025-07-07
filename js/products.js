// products.js

document.addEventListener('DOMContentLoaded', function() {
  // Gera produtos apenas se não houver no localStorage
  function getOrCreateProdutos() {
    let produtos = localStorage.getItem('produtos');
    if (produtos) return JSON.parse(produtos);
    // Gera produtos com preços aleatórios e salva no localStorage
    produtos = [
      { id: '1', nome: 'Produto 1', preco: (Math.random()*100+10).toFixed(2), imagem: '/imgs/cart.png' },
      { id: '2', nome: 'Produto 2', preco: (Math.random()*100+10).toFixed(2), imagem: '/imgs/cart.png' },
      { id: '3', nome: 'Produto 3', preco: (Math.random()*100+10).toFixed(2), imagem: '/imgs/cart.png' },
      { id: '4', nome: 'Produto 4', preco: (Math.random()*100+10).toFixed(2), imagem: '/imgs/cart.png' },
      { id: '5', nome: 'Produto 5', preco: (Math.random()*100+10).toFixed(2), imagem: '/imgs/cart.png' }
    ];
    localStorage.setItem('produtos', JSON.stringify(produtos));
    return produtos;
  }

  function renderProductList() {
    const container = document.getElementById('product-list');
    container.innerHTML = '';
    const produtos = getOrCreateProdutos();
    produtos.forEach(produto => {
      const card = document.createElement('div');
      card.className = 'product-card';
      card.innerHTML = `
        <img src="${produto.imagem}" alt="${produto.nome}" class="product-image">
        <h3 class="product-title">${produto.nome}</h3>
        <p class="product-price">R$ ${produto.preco}</p>
        <button class="details-btn" data-id="${produto.id}">Ver Detalhes</button>
      `;
      container.appendChild(card);
    });
    // Adiciona evento para o botão de detalhes
    document.querySelectorAll('.details-btn').forEach(btn => {
      btn.onclick = function() {
        const id = this.getAttribute('data-id');
        window.location.href = `product.html?id=${id}`;
      };
    });
  }

  renderProductList();
}); 