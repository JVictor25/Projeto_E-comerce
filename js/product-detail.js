// product-detail.js

document.addEventListener('DOMContentLoaded', function() {
  // Busca a lista de produtos do localStorage, se existir
  function getProdutos() {
    const local = localStorage.getItem('produtos');
    if (local) return JSON.parse(local);
    // fallback se não houver localStorage
    return [
      { id: '1', nome: 'Produto 1', preco: '99.99', imagem: '/imgs/cart.png', categoria: 'Categoria A', descricao: 'Descrição do Produto 1.' },
      { id: '2', nome: 'Produto 2', preco: '79.99', imagem: '/imgs/cart.png', categoria: 'Categoria B', descricao: 'Descrição do Produto 2.' },
      { id: '3', nome: 'Produto 3', preco: '59.99', imagem: '/imgs/cart.png', categoria: 'Categoria C', descricao: 'Descrição do Produto 3.' },
      { id: '4', nome: 'Produto 4', preco: '39.99', imagem: '/imgs/cart.png', categoria: 'Categoria D', descricao: 'Descrição do Produto 4.' },
      { id: '5', nome: 'Produto 5', preco: '19.99', imagem: '/imgs/cart.png', categoria: 'Categoria E', descricao: 'Descrição do Produto 5.' }
    ];
  }

  // Função para obter o ID do produto da URL
  function getProductIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
  }

  // Preenche os dados do produto na página
  function renderProductDetail() {
    const id = getProductIdFromUrl();
    const produtos = getProdutos();
    const produto = produtos.find(p => String(p.id) === String(id)) || produtos[0];
    document.getElementById('product-name').textContent = produto.nome;
    document.getElementById('product-description').textContent = produto.descricao;
    document.getElementById('product-price').textContent = produto.preco;
    document.getElementById('product-categories').textContent = produto.categoria;
    document.getElementById('product-image').src = produto.imagem;
    return produto;
  }
  const produtoAtual = renderProductDetail();

  // Atualiza o objeto do produto para o carrinho
  let productData = {};
  function updateProductDataForCart() {
    const id = getProductIdFromUrl();
    const produtos = getProdutos();
    const produto = produtos.find(p => String(p.id) === String(id)) || produtos[0];
    productData = {
      id: produto.id,
      name: produto.nome,
      price: produto.preco,
      category: produto.categoria,
      image: produto.imagem
    };
  }
  updateProductDataForCart();

  document.getElementById('add-to-cart-btn').addEventListener('click', function() {
    addToCart(productData);
    showModal('Produto adicionado ao carrinho!');
  });
}); 