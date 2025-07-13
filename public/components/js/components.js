// Função para incluir componentes HTML
function includeComponent(selector, url) {
  fetch(url)
    .then(res => res.text())
    .then(html => {
      document.querySelector(selector).innerHTML = html;
    });
}

// Exemplo de uso:
// includeComponent('#header', '/components/header.html');
// includeComponent('#footer', '/components/footer.html');

// Modal
function showModal(content) {
  const modal = document.getElementById('modal');
  modal.querySelector('.modal-body').innerHTML = content;
  modal.style.display = 'flex';
}
function closeModal() {
  document.getElementById('modal').style.display = 'none';
}
document.addEventListener('DOMContentLoaded', function() {
  const closeBtn = document.querySelector('.close-modal');
  if (closeBtn) closeBtn.onclick = closeModal;
}); 