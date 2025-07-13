// public/js/login.js
console.log('login.js carregou ✅');

// Função para alternar visibilidade da senha
function togglePassword() {
  const passwordInput = document.getElementById('login-password');
  const toggleBtn = document.querySelector('.toggle-password');
  
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    toggleBtn.textContent = '👁‍🗨️';
    toggleBtn.title = 'Ocultar senha';
  } else {
    passwordInput.type = 'password';
    toggleBtn.textContent = '👁';
    toggleBtn.title = 'Mostrar senha';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  if (!form) {
    console.error('🛑 Form #login-form não encontrado');
    return;
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    console.log('submit detectado');

    const email    = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    console.log({ email, password });

    try {
      const res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      console.log('Fetch /login status:', res.status);

      const data = await res.json();
      console.log('Resposta /login:', data);
      showModal(data.message);

      if (res.ok) {
        localStorage.setItem('authToken', data.token);
        // Atualiza a UI imediatamente
        if (authManager) {
          authManager.token = data.token;
          authManager.verifyToken().then(() => {
            authManager.updateUI();
            setTimeout(() => window.location.href = 'index.html', 1500);
          });
        } else {
          setTimeout(() => window.location.href = 'index.html', 1500);
        }
      }
    } catch (err) {
      console.error('Erro ao chamar /login:', err);
      showModal('Erro na conexão. Tente novamente.');
    }
  });
});
