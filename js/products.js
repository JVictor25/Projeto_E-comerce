// products.js

document.addEventListener('DOMContentLoaded', function() {
  // Gera produtos apenas se não houver no localStorage
  function getOrCreateProdutos() {
    // Sempre sobrescreve os produtos no localStorage
    const produtos = [
      { id: 1, nome: 'Smartphone X', preco: 1999.99, imagem: '/imgs/cart.png' },
      { id: 2, nome: 'Notebook Pro', preco: 3999.99, imagem: '/imgs/cart.png' },
      { id: 3, nome: 'Fone Bluetooth', preco: 299.99, imagem: '/imgs/cart.png' },
      { id: 4, nome: 'Cafeteira', preco: 249.99, imagem: '/imgs/cart.png' },
      { id: 5, nome: 'Tênis Esportivo', preco: 349.99, imagem: '/imgs/cart.png' },
      { id: 6, nome: 'Smartwatch', preco: 899.99, imagem: '/imgs/cart.png' },
      { id: 7, nome: 'Livro de Ficção', preco: 59.90, imagem: '/imgs/cart.png' },
      { id: 8, nome: 'Cadeira Gamer', preco: 1299.00, imagem: '/imgs/cart.png' },
      { id: 9, nome: 'Mochila Executiva', preco: 199.00, imagem: '/imgs/cart.png' },
      { id: 10, nome: 'Câmera Digital', preco: 2499.00, imagem: '/imgs/cart.png' }
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