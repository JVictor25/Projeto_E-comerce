// auth.js
// public/js/auth.js
console.log('🔐 auth.js carregou');

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registerForm');
  if (!form) {
    console.error('❌ form #registerForm não encontrado');
    return;
  }
  form.addEventListener('submit', async e => {
    e.preventDefault();
    console.log('✍️  submit registro detectado');

    const name            = document.getElementById('register-name').value;
    const surname         = document.getElementById('register-surname').value;
    const email           = document.getElementById('register-email').value;
    const password        = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;
    const phone           = document.getElementById('register-phone').value;

    console.log({ name, surname, email, password, confirmPassword, phone });

    try {
      const res = await fetch('/cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, surname, email, password, confirmPassword, phone })
      });
      console.log('📨 /cadastro status:', res.status);
      const data = await res.json();
      console.log('📦 resposta cadastro:', data);
      showModal(data.message);
      if (res.ok) {
        setTimeout(() => window.location.href = 'login.html', 2000);
      }
    } catch (err) {
      console.error('🚨 erro no fetch /cadastro:', err);
      showModal('Erro na conexão. Tente novamente.');
    }
  });
});
