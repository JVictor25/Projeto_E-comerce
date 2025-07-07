// Carrinho de compras com localStorage

// Função para obter o carrinho do localStorage
function getCart() {
  return JSON.parse(localStorage.getItem('cart') || '[]');
}

// Função para salvar o carrinho no localStorage
function saveCart(cart) {
  localStorage.setItem('cart', JSON.stringify(cart));
}

// Função para adicionar um produto ao carrinho
function addToCart(product) {
  const cart = getCart();
  const existing = cart.find(item => item.id === product.id);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ ...product, quantity: 1 });
  }
  saveCart(cart);
}

// Função para remover um produto do carrinho
function removeFromCart(productId) {
  let cart = getCart();
  cart = cart.filter(item => String(item.id) !== String(productId));
  saveCart(cart);
  renderCartItems();
}

// Função para renderizar os itens do carrinho na página cart.html
function renderCartItems() {
  const cart = getCart();
  const container = document.getElementById('cart-items');
  if (!container) return;
  if (cart.length === 0) {
    container.innerHTML = '<p>Seu carrinho está vazio.</p>';
    return;
  }
  container.innerHTML = '';
  cart.forEach(item => {
    const div = document.createElement('div');
    div.className = 'cart-item';
    div.innerHTML = `
      <img src="${item.image || '/imgs/cart.png'}" alt="${item.name}" class="cart-item-image">
      <div class="cart-item-info">
        <h4 class="cart-item-title">${item.name}</h4>
        <div class="cart-item-quantity-controls">
          <button class="decrease-qty-btn" data-id="${item.id}">-</button>
          <span class="cart-item-quantity">${item.quantity}</span>
          <button class="increase-qty-btn" data-id="${item.id}">+</button>
        </div>
        <p class="cart-item-price">R$ ${item.price}</p>
        <button class="remove-cart-item-btn" data-id="${item.id}">Remover</button>
      </div>
    `;
    container.appendChild(div);
  });
  // Adiciona evento de remoção
  document.querySelectorAll('.remove-cart-item-btn').forEach(btn => {
    btn.onclick = function() {
      const id = this.getAttribute('data-id');
      removeFromCart(id);
    };
  });
  // Adiciona eventos para aumentar/diminuir quantidade
  document.querySelectorAll('.increase-qty-btn').forEach(btn => {
    btn.onclick = function() {
      const id = this.getAttribute('data-id');
      changeCartItemQuantity(id, 1);
    };
  });
  document.querySelectorAll('.decrease-qty-btn').forEach(btn => {
    btn.onclick = function() {
      const id = this.getAttribute('data-id');
      changeCartItemQuantity(id, -1);
    };
  });
}

// Função para alterar a quantidade de um item do carrinho
function changeCartItemQuantity(productId, delta) {
  const cart = getCart();
  const item = cart.find(i => String(i.id) === String(productId));
  if (!item) return;
  item.quantity += delta;
  if (item.quantity < 1) item.quantity = 1;
  saveCart(cart);
  renderCartItems();
}

// Função para mostrar ou esconder o botão de finalizar compra
function updateCheckoutButton() {
  const cart = getCart();
  const btn = document.getElementById('checkout-btn');
  if (!btn) return;
  if (cart.length > 0) {
    btn.style.display = 'block';
  } else {
    btn.style.display = 'none';
  }
}

// Renderiza os itens do carrinho ao carregar a página do carrinho
if (window.location.pathname.includes('cart.html')) {
  document.addEventListener('DOMContentLoaded', function() {
    renderCartItems();
    updateCheckoutButton();
  });
  // Atualiza botão ao remover item ou alterar quantidade
  document.addEventListener('click', function(e) {
    if (
      e.target.classList.contains('remove-cart-item-btn') ||
      e.target.classList.contains('increase-qty-btn') ||
      e.target.classList.contains('decrease-qty-btn')
    ) {
      setTimeout(updateCheckoutButton, 100);
    }
  });
} 