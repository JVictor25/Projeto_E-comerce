// auth-manager.js
// Gerencia o estado de autenticação em todas as páginas

class AuthManager {
  constructor() {
    this.token = localStorage.getItem('authToken');
    this.user = null;
    this.init();
  }

  async init() {
    // Aguarda um pouco para os componentes serem carregados
    setTimeout(async () => {
      if (this.token) {
        await this.verifyToken();
      }
      this.updateUI();
    }, 200);
  }

  async verifyToken() {
    try {
      const response = await fetch('/userinfo', {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      if (response.ok) {
        this.user = await response.json();
        return true;
      } else {
        // Token inválido ou expirado
        this.logout();
        return false;
      }
    } catch (error) {
      console.error('Erro ao verificar token:', error);
      this.logout();
      return false;
    }
  }

  updateUI() {
    // Verifica se já existe um sistema de header dinâmico
    const adminNav = document.getElementById('admin-nav');
    if (adminNav) {
      // Se existe o novo sistema de header, não interfere
      return;
    }

    const userActions = document.querySelector('.user-actions');
    if (!userActions) {
      // Se o header ainda não foi carregado, tenta novamente em breve
      setTimeout(() => this.updateUI(), 100);
      return;
    }

    if (this.user) {
      // Usuário logado
      userActions.innerHTML = `
        <span class="user-name">Olá, ${this.user.nome}</span>
        <a href="/orders.html">Meus Pedidos</a>
        <a href="/cart.html" class="cart-button">
          <img class="cart-button-img" src="/imgs/cartWhite.png" alt="Carrinho de Compras">
        </a>
        <button onclick="authManager.logout()" class="btn btn-outline">Sair</button>
      `;
    } else {
      // Usuário não logado
      userActions.innerHTML = `
        <a href="/login.html" class="btn btn-outline">Login</a>
        <a href="/register.html" class="btn btn-primary">Registrar-se</a>
        <a href="/cart.html" class="cart-button">
          <img class="cart-button-img" src="/imgs/cartWhite.png" alt="Carrinho de Compras">
        </a>
      `;
    }
  }

  logout() {
    localStorage.removeItem('authToken');
    this.token = null;
    this.user = null;
    this.updateUI();
    
    // Redireciona para a página inicial se não estiver nela
    if (window.location.pathname !== '/index.html' && window.location.pathname !== '/') {
      window.location.href = '/index.html';
    }
  }

  isAuthenticated() {
    return !!this.user;
  }

  getUser() {
    return this.user;
  }

  getToken() {
    return this.token;
  }
}

// Inicializa o gerenciador de autenticação
let authManager;

document.addEventListener('DOMContentLoaded', () => {
  authManager = new AuthManager();
});

// Função global para logout (para compatibilidade)
function logout() {
  if (authManager) {
    authManager.logout();
  }
} 