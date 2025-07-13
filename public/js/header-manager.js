// header-manager.js
// Gerencia o header dinâmico baseado no status de autenticação

class HeaderManager {
  constructor() {
    this.init();
  }

  async init() {
    // Aguarda um pouco para os componentes serem carregados
    setTimeout(async () => {
      await this.checkAdminStatus();
    }, 200);
  }

  // Função para verificar se o usuário é administrador
  async checkAdminStatus() {
    const adminToken = localStorage.getItem('adminToken');
    const userToken = localStorage.getItem('token');
    
    if (adminToken) {
      try {
        const response = await fetch('/userinfo', {
          headers: {
            'Authorization': `Bearer ${adminToken}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.role === 'administrador') {
            this.showAdminInterface(data.nome);
            return;
          }
        }
      } catch (error) {
        console.error('Erro ao verificar status de admin:', error);
      }
    }
    
    if (userToken) {
      try {
        const response = await fetch('/userinfo', {
          headers: {
            'Authorization': `Bearer ${userToken}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          this.showUserInterface(data.nome);
          return;
        }
      } catch (error) {
        console.error('Erro ao verificar status de usuário:', error);
      }
    }
    
    // Se não há token válido, mostra interface de convidado
    this.showGuestInterface();
  }

  // Mostrar interface de administrador
  showAdminInterface(adminName) {
    const adminNav = document.getElementById('admin-nav');
    const adminActions = document.getElementById('admin-actions');
    const guestActions = document.getElementById('guest-actions');
    const userActions = document.getElementById('user-actions');
    const adminLink = document.getElementById('admin-link');
    
    if (adminNav) adminNav.style.display = 'flex';
    if (adminActions) adminActions.style.display = 'flex';
    if (guestActions) guestActions.style.display = 'none';
    if (userActions) userActions.style.display = 'none';
    if (adminLink) adminLink.style.display = 'none';
    
    const adminNameElement = document.getElementById('admin-name');
    if (adminNameElement) adminNameElement.textContent = `Admin: ${adminName}`;
  }

  // Mostrar interface de usuário
  showUserInterface(userName) {
    const userActions = document.getElementById('user-actions');
    const guestActions = document.getElementById('guest-actions');
    const adminActions = document.getElementById('admin-actions');
    const adminNav = document.getElementById('admin-nav');
    const adminLink = document.getElementById('admin-link');
    
    if (userActions) userActions.style.display = 'flex';
    if (guestActions) guestActions.style.display = 'none';
    if (adminActions) adminActions.style.display = 'none';
    if (adminNav) adminNav.style.display = 'none';
    if (adminLink) adminLink.style.display = 'inline-block';
    
    const userNameElement = document.getElementById('user-name');
    if (userNameElement) userNameElement.textContent = `Olá, ${userName}`;
  }

  // Mostrar interface de convidado
  showGuestInterface() {
    const guestActions = document.getElementById('guest-actions');
    const userActions = document.getElementById('user-actions');
    const adminActions = document.getElementById('admin-actions');
    const adminNav = document.getElementById('admin-nav');
    const adminLink = document.getElementById('admin-link');
    
    if (guestActions) guestActions.style.display = 'flex';
    if (userActions) userActions.style.display = 'none';
    if (adminActions) adminActions.style.display = 'none';
    if (adminNav) adminNav.style.display = 'none';
    if (adminLink) adminLink.style.display = 'inline-block';
  }

  // Logout de usuário
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userName');
    window.location.reload();
  }

  // Logout de administrador
  adminLogout() {
    localStorage.removeItem('adminToken');
    window.location.href = '/index.html';
  }
}

// Inicializa o gerenciador de header
let headerManager;

document.addEventListener('DOMContentLoaded', () => {
  headerManager = new HeaderManager();
});

// Funções globais para compatibilidade
function logout() {
  if (headerManager) {
    headerManager.logout();
  }
}

function adminLogout() {
  if (headerManager) {
    headerManager.adminLogout();
  }
} 