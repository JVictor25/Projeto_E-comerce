// public/js/cart.js
let cartItems = [];
let appliedCupons = [];
let cuponsDetalhe = null; // resposta detalhada do backend

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('authToken');
  const container = document.getElementById('cart-items');
  if (!container) return;

  if (!token) {
    container.innerHTML = '<p>Faça login para ver seu carrinho.</p>';
    return;
  }

  await loadCartItems();
  renderCuponsAplicados();
});

async function loadCartItems() {
  const token = localStorage.getItem('authToken');
  const container = document.getElementById('cart-items');
  const checkoutBtn = document.getElementById('checkout-btn');

  try {
    const res = await fetch('/cart', {
      headers: { 'Authorization':'Bearer '+token }
    });
    
    if (!res.ok) {
      if (res.status === 401) {
        container.innerHTML = '<p>Sessão expirada. <a href="/login.html">Faça login novamente</a>.</p>';
        return;
      }
      throw new Error('Status '+res.status);
    }
    
    cartItems = await res.json();
    if (!cartItems.length) {
      container.innerHTML = '<p>Seu carrinho está vazio.</p>';
      checkoutBtn.style.display = 'none';
      return;
    }
    
    renderCartDetalhado();
    checkoutBtn.style.display = 'block';
    await aplicarCupons();
  } catch (err) {
    console.error('❌ Erro ao carregar carrinho:', err);
    container.innerHTML = '<p>Erro ao carregar carrinho. Tente novamente.</p>';
  }
}

function renderCartDetalhado() {
  const container = document.querySelector('.cart-lista-produtos #cart-items');
  if (!cuponsDetalhe || !cuponsDetalhe.produtos) {
    // fallback: renderiza lista simples
    container.innerHTML = cartItems.map(item => `
      <div class="ml-cart-item">
        <img src="${item.imagem || '/imgs/cart.png'}" alt="${item.nome}" class="ml-cart-item-img">
        <div class="ml-cart-item-info">
          <div class="ml-cart-item-title">${item.nome}</div>
          <div class="ml-cart-item-details">
            <span class="ml-cart-item-price">R$ ${parseFloat(item.preco).toFixed(2)}</span>
            <span class="ml-cart-item-qty">Qtd: ${item.quantidade}</span>
            <span class="ml-cart-item-subtotal">Subtotal: R$ ${(item.preco * item.quantidade).toFixed(2)}</span>
          </div>
        </div>
        <div class="ml-cart-item-actions">
          <button class="ml-cart-item-remove" data-id="${item.id}">Excluir</button>
        </div>
      </div>
    `).join('');
    addRemoveListeners();
    renderResumoDetalhado(true);
    return;
  }
  // Renderiza lista detalhada com cupons
  let html = cuponsDetalhe.produtos.map(prod => `
    <div class="ml-cart-item">
      <img src="${prod.imagem || '/imgs/cart.png'}" alt="${prod.nome}" class="ml-cart-item-img">
      <div class="ml-cart-item-info">
        <div class="ml-cart-item-title">${prod.nome}</div>
        <div class="ml-cart-item-details">
          <span class="ml-cart-item-price">R$ ${Number(prod.preco_unitario).toFixed(2)}</span>
          <span class="ml-cart-item-qty">Qtd: ${prod.quantidade}</span>
          <span class="ml-cart-item-subtotal">Subtotal: R$ ${(prod.subtotal).toFixed(2)}</span>
        </div>
        <div class="ml-cart-item-details">
          <span>Desconto: <span style='color:#1a8917;'>${prod.desconto > 0 ? '-R$ ' + prod.desconto.toFixed(2) : '-'}</span></span>
          <span>Cupom: ${prod.cupom_aplicado ? prod.cupom_aplicado.codigo : '-'}</span>
        </div>
      </div>
      <div class="ml-cart-item-actions">
        <button class="ml-cart-item-remove" data-id="${prod.produto_id}">Excluir</button>
      </div>
    </div>
  `).join('');
  container.innerHTML = html;
  addRemoveListeners();
  renderResumoDetalhado(false);
}

function addRemoveListeners() {
  document.querySelectorAll('.remove-cart-item-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const itemId = btn.getAttribute('data-id');
      await removeCartItem(itemId);
    });
  });
}

function renderResumoDetalhado(alwaysShow=false) {
  let totalElement = document.getElementById('cart-total');
  if (!totalElement) {
    totalElement = document.createElement('div');
    totalElement.id = 'cart-total';
    totalElement.className = 'cart-total';
    document.querySelector('.cart-resumo .cart-actions').insertBefore(totalElement, document.getElementById('checkout-btn'));
  }
  if (!cuponsDetalhe && !alwaysShow) {
    totalElement.innerHTML = '';
    return;
  }
  // Se não tem cuponsDetalhe, calcula subtotal manualmente
  let totalOriginal = cuponsDetalhe ? cuponsDetalhe.total_original : cartItems.reduce((sum, item) => sum + (item.preco * item.quantidade), 0);
  let totalDesconto = cuponsDetalhe ? cuponsDetalhe.total_desconto : 0;
  let totalFinal = cuponsDetalhe ? cuponsDetalhe.total_final : totalOriginal;
  totalElement.innerHTML = `
    <div class="total-line"><span>Total dos produtos:</span><span>R$ ${totalOriginal.toFixed(2)}</span></div>
    <div class="total-line discount"><span>- Descontos:</span><span>-R$ ${totalDesconto.toFixed(2)}</span></div>
    <hr class="cart-total-hr">
    <div class="total-line final"><span>= Total:</span><span>R$ ${totalFinal.toFixed(2)}</span></div>
  `;
}

function renderCuponsAplicados() {
  const couponDiv = document.querySelector('.cart-coupon');
  let html = `<div class="cart-coupon-row">
    <input type="text" id="cart-coupon-input" placeholder="Cupom de desconto">
    <button id="add-coupon-btn">Adicionar</button>
  </div>`;
  html += '<div class="applied-coupons-list">';
  if (appliedCupons.length > 0) {
    appliedCupons.forEach((cupom, idx) => {
      html += `<span class="applied-coupon">${cupom} <button class="remove-applied-coupon" data-idx="${idx}">&times;</button></span>`;
    });
  }
  html += '</div>';
  couponDiv.innerHTML = html;
  document.getElementById('add-coupon-btn').onclick = addCoupon;
  document.querySelectorAll('.remove-applied-coupon').forEach(btn => {
    btn.onclick = function() {
      const idx = parseInt(this.getAttribute('data-idx'));
      appliedCupons.splice(idx, 1);
      renderCuponsAplicados();
      aplicarCupons();
    };
  });
}

function addCoupon() {
  const input = document.getElementById('cart-coupon-input');
  const code = input.value.trim().toUpperCase();
  if (!code) return;
  if (!appliedCupons.includes(code)) {
    appliedCupons.push(code);
    renderCuponsAplicados();
    aplicarCupons();
  }
  input.value = '';
}

async function aplicarCupons() {
  if (cartItems.length === 0) return;
  if (appliedCupons.length === 0) {
    cuponsDetalhe = null;
    renderCartDetalhado();
    return;
  }
  const token = localStorage.getItem('authToken');
  try {
    const response = await fetch('/aplicar-cupom', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ codigos_cupons: appliedCupons })
    });
    const result = await response.json();
    if (result.success) {
      cuponsDetalhe = result;
      renderCartDetalhado();
    } else {
      showModal(result.message || 'Cupom inválido ou não aplicável.');
      cuponsDetalhe = null;
      renderCartDetalhado();
    }
  } catch (error) {
    showModal('Erro ao aplicar cupons.');
    cuponsDetalhe = null;
    renderCartDetalhado();
  }
}
