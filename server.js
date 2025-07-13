// server.js mysqld --sefaults-file="c:\ProgramData\MySQL\MySQL Server 8.0\my.ini" --init-files=c:\senha\reset.txt
const http    = require('http');
const url     = require('url');
const fs      = require('fs');
const path    = require('path');
const mysql   = require('mysql2/promise');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
require('dotenv').config();

// --- Configuração do banco ---
const dbConfig = {
  host:     'localhost',
  user:     'weuler',
  password: 'Deusefiel@2002', // <-- DEIXE EM BRANCO
  database: 'mydb',
  port:     3306
};

let connection;
(async () => {
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✔️  Banco conectado');
    
    // Criar tabela historico_precos se não existir
    try {
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS historico_precos (
          id INT AUTO_INCREMENT PRIMARY KEY,
          produto_id INT NOT NULL,
          preco DECIMAL(10,2) NOT NULL,
          data_inicio DATE NOT NULL,
          data_fim DATE NULL,
          FOREIGN KEY (produto_id) REFERENCES produto(produto_id)
        )
      `);
      console.log('✅ Tabela historico_precos verificada/criada');
    } catch (err) {
      console.error('❌ Erro ao criar tabela historico_precos:', err);
    }

    // Função para verificar e corrigir preços atuais dos produtos
    async function verificarPrecosAtuais() {
      try {
        console.log('🔍 Verificando preços atuais dos produtos...');

        // Buscar todos os produtos ativos
        const [produtos] = await connection.execute(
          'SELECT produto_id, nome, preco_atual FROM produto WHERE status = "ativo"'
        );

        let produtosAtualizados = 0;

        for (const produto of produtos) {
          // Buscar o preço em vigor para este produto (promoção ou preço base)
          const [precosVigentes] = await connection.execute(
            `SELECT 
              preco_com_desconto,
              preco_total,
              quantidade_de_desconto,
              tipo_de_desconto,
              data_inicio_vigencia,
              data_fim
             FROM preco 
             WHERE produto_id = ? 
             AND data_inicio_vigencia <= CURDATE()
             AND (data_fim IS NULL OR data_fim >= CURDATE())
             ORDER BY data_inicio_vigencia DESC, id_preco DESC
             LIMIT 1`,
            [produto.produto_id]
          );

          let precoCorreto = null;

          if (precosVigentes.length > 0) {
            // Se há promoção em vigor, use o preço com desconto se existir, senão o preço base
            precoCorreto = precosVigentes[0].preco_com_desconto !== null
              ? parseFloat(precosVigentes[0].preco_com_desconto)
              : parseFloat(precosVigentes[0].preco_total);
          } else {
            // Se não há preço em vigor, pega o preço base mais recente
            const [precosBase] = await connection.execute(
              `SELECT preco_total
               FROM preco 
               WHERE produto_id = ? 
               ORDER BY data_inicio_vigencia DESC, id_preco DESC
               LIMIT 1`,
              [produto.produto_id]
            );
            if (precosBase.length > 0) {
              precoCorreto = parseFloat(precosBase[0].preco_total);
            }
          }

          if (precoCorreto !== null && Math.abs(precoCorreto - parseFloat(produto.preco_atual)) > 0.01) {
            await connection.execute(
              'UPDATE produto SET preco_atual = ? WHERE produto_id = ?',
              [precoCorreto, produto.produto_id]
            );
            console.log(`💰 Produto "${produto.nome}" (ID: ${produto.produto_id}): ${produto.preco_atual} → ${precoCorreto}`);
            produtosAtualizados++;
          }
        }

        if (produtosAtualizados > 0) {
          console.log(`✅ ${produtosAtualizados} produtos tiveram seus preços corrigidos`);
        } else {
          console.log('✅ Todos os preços estão corretos');
        }

      } catch (err) {
        console.error('❌ Erro ao verificar preços atuais:', err);
      }
    }

    // Executar verificação de preços ao iniciar o sistema
    await verificarPrecosAtuais();
  } catch (err) {
    console.error('❌ Erro ao conectar ao DB:', err);
    process.exit(1);
  }
})();

// --- Chave secreta para JWT ---
const secretKey = process.env.JWT_SECRET || 'yourSecretKey';

// --- Helper para content-type ---
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html';
    case '.css':  return 'text/css';
    case '.js':   return 'application/javascript';
    case '.json': return 'application/json';
    case '.png':  return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    default:      return 'application/octet-stream';
  }
}

// --- Cria servidor HTTP ---
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname  = decodeURIComponent(parsedUrl.pathname);

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // --- ROTA: POST /login ---
  if (pathname === '/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    return req.on('end', async () => {
      try {
        const { email, password } = JSON.parse(body);
        const [rows] = await connection.execute(
          'SELECT id_cliente AS id, pnome AS nome, senha FROM cliente WHERE email = ?',
          [email]
        );
        if (!rows.length || !bcrypt.compareSync(password, rows[0].senha)) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ message: 'Credenciais inválidas' }));
        }
        const token = jwt.sign(
          { id: rows[0].id, nome: rows[0].nome, role: 'cliente' },
          secretKey,
          { expiresIn: '2h' }
        );
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ message: 'Login bem-sucedido', token }));
      } catch (err) {
        console.error('Erro no /login:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ message: 'Erro interno' }));
      }
    });
  }

  // --- ROTA: POST /admin/login ---
  if (pathname === '/admin/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    return req.on('end', async () => {
      try {
        const { email, password } = JSON.parse(body);
        const [rows] = await connection.execute(
          'SELECT id, pnome, senha FROM administrador WHERE email = ?',
          [email]
        );

        if (!rows.length || !bcrypt.compareSync(password, rows[0].senha)) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ message: 'Credenciais de admin inválidas' }));
        }

        // IMPORTANTE: Adicionar o 'role' de administrador ao token!
        const token = jwt.sign(
          { id: rows[0].id, nome: rows[0].pnome, role: 'administrador' },
          secretKey,
          { expiresIn: '8h' } // Admins geralmente têm sessões mais longas
        );

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ message: 'Login de admin bem-sucedido', token }));
      } catch (err) {
        console.error('Erro no /admin/login:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ message: 'Erro interno' }));
      }
    });
  }

  // --- ROTA: POST /cadastro ---
  // --- ROTA: POST /cadastro ---
if (pathname === '/cadastro' && req.method === 'POST') {
  let body = '';
  req.on('data', chunk => body += chunk);
  return req.on('end', async () => {
    try {
      const { name, surname, email, password, confirmPassword, phone } = JSON.parse(body);

      // Validação de senha
      if (password !== confirmPassword) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ message: 'As senhas não coincidem.' }));
      }

      // Hash da senha
      const hash = bcrypt.hashSync(password, 10);

      // Tenta inserir
      const [result] = await connection.execute(
        'INSERT INTO cliente (pnome, sobrenome, telefone, email, senha) VALUES (?,?,?,?,?)',
        [name, surname, phone, email, hash]
      );
      console.log('✅ Cliente inserido com ID:', result.insertId);

      // Sucesso
      res.writeHead(201, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ message: 'Cadastro realizado com sucesso' }));

    } catch (err) {
      // Erro de e-mail duplicado
      if (err.code === 'ER_DUP_ENTRY') {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ message: 'Este e-mail já está em uso.' }));
      }
      // Outros erros
      console.error('❌ Erro no /cadastro:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ message: 'Erro interno no cadastro' }));
    }
  });
}


  // --- ROTA: GET /api/produtos ---
  if (pathname === '/api/produtos' && req.method === 'GET') {
    try {
      const sql = `
        SELECT
          p.produto_id AS id,
          p.nome AS nome,
          p.descricao_produto AS descricao,
          p.quantidade_estoque AS estoque,
          CAST(p.preco_atual AS DECIMAL(10,2)) AS preco
        FROM produto p
        WHERE p.status = 'ativo'
      `;
      const [rows] = await connection.execute(sql);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(rows));
    } catch (err) {
      console.error('Erro no /api/produtos:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ message: 'Erro ao listar produtos' }));
    }
  }
  // --- ROTA: GET /api/produtos/:id (detalhe) ---
  

    // --- ROTA: GET /api/produtos/:id (detalhe + categorias) ---
  if (pathname.match(/^\/api\/produtos\/\d+$/) && req.method === 'GET') {
    const id = pathname.split('/').pop();
    try {
      const sql = `
        SELECT
          p.produto_id AS id,
          p.nome AS nome,
          p.descricao_produto AS descricao,
          p.quantidade_estoque AS estoque,
          CAST(p.preco_atual AS DECIMAL(10,2)) AS preco,
          GROUP_CONCAT(c.nome SEPARATOR ', ') AS categorias
        FROM produto p
        LEFT JOIN produto_tem_categoria pc
          ON pc.produto_id = p.produto_id
        LEFT JOIN categoria c
          ON c.id = pc.categoria_id
        WHERE p.produto_id = ?
          AND p.status = 'ativo'
        GROUP BY p.produto_id, p.preco_atual
        LIMIT 1
      `;
      const [rows] = await connection.execute(sql, [id]);
      if (!rows.length) {
        res.writeHead(404, { 'Content-Type':'application/json' });
        return res.end(JSON.stringify({ message: 'Produto não encontrado' }));
      }
      res.writeHead(200, { 'Content-Type':'application/json' });
      return res.end(JSON.stringify(rows[0]));
    } catch (err) {
      console.error('❌ Erro em /api/produtos/:id', err);
      res.writeHead(500, { 'Content-Type':'application/json' });
      return res.end(JSON.stringify({ message:'Erro interno' }));
    }
  }


  // --- ROTA: GET /userinfo ---
  if (pathname === '/userinfo' && req.method === 'GET') {
    const auth = req.headers['authorization'] || '';
    const token = auth.split(' ')[1];
    if (!token) {
      res.writeHead(401, {'Content-Type':'application/json'});
      return res.end(JSON.stringify({ message: 'Não autorizado' }));
    }
    try {
      const decoded = jwt.verify(token, secretKey);
      // envia só o nome e o id
      res.writeHead(200, {'Content-Type':'application/json'});
      return res.end(JSON.stringify({ id: decoded.id, nome: decoded.nome }));
    } catch (err) {
      res.writeHead(401, {'Content-Type':'application/json'});
      return res.end(JSON.stringify({ message: 'Token inválido' }));
    }
  }

  // depois das rotas /login, /cadastro e /api/produtos
//  ----------------------------------------------

// Helper: extrai e valida JWT, retorna decoded ou lança erro
async function getUserFromToken(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.split(' ')[1];
  if (!token) throw { status: 401, message: 'Não autorizado' };
  try {
    return jwt.verify(token, secretKey);
  } catch {
    throw { status: 401, message: 'Token inválido' };
  }
}

// --- ROTA: GET /api/cupons
if (pathname === '/api/cupons' && req.method === 'GET') {
  try {
    const [rows] = await connection.execute(
      `SELECT 
        id_cupom AS id, 
        cupom AS codigo, 
        cupom_titulo AS titulo,
        tipo_de_desconto AS tipo, 
        quantidade_de_desconto AS valor, 
        data_inicio_vigencia, 
        data_fim,
        aplicavel_a,
        compra_minima,
        limite
       FROM cupom 
       WHERE data_inicio_vigencia <= CURDATE() AND data_fim >= CURDATE()`
    );
    res.writeHead(200, {'Content-Type':'application/json'});
    return res.end(JSON.stringify(rows));
  } catch (e) {
    console.error('Erro ao listar cupons:', e);
    res.writeHead(500, {'Content-Type':'application/json'});
    return res.end(JSON.stringify({ message: 'Erro ao listar cupons' }));
  }
}

// --- ROTA: GET /cart (lista itens do carrinho do usuário)
if (pathname === '/cart' && req.method === 'GET') {
  console.log('🎯 ROTA /cart detectada');
  try {
    console.log('🔍 Iniciando requisição /cart');
    const user = await getUserFromToken(req);
    console.log('👤 Usuário autenticado:', user.id, user.nome);
    
    // busca carrinho do cliente
    const [carrinhoRows] = await connection.execute(
      'SELECT carrinho_id FROM carrinho WHERE cliente_id = ?', [user.id]
    );
    console.log('🛒 Carrinhos encontrados:', carrinhoRows.length);
    
    // Se não tem carrinho, retorna array vazio
    if (!carrinhoRows.length) {
      console.log('📭 Usuário não tem carrinho, retornando array vazio');
      res.writeHead(200, {'Content-Type':'application/json'});
      return res.end(JSON.stringify([]));
    }
    
    const carrinho_id = carrinhoRows[0].carrinho_id;
    console.log('🛒 Buscando itens do carrinho ID:', carrinho_id);
    
    const [itens] = await connection.execute(
      `SELECT p.produto_id AS id, p.nome, CAST(p.preco_atual AS DECIMAL(10,2)) AS preco, ctp.quantidade
         FROM carrinho_tem_produto ctp
         JOIN produto p ON p.produto_id = ctp.produto_id
        WHERE ctp.carrinho_carrinho_id = ?`, [carrinho_id]
    );
    console.log('📦 Itens encontrados:', itens.length);
    
    res.writeHead(200, {'Content-Type':'application/json'});
    return res.end(JSON.stringify(itens));
  } catch (err) {
    console.error('❌ Erro na rota /cart:', err);
    console.error('❌ Stack trace:', err.stack);
    const status = err.status || 500;
    res.writeHead(status, {'Content-Type':'application/json'});
    return res.end(JSON.stringify({ message: err.message || 'Erro no carrinho' }));
  }
}

// --- ROTA: POST /cart (adiciona ou incrementa item)
if (pathname === '/cart' && req.method === 'POST') {
  let body = '';
  req.on('data', c => body += c);
  return req.on('end', async () => {
    try {
      const { produto_id, quantidade = 1 } = JSON.parse(body);
      const user = await getUserFromToken(req);
      // pega ou cria carrinho
      const [[c]] = await connection.execute(
        'SELECT carrinho_id FROM carrinho WHERE cliente_id = ?', [user.id]
      );
      let carrinho_id = c?.carrinho_id;
      if (!carrinho_id) {
        const [{ insertId }] = await connection.execute(
          'INSERT INTO carrinho (cliente_id) VALUES (?)', [user.id]
        );
        carrinho_id = insertId;
      }
      // verifica se já tem o produto
      const [existsRows] = await connection.execute(
        'SELECT quantidade FROM carrinho_tem_produto WHERE carrinho_carrinho_id = ? AND produto_id = ?',
        [carrinho_id, produto_id]
      );
      
      if (existsRows.length > 0) {
        // atualiza quantidade
        await connection.execute(
          `UPDATE carrinho_tem_produto 
              SET quantidade = quantidade + ? 
            WHERE carrinho_carrinho_id = ? AND produto_id = ?`,
          [quantidade, carrinho_id, produto_id]
        );
      } else {
        // adiciona novo item (sem precisar do preco_id_preco)
        await connection.execute(
          'INSERT INTO carrinho_tem_produto (carrinho_carrinho_id, produto_id, quantidade) VALUES (?,?,?)',
          [carrinho_id, produto_id, quantidade]
        );
      }
      res.writeHead(201, {'Content-Type':'application/json'});
      return res.end(JSON.stringify({ message: 'Item adicionado ao carrinho' }));
    } catch (err) {
      const status = err.status || 500;
      res.writeHead(status, {'Content-Type':'application/json'});
      return res.end(JSON.stringify({ message: err.message || 'Erro ao adicionar ao carrinho' }));
    }
  });
}

// --- ROTA: DELETE /cart/:produto_id (remove item) ---
if (pathname.startsWith('/cart/') && req.method === 'DELETE') {
  try {
    const user = await getUserFromToken(req);
    const produto_id = pathname.split('/')[2];
    const [carrinhoRows] = await connection.execute(
      'SELECT carrinho_id FROM carrinho WHERE cliente_id = ?', [user.id]
    );
    
    // Se não tem carrinho, retorna erro
    if (!carrinhoRows.length) {
      res.writeHead(404, {'Content-Type':'application/json'});
      return res.end(JSON.stringify({ message: 'Carrinho não encontrado' }));
    }
    
    const carrinho_id = carrinhoRows[0].carrinho_id;
    await connection.execute(
      'DELETE FROM carrinho_tem_produto WHERE carrinho_carrinho_id = ? AND produto_id = ?',
      [carrinho_id, produto_id]
    );
    res.writeHead(200, {'Content-Type':'application/json'});
    return res.end(JSON.stringify({ message: 'Item removido' }));
  } catch (err) {
    console.error('Erro na rota DELETE /cart:', err);
    const status = err.status || 500;
    res.writeHead(status, {'Content-Type':'application/json'});
    return res.end(JSON.stringify({ message: err.message || 'Erro ao remover item' }));
  }
}

// --- ROTA ADMIN: CRUD de produtos ---
// Usar header Authorization: Bearer <token> de admin
function ensureAdmin(req) {
  return getUserFromToken(req).then(decoded => {
    if (decoded.role !== 'administrador') {
      throw { status: 403, message: 'Proibido' };
    }
    return decoded;
  });
}

// POST /admin/produtos
if (pathname === '/admin/produtos' && req.method === 'POST') {
  let body = '';
  req.on('data', c => body += c);
  return req.on('end', async () => {
    try {
      await ensureAdmin(req);
      const { nome, descricao, preco, galpoes } = JSON.parse(body);
      if (!nome || !descricao || !preco || !Array.isArray(galpoes) || galpoes.length === 0) {
        res.writeHead(400, {'Content-Type':'application/json'});
        return res.end(JSON.stringify({ message: 'Campos obrigatórios: nome, descricao, preco, galpoes' }));
      }
      // Cria produto
      const [{ insertId: produto_id }] = await connection.execute(
        'INSERT INTO produto (nome, descricao_produto, status, preco_atual) VALUES (?,?,?,?)',
        [nome, descricao, 'ativo', preco]
      );
      // Insere preço inicial no histórico
      await connection.execute(
        'INSERT INTO historico_precos (produto_id, preco, data_inicio) VALUES (?, ?, ?)',
        [produto_id, preco, new Date()]
      );
      // Insere estoque nos galpões
      for (const g of galpoes) {
        await connection.execute(
          'INSERT INTO guarda (galpao_id, produto_id, quantidade) VALUES (?, ?, ?)',
          [g.galpao_id, produto_id, g.quantidade]
        );
      }
      res.writeHead(201, {'Content-Type':'application/json'});
      return res.end(JSON.stringify({ message: 'Produto criado', id: produto_id }));
    } catch (err) {
      const status = err.status || 500;
      res.writeHead(status, {'Content-Type':'application/json'});
      return res.end(JSON.stringify({ message: err.message || 'Erro admin' }));
    }
  });
}

// PUT /admin/produtos/:id
if (pathname.match(/^\/admin\/produtos\/\d+$/) && req.method === 'PUT') {
  let body = '';
  req.on('data', c => body += c);
  return req.on('end', async () => {
    try {
      await ensureAdmin(req);
      const produto_id = pathname.split('/')[3];
      const { nome, descricao, estoque, status } = JSON.parse(body);
      await connection.execute(
        `UPDATE produto
            SET nome=?, descricao_produto=?, quantidade_estoque=?, status=?
          WHERE produto_id = ?`,
        [nome, descricao, estoque, status, produto_id]
      );
      res.writeHead(200, {'Content-Type':'application/json'});
      return res.end(JSON.stringify({ message: 'Produto atualizado' }));
    } catch (err) {
      const status = err.status || 500;
      res.writeHead(status, {'Content-Type':'application/json'});
      return res.end(JSON.stringify({ message: err.message || 'Erro admin' }));
    }
  });
}

// DELETE /admin/produtos/:id
if (pathname.match(/^\/admin\/produtos\/\d+$/) && req.method === 'DELETE') {
  try {
    await ensureAdmin(req);
    const produto_id = pathname.split('/')[3];
    // Apagar tuplas relacionadas antes de apagar o produto
    await connection.execute('DELETE FROM aplica WHERE produto_id = ?', [produto_id]);
    await connection.execute('DELETE FROM guarda WHERE produto_id = ?', [produto_id]);
    await connection.execute('DELETE FROM preco WHERE produto_id = ?', [produto_id]);
    await connection.execute('DELETE FROM produto_tem_categoria WHERE produto_id = ?', [produto_id]);
    await connection.execute('DELETE FROM carrinho_tem_produto WHERE produto_id = ?', [produto_id]);
    await connection.execute('DELETE FROM imagem_do_produto WHERE produto_produto_id = ?', [produto_id]);
    await connection.execute('DELETE FROM pedido_tem_produto WHERE produto_id = ?', [produto_id]);
    await connection.execute('DELETE FROM historico_precos WHERE produto_id = ?', [produto_id]);
    await connection.execute('DELETE FROM produto WHERE produto_id = ?', [produto_id]);
    res.writeHead(200, {'Content-Type':'application/json'});
    return res.end(JSON.stringify({ message: 'Produto removido' }));
  } catch (err) {
    const status = err.status || 500;
    res.writeHead(status, {'Content-Type':'application/json'});
    return res.end(JSON.stringify({ message: err.message || 'Erro admin' }));
  }
}

// GET /admin/produtos (listar todos para admin)
if (pathname === '/admin/produtos' && req.method === 'GET') {
  try {
    await ensureAdmin(req);
    const [rows] = await connection.execute(
      `SELECT produto_id AS id, nome, descricao_produto AS descricao, quantidade_estoque AS estoque, CAST(preco_atual AS DECIMAL(10,2)) AS preco, status
       FROM produto
       ORDER BY produto_id DESC`
    );
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(rows));
  } catch (err) {
    const status = err.status || 500;
    res.writeHead(status, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ message: err.message || 'Erro ao listar produtos' }));
  }
}

// --- ROTAS ADMIN: CRUD de cupons ---

// POST /admin/cupons
if (pathname === '/admin/cupons' && req.method === 'POST') {
  let body = '';
  req.on('data', c => body += c);
  return req.on('end', async () => {
    try {
      await ensureAdmin(req);
      const { quantidade_de_desconto, tipo_de_desconto, cupom, data_inicio_vigencia, data_fim, cupom_titulo, compra_minima, limite, aplicavel_a, produtos = [], categorias = [] } = JSON.parse(body);

      const [result] = await connection.execute(
        'INSERT INTO cupom (quantidade_de_desconto, tipo_de_desconto, cupom, data_inicio_vigencia, data_fim, cupom_titulo, compra_minima, limite, aplicavel_a) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [quantidade_de_desconto, tipo_de_desconto, cupom, data_inicio_vigencia, data_fim, cupom_titulo, compra_minima, limite, aplicavel_a]
      );
      const cupomId = result.insertId;

      // Montar lista de produtos a aplicar
      let produtosParaAplicar = Array.isArray(produtos) ? [...produtos] : [];
      if (Array.isArray(categorias) && categorias.length > 0) {
        const [produtosDasCategorias] = await connection.execute(
          `SELECT DISTINCT produto_id FROM produto_tem_categoria WHERE categoria_id IN (${categorias.map(() => '?').join(',')})`,
          categorias
        );
        produtosDasCategorias.forEach(p => {
          if (!produtosParaAplicar.includes(p.produto_id)) {
            produtosParaAplicar.push(p.produto_id);
          }
        });
      }
      // Inserir na tabela aplica
      for (const pid of produtosParaAplicar) {
        await connection.execute(
          'INSERT IGNORE INTO aplica (produto_id, id_cupom) VALUES (?, ?)',
          [pid, cupomId]
        );
      }

      res.writeHead(201, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ message: 'Cupom criado com sucesso', id: cupomId }));
    } catch (err) {
      const status = err.status || 500;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ message: err.message || 'Erro ao criar cupom' }));
    }
  });
}

// GET /admin/cupons
if (pathname === '/admin/cupons' && req.method === 'GET') {
  try {
    await ensureAdmin(req);
    const [rows] = await connection.execute(
      `SELECT 
        id_cupom AS id, 
        cupom AS codigo, 
        cupom_titulo AS titulo,
        tipo_de_desconto AS tipo, 
        quantidade_de_desconto AS valor, 
        data_inicio_vigencia, 
        data_fim,
        aplicavel_a,
        compra_minima,
        limite
       FROM cupom 
       ORDER BY data_inicio_vigencia DESC`
    );
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(rows));
  } catch (err) {
    const status = err.status || 500;
    res.writeHead(status, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ message: err.message || 'Erro ao listar cupons' }));
  }
}

// GET /admin/cupons/:id
if (pathname.match(/^\/admin\/cupons\/\d+$/) && req.method === 'GET') {
  try {
    await ensureAdmin(req);
    const id = pathname.split('/')[3];
    const [[cupom]] = await connection.execute(
      `SELECT 
        id_cupom AS id, 
        cupom AS codigo, 
        cupom_titulo AS titulo,
        tipo_de_desconto AS tipo, 
        quantidade_de_desconto AS valor, 
        data_inicio_vigencia, 
        data_fim,
        aplicavel_a,
        compra_minima,
        limite
       FROM cupom 
       WHERE id_cupom = ?`,
      [id]
    );
    if (!cupom) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ message: 'Cupom não encontrado' }));
    }
    // Buscar produtos aplicados
    const [produtos] = await connection.execute(
      'SELECT produto_id FROM aplica WHERE id_cupom = ?', [id]
    );
    cupom.produtos = produtos.map(p => p.produto_id);
    // Buscar categorias aplicadas (se existir relação)
    let categorias = [];
    try {
      const [catRows] = await connection.execute(
        'SELECT categoria_id FROM cupom_tem_categoria WHERE id_cupom = ?', [id]
      );
      categorias = catRows.map(c => c.categoria_id);
    } catch {}
    cupom.categorias = categorias;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(cupom));
  } catch (err) {
    const status = err.status || 500;
    res.writeHead(status, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ message: err.message || 'Erro ao buscar cupom' }));
  }
}

// PUT /admin/cupons/:id
if (pathname.match(/^\/admin\/cupons\/\d+$/) && req.method === 'PUT') {
  let body = '';
  req.on('data', c => body += c);
  return req.on('end', async () => {
    try {
      await ensureAdmin(req);
      const id = pathname.split('/')[3];
      const { quantidade_de_desconto, tipo_de_desconto, cupom, data_inicio_vigencia, data_fim, cupom_titulo, compra_minima, limite, aplicavel_a, produtos = [], categorias = [] } = JSON.parse(body);

      await connection.execute(
        `UPDATE cupom 
         SET quantidade_de_desconto=?, tipo_de_desconto=?, cupom=?, data_inicio_vigencia=?, data_fim=?, cupom_titulo=?, compra_minima=?, limite=?, aplicavel_a=?
         WHERE id_cupom = ?`,
        [quantidade_de_desconto, tipo_de_desconto, cupom, data_inicio_vigencia, data_fim, cupom_titulo, compra_minima, limite, aplicavel_a, id]
      );

      // Limpar registros antigos de aplica
      await connection.execute('DELETE FROM aplica WHERE id_cupom = ?', [id]);
      // Montar lista de produtos a aplicar
      let produtosParaAplicar = Array.isArray(produtos) ? [...produtos] : [];
      if (Array.isArray(categorias) && categorias.length > 0) {
        const [produtosDasCategorias] = await connection.execute(
          `SELECT DISTINCT produto_id FROM produto_tem_categoria WHERE categoria_id IN (${categorias.map(() => '?').join(',')})`,
          categorias
        );
        produtosDasCategorias.forEach(p => {
          if (!produtosParaAplicar.includes(p.produto_id)) {
            produtosParaAplicar.push(p.produto_id);
          }
        });
      }
      // Inserir na tabela aplica
      for (const pid of produtosParaAplicar) {
        await connection.execute(
          'INSERT IGNORE INTO aplica (produto_id, id_cupom) VALUES (?, ?)',
          [pid, id]
        );
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ message: 'Cupom atualizado com sucesso' }));
    } catch (err) {
      const status = err.status || 500;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ message: err.message || 'Erro ao atualizar cupom' }));
    }
  });
}

// DELETE /admin/cupons/:id
if (pathname.match(/^\/admin\/cupons\/\d+$/) && req.method === 'DELETE') {
  try {
    await ensureAdmin(req);
    const id = pathname.split('/')[3];
    // Apagar tuplas da tabela aplica antes de apagar o cupom
    await connection.execute('DELETE FROM aplica WHERE id_cupom = ?', [id]);
    await connection.execute('DELETE FROM cupom WHERE id_cupom = ?', [id]);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ message: 'Cupom removido com sucesso' }));
  } catch (err) {
    const status = err.status || 500;
    res.writeHead(status, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ message: err.message || 'Erro ao remover cupom' }));
  }
}

// --- ROTAS ADMIN: Gerenciamento de preços ---

// POST /admin/produtos/:id/preco
if (pathname.match(/^\/admin\/produtos\/\d+\/preco$/) && req.method === 'POST') {
  let body = '';
  req.on('data', c => body += c);
  return req.on('end', async () => {
    try {
      await ensureAdmin(req);
      const produto_id = pathname.split('/')[3];
      const { preco, data_inicio } = JSON.parse(body);

      // Atualiza o preço atual do produto
      await connection.execute(
        'UPDATE produto SET preco_atual = ? WHERE produto_id = ?',
        [preco, produto_id]
      );

      // Fechar o período anterior no histórico
      await connection.execute(
        'UPDATE historico_precos SET data_fim = ? WHERE produto_id = ? AND data_fim IS NULL',
        [data_inicio || new Date(), produto_id]
      );

      // Registra o novo preço no histórico
      await connection.execute(
        'INSERT INTO historico_precos (produto_id, preco, data_inicio) VALUES (?, ?, ?)',
        [produto_id, preco, data_inicio || new Date()]
      );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ message: 'Preço atualizado com sucesso' }));
    } catch (err) {
      const status = err.status || 500;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ message: err.message || 'Erro ao atualizar preço' }));
    }
  });
}

// GET /admin/produtos/:id/precos
if (pathname.match(/^\/admin\/produtos\/\d+\/precos$/) && req.method === 'GET') {
  try {
    await ensureAdmin(req);
    const produto_id = pathname.split('/')[3];
    
    const [rows] = await connection.execute(
      `SELECT 
        id,
        preco,
        data_inicio,
        data_fim
       FROM historico_precos 
       WHERE produto_id = ?
       ORDER BY data_inicio DESC`,
      [produto_id]
    );
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(rows));
  } catch (err) {
    const status = err.status || 500;
    res.writeHead(status, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ message: err.message || 'Erro ao listar preços' }));
  }
}

// POST /admin/produtos/:id/promocao
if (pathname.match(/^\/admin\/produtos\/\d+\/promocao$/) && req.method === 'POST') {
  let body = '';
  req.on('data', c => body += c);
  return req.on('end', async () => {
    try {
      await ensureAdmin(req);
      const produto_id = pathname.split('/')[3];
      const { tipo_de_desconto, quantidade_de_desconto, data_inicio, data_fim } = JSON.parse(body);
      
      console.log('🔥 Aplicando promoção:', { produto_id, tipo_de_desconto, quantidade_de_desconto, data_inicio, data_fim });
      
      if (!tipo_de_desconto || !quantidade_de_desconto || !data_inicio) {
        res.writeHead(400, {'Content-Type':'application/json'});
        return res.end(JSON.stringify({ message: 'Campos obrigatórios: tipo_de_desconto, quantidade_de_desconto, data_inicio' }));
      }

      // Busca o produto e seu preço atual
      const [[produto]] = await connection.execute(
        'SELECT produto_id, nome, preco_atual FROM produto WHERE produto_id = ?', 
        [produto_id]
      );
      
      if (!produto) {
        res.writeHead(404, {'Content-Type':'application/json'});
        return res.end(JSON.stringify({ message: 'Produto não encontrado' }));
      }

      console.log('📦 Produto encontrado:', produto);

      // Busca o preço base original (sempre o primeiro preço sem desconto)
      let preco_base_original;
      
      // 1. Primeiro tenta buscar do histórico de preços (primeiro preço criado)
      const [[precoBase]] = await connection.execute(
        'SELECT preco FROM historico_precos WHERE produto_id = ? ORDER BY data_inicio ASC LIMIT 1',
        [produto_id]
      );
      
      if (precoBase) {
        preco_base_original = Number(precoBase.preco);
        console.log('💰 Preço base encontrado no histórico:', preco_base_original);
      } else {
        // 2. Se não houver histórico, busca o primeiro preço sem desconto da tabela preco
        const [[precoBaseDB]] = await connection.execute(
          'SELECT preco_total FROM preco WHERE produto_id = ? AND tipo_de_desconto IS NULL ORDER BY data_inicio_vigencia ASC LIMIT 1',
          [produto_id]
        );
        
        if (precoBaseDB) {
          preco_base_original = Number(precoBaseDB.preco_total);
          console.log('💰 Preço base encontrado na tabela preco:', preco_base_original);
        } else {
          // 3. Se não houver nenhum preço base, usa o preço atual (caso de produtos novos)
          preco_base_original = Number(produto.preco_atual);
          console.log('💰 Usando preço atual como base (produto novo):', preco_base_original);
        }
      }
      console.log('💰 Preço base original:', preco_base_original);
      console.log('📊 Preço atual do produto:', produto.preco_atual);
      
      // Calcula o preço com desconto SEMPRE sobre o preço base original
      let preco_com_desconto = preco_base_original;
      if (tipo_de_desconto === 'porcentagem') {
        preco_com_desconto = preco_base_original - (preco_base_original * (Number(quantidade_de_desconto) / 100));
      } else if (tipo_de_desconto === 'fixo') {
        preco_com_desconto = preco_base_original - Number(quantidade_de_desconto);
      }
      
      if (preco_com_desconto < 0) preco_com_desconto = 0;
      
      console.log('🎯 Preço com desconto calculado:', preco_com_desconto);
      console.log('💡 Desconto aplicado sobre o preço base original, não sobre o preço atual');

      // Inicia transação para garantir consistência
      await connection.beginTransaction();
      
      try {
        // 1. Verifica se há preços ativos na tabela preco
        const [precosAtivos] = await connection.execute(
          'SELECT COUNT(*) as count FROM preco WHERE produto_id = ? AND data_fim IS NULL',
          [produto_id]
        );
        console.log('📊 Preços ativos encontrados:', precosAtivos[0].count);

        // 2. Encerra o preço atual (se houver) na tabela preco
        const [resultUpdate] = await connection.execute(
          'UPDATE preco SET data_fim = ? WHERE produto_id = ? AND data_fim IS NULL',
          [data_inicio, produto_id]
        );
        console.log('✅ Preços encerrados:', resultUpdate.affectedRows);

        // 3. Cria novo registro na tabela preco com a promoção
        // Usa os valores corretos do ENUM da tabela preco
        let tipoDescontoDB = null; // normal (sem desconto)
        if (tipo_de_desconto === 'porcentagem') {
          tipoDescontoDB = 'porcentagem';
        } else if (tipo_de_desconto === 'fixo') {
          tipoDescontoDB = 'fixo';
        }
        
        const [resultInsert] = await connection.execute(
          'INSERT INTO preco (data_inicio_vigencia, data_fim, preco_total, preco_com_desconto, quantidade_de_desconto, tipo_de_desconto, produto_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [data_inicio, data_fim || null, preco_base_original, preco_com_desconto, quantidade_de_desconto, tipoDescontoDB, produto_id]
        );
        console.log('✅ Novo preço criado com ID:', resultInsert.insertId);

        // 4. Atualiza preco_atual do produto para o preço promocional
        const [resultProduto] = await connection.execute(
          'UPDATE produto SET preco_atual = ? WHERE produto_id = ?',
          [preco_com_desconto, produto_id]
        );
        console.log('✅ Produto atualizado:', resultProduto.affectedRows, 'linhas afetadas');

        // 5. Se a promoção tem data de fim, cria automaticamente o preço que será aplicado após a promoção
        if (data_fim) {
          // Corrigir: data_inicio_vigencia deve ser o dia seguinte ao término da promoção
          const dataFimDate = new Date(data_fim);
          dataFimDate.setDate(dataFimDate.getDate() + 1);
          const dataInicioNovoPreco = dataFimDate.toISOString().slice(0, 10); // 'YYYY-MM-DD'

          const [resultFuturo] = await connection.execute(
            'INSERT INTO preco (data_inicio_vigencia, data_fim, preco_total, preco_com_desconto, quantidade_de_desconto, tipo_de_desconto, produto_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [dataInicioNovoPreco, null, preco_base_original, preco_base_original, 0, null, produto_id]
          );
          console.log('✅ Preço futuro criado com ID:', resultFuturo.insertId);
        }

        await connection.commit();
        console.log('✅ Transação commitada com sucesso');

        res.writeHead(200, {'Content-Type':'application/json'});
        return res.end(JSON.stringify({ 
          message: 'Promoção aplicada com sucesso', 
          preco_base_original,
          preco_com_desconto,
          data_inicio,
          data_fim: data_fim || 'Sem data de fim definida',
          debug: {
            precos_encerrados: resultUpdate.affectedRows,
            novo_preco_id: resultInsert.insertId,
            produto_atualizado: resultProduto.affectedRows
          }
        }));

      } catch (error) {
        await connection.rollback();
        console.error('❌ Erro na transação:', error);
        throw error;
      }

    } catch (err) {
      console.error('❌ Erro geral na promoção:', err);
      const status = err.status || 500;
      res.writeHead(status, {'Content-Type':'application/json'});
      return res.end(JSON.stringify({ message: err.message || 'Erro ao aplicar promoção' }));
    }
  });
}

// --- ROTA: GET /admin/produtos/:id/precos ---
if (pathname.match(/^\/admin\/produtos\/\d+\/precos$/) && req.method === 'GET') {
  try {
    await ensureAdmin(req);
    const produto_id = pathname.split('/')[3];
    
    // Busca histórico completo de preços
    const [precos] = await connection.execute(`
      SELECT 
        p.id_preco,
        p.data_inicio_vigencia,
        p.data_fim,
        p.preco_total,
        p.preco_com_desconto,
        p.quantidade_de_desconto,
        p.tipo_de_desconto,
        CASE 
          WHEN p.data_inicio_vigencia > CURDATE() THEN 'futura'
          WHEN p.data_fim IS NULL OR p.data_fim >= CURDATE() THEN 'ativa'
          ELSE 'expirada'
        END as status
      FROM preco p
      WHERE p.produto_id = ?
      ORDER BY p.data_inicio_vigencia DESC
    `, [produto_id]);
    
    // Busca informações do produto
    const [[produto]] = await connection.execute(
      'SELECT produto_id, nome, preco_atual FROM produto WHERE produto_id = ?',
      [produto_id]
    );
    
    if (!produto) {
      res.writeHead(404, {'Content-Type':'application/json'});
      return res.end(JSON.stringify({ message: 'Produto não encontrado' }));
    }
    
    res.writeHead(200, {'Content-Type':'application/json'});
    return res.end(JSON.stringify({
      produto: {
        id: produto.produto_id,
        nome: produto.nome,
        preco_atual: produto.preco_atual
      },
      historico_precos: precos
    }));
    
  } catch (err) {
    const status = err.status || 500;
    res.writeHead(status, {'Content-Type':'application/json'});
    return res.end(JSON.stringify({ message: err.message || 'Erro ao buscar histórico de preços' }));
  }
}

// --- ROTA: POST /admin/processar-promocoes-expiradas ---
if (pathname === '/admin/processar-promocoes-expiradas' && req.method === 'POST') {
  try {
    await ensureAdmin(req);
    
    // Busca promoções que expiraram mas ainda não foram processadas
    const [promocoesExpiradas] = await connection.execute(`
      SELECT 
        p.produto_id,
        p.preco_total,
        p.data_fim,
        pr.nome as nome_produto
      FROM preco p
      JOIN produto pr ON pr.produto_id = p.produto_id
      WHERE p.data_fim IS NOT NULL 
        AND p.data_fim < CURDATE()
        AND p.tipo_de_desconto IN ('porcentagem', 'fixo')
        AND p.produto_id IN (
          SELECT produto_id FROM produto WHERE preco_atual != p.preco_total
        )
    `);

    const resultados = [];
    
    for (const promocao of promocoesExpiradas) {
      try {
        await connection.beginTransaction();
        
        // Atualiza o preço do produto para o preço base original
        await connection.execute(
          'UPDATE produto SET preco_atual = ? WHERE produto_id = ?',
          [promocao.preco_total, promocao.produto_id]
        );
        
        // Marca a promoção como processada (opcional)
        await connection.execute(
          'UPDATE preco SET data_fim = data_fim WHERE produto_id = ? AND data_fim = ?',
          [promocao.produto_id, promocao.data_fim]
        );
        
        await connection.commit();
        
        resultados.push({
          produto_id: promocao.produto_id,
          nome: promocao.nome_produto,
          preco_anterior: promocao.preco_total,
          data_expiracao: promocao.data_fim,
          status: 'Processado com sucesso'
        });
        
      } catch (error) {
        await connection.rollback();
        resultados.push({
          produto_id: promocao.produto_id,
          nome: promocao.nome_produto,
          status: 'Erro ao processar: ' + error.message
        });
      }
    }
    
    res.writeHead(200, {'Content-Type':'application/json'});
    return res.end(JSON.stringify({
      message: `Processadas ${resultados.length} promoções expiradas`,
      resultados
    }));
    
  } catch (err) {
    const status = err.status || 500;
    res.writeHead(status, {'Content-Type':'application/json'});
    return res.end(JSON.stringify({ message: err.message || 'Erro ao processar promoções' }));
  }
}

// --- ROTA: POST /aplicar-cupom ---
if (pathname === '/aplicar-cupom' && req.method === 'POST') {
  let body = '';
  req.on('data', chunk => body += chunk);
  return req.on('end', async () => {
    try {
      const { codigos_cupons } = JSON.parse(body); // agora espera um array: ["TEC10", "NOTE500", ...]
      const user = await getUserFromToken(req);
      if (!Array.isArray(codigos_cupons) || codigos_cupons.length === 0) {
        res.writeHead(400, {'Content-Type':'application/json'});
        return res.end(JSON.stringify({ message: 'Nenhum cupom informado', success: false }));
      }
      // Buscar cupons válidos
      const [cupons] = await connection.execute(
        `SELECT id_cupom, cupom, quantidade_de_desconto, tipo_de_desconto, data_inicio_vigencia, data_fim, cupom_titulo, aplicavel_a, compra_minima, limite
         FROM cupom 
         WHERE cupom IN (${codigos_cupons.map(() => '?').join(',')})
           AND data_inicio_vigencia <= CURDATE() AND data_fim >= CURDATE()`,
        codigos_cupons
      );
      if (!cupons.length) {
        res.writeHead(400, {'Content-Type':'application/json'});
        return res.end(JSON.stringify({ message: 'Nenhum cupom válido', success: false }));
      }
      // Buscar itens do carrinho
      const [carrinhoRows] = await connection.execute(
        'SELECT carrinho_id FROM carrinho WHERE cliente_id = ?', [user.id]
      );
      if (!carrinhoRows.length) {
        res.writeHead(400, {'Content-Type':'application/json'});
        return res.end(JSON.stringify({ message: 'Carrinho vazio', success: false }));
      }
      const carrinho_id = carrinhoRows[0].carrinho_id;
      const [itensCarrinho] = await connection.execute(
        `SELECT p.produto_id, p.nome, CAST(p.preco_atual AS DECIMAL(10,2)) AS preco_atual, ctp.quantidade
         FROM carrinho_tem_produto ctp
         JOIN produto p ON p.produto_id = ctp.produto_id
         WHERE ctp.carrinho_carrinho_id = ?`,
        [carrinho_id]
      );
      if (!itensCarrinho.length) {
        res.writeHead(400, {'Content-Type':'application/json'});
        return res.end(JSON.stringify({ message: 'Carrinho vazio', success: false }));
      }
      // Buscar produtos aplicáveis de cada cupom (para cupons de produtos selecionados)
      const produtosPorCupom = {};
      for (const cupom of cupons) {
        if (cupom.aplicavel_a === 'selecionados') {
          const [produtosCupom] = await connection.execute(
            'SELECT produto_id FROM aplica WHERE id_cupom = ?',
            [cupom.id_cupom]
          );
          produtosPorCupom[cupom.cupom] = produtosCupom.map(p => p.produto_id);
        } else {
          produtosPorCupom[cupom.cupom] = null; // null = todos os produtos
        }
      }
      // Para cada produto do carrinho, encontrar o maior desconto possível
      let totalOriginal = 0;
      let totalDesconto = 0;
      const produtosDetalhados = [];
      for (const item of itensCarrinho) {
        let melhorCupom = null;
        let melhorDesconto = 0;
        for (const cupom of cupons) {
          // Verifica se o cupom se aplica ao produto
          if (produtosPorCupom[cupom.cupom] && !produtosPorCupom[cupom.cupom].includes(item.produto_id)) {
            continue;
          }
          // Verifica compra mínima do cupom
          const compraMinima = Number(cupom.compra_minima) || 0;
          const valorProduto = item.preco_atual * item.quantidade;
          if (valorProduto < compraMinima) continue;
          // Calcula desconto
          let desconto = 0;
          if (cupom.tipo_de_desconto === 'porcentagem') {
            desconto = (valorProduto * Number(cupom.quantidade_de_desconto)) / 100;
            if (cupom.limite && desconto > Number(cupom.limite)) {
              desconto = Number(cupom.limite);
            }
          } else {
            desconto = Number(cupom.quantidade_de_desconto);
          }
          if (desconto > melhorDesconto) {
            melhorDesconto = desconto;
            melhorCupom = cupom;
          }
        }
        produtosDetalhados.push({
          produto_id: item.produto_id,
          nome: item.nome,
          preco_unitario: item.preco_atual,
          quantidade: item.quantidade,
          subtotal: item.preco_atual * item.quantidade,
          desconto: melhorDesconto,
          cupom_aplicado: melhorCupom ? {
            codigo: melhorCupom.cupom,
            titulo: melhorCupom.cupom_titulo,
            tipo: melhorCupom.tipo_de_desconto,
            valor: melhorCupom.quantidade_de_desconto
          } : null
        });
        totalOriginal += item.preco_atual * item.quantidade;
        totalDesconto += melhorDesconto;
      }
      const totalFinal = totalOriginal - totalDesconto;
      res.writeHead(200, {'Content-Type':'application/json'});
      return res.end(JSON.stringify({
        success: true,
        produtos: produtosDetalhados,
        total_original: totalOriginal,
        total_desconto: totalDesconto,
        total_final: totalFinal < 0 ? 0 : totalFinal
      }));
    } catch (err) {
      console.error('❌ Erro ao aplicar cupons:', err);
      res.writeHead(500, {'Content-Type':'application/json'});
      return res.end(JSON.stringify({ message: 'Erro interno ao aplicar cupons', success: false }));
    }
  });
}

// --- ROTAS ADMIN: Gerenciamento de Galpões ---

// GET /admin/galpoes
if (pathname === '/admin/galpoes' && req.method === 'GET') {
  try {
    await ensureAdmin(req);
    const [rows] = await connection.execute(
      `SELECT 
        g.id,
        g.nome,
        eg.cep,
        eg.logradouro,
        eg.numero,
        COUNT(DISTINCT gu.produto_id) as produtos_count,
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'produto_id', gu.produto_id,
            'nome', p.nome,
            'quantidade', gu.quantidade
          )
        ) as estoque
       FROM galpao g
       LEFT JOIN endereco_galpao eg ON g.endereco_galpao_endereco_id = eg.endereco_id
       LEFT JOIN guarda gu ON g.id = gu.galpao_id
       LEFT JOIN produto p ON gu.produto_id = p.produto_id
       GROUP BY g.id, g.nome, eg.cep, eg.logradouro, eg.numero
       ORDER BY g.id DESC`
    );
    
    // Processar o estoque para cada galpão
    const galpoes = rows.map(row => {
      let estoque = [];
      try {
        estoque = JSON.parse(row.estoque);
        if (!Array.isArray(estoque) || estoque[0] === null) estoque = [];
      } catch {
        estoque = [];
      }
      return { ...row, estoque };
    });
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(galpoes));
  } catch (err) {
    const status = err.status || 500;
    res.writeHead(status, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ message: err.message || 'Erro ao listar galpões' }));
  }
}

// POST /admin/galpoes
if (pathname === '/admin/galpoes' && req.method === 'POST') {
  let body = '';
  req.on('data', c => body += c);
  return req.on('end', async () => {
    try {
      await ensureAdmin(req);
      const { nome, cep, logradouro, numero } = JSON.parse(body);

      // Inserir endereço primeiro
      const [enderecoResult] = await connection.execute(
        'INSERT INTO endereco_galpao (cep, logradouro, numero) VALUES (?, ?, ?)',
        [cep, logradouro, numero]
      );
      
      const enderecoId = enderecoResult.insertId;

      // Inserir galpão
      const [galpaoResult] = await connection.execute(
        'INSERT INTO galpao (nome, endereco_galpao_endereco_id) VALUES (?, ?)',
        [nome, enderecoId]
      );

      res.writeHead(201, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ 
        message: 'Galpão criado com sucesso', 
        id: galpaoResult.insertId 
      }));
    } catch (err) {
      const status = err.status || 500;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ message: err.message || 'Erro ao criar galpão' }));
    }
  });
}

// PUT /admin/galpoes/:id
if (pathname.match(/^\/admin\/galpoes\/\d+$/) && req.method === 'PUT') {
  let body = '';
  req.on('data', c => body += c);
  return req.on('end', async () => {
    try {
      await ensureAdmin(req);
      const id = pathname.split('/')[3];
      const { nome, cep, logradouro, numero } = JSON.parse(body);

      // Buscar o endereço do galpão
      const [galpaoRows] = await connection.execute(
        'SELECT endereco_galpao_endereco_id FROM galpao WHERE id = ?',
        [id]
      );

      if (!galpaoRows.length) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ message: 'Galpão não encontrado' }));
      }

      const enderecoId = galpaoRows[0].endereco_galpao_endereco_id;

      // Atualizar endereço
      await connection.execute(
        'UPDATE endereco_galpao SET cep = ?, logradouro = ?, numero = ? WHERE endereco_id = ?',
        [cep, logradouro, numero, enderecoId]
      );

      // Atualizar galpão
      await connection.execute(
        'UPDATE galpao SET nome = ? WHERE id = ?',
        [nome, id]
      );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ message: 'Galpão atualizado com sucesso' }));
    } catch (err) {
      const status = err.status || 500;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ message: err.message || 'Erro ao atualizar galpão' }));
    }
  });
}

// DELETE /admin/galpoes/:id
if (pathname.match(/^\/admin\/galpoes\/\d+$/) && req.method === 'DELETE') {
  try {
    await ensureAdmin(req);
    const id = pathname.split('/')[3];

    // Verificar se há produtos no galpão
    const [estoqueRows] = await connection.execute(
      'SELECT COUNT(*) as count FROM guarda WHERE galpao_id = ?',
      [id]
    );

    if (estoqueRows[0].count > 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ message: 'Não é possível excluir um galpão que possui produtos em estoque' }));
    }

    // Buscar o endereço do galpão
    const [galpaoRows] = await connection.execute(
      'SELECT endereco_galpao_endereco_id FROM galpao WHERE id = ?',
      [id]
    );

    if (!galpaoRows.length) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ message: 'Galpão não encontrado' }));
    }

    const enderecoId = galpaoRows[0].endereco_galpao_endereco_id;

    // Excluir galpão
    await connection.execute('DELETE FROM galpao WHERE id = ?', [id]);

    // Excluir endereço
    await connection.execute('DELETE FROM endereco_galpao WHERE endereco_id = ?', [enderecoId]);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ message: 'Galpão removido com sucesso' }));
  } catch (err) {
    const status = err.status || 500;
    res.writeHead(status, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ message: err.message || 'Erro ao remover galpão' }));
  }
}

// GET /admin/galpoes/:id/estoque
if (pathname.match(/^\/admin\/galpoes\/\d+\/estoque$/) && req.method === 'GET') {
  try {
    await ensureAdmin(req);
    const galpaoId = pathname.split('/')[3];
    
    const [rows] = await connection.execute(
      `SELECT 
        gu.produto_id,
        p.nome,
        gu.quantidade
       FROM guarda gu
       JOIN produto p ON gu.produto_id = p.produto_id
       WHERE gu.galpao_id = ?
       ORDER BY p.nome`,
      [galpaoId]
    );
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(rows));
  } catch (err) {
    const status = err.status || 500;
    res.writeHead(status, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ message: err.message || 'Erro ao listar estoque' }));
  }
}

// POST /admin/galpoes/:id/estoque
if (pathname.match(/^\/admin\/galpoes\/\d+\/estoque$/) && req.method === 'POST') {
  let body = '';
  req.on('data', c => body += c);
  return req.on('end', async () => {
    try {
      await ensureAdmin(req);
      const galpaoId = pathname.split('/')[3];
      const { produto_id, quantidade } = JSON.parse(body);

      // Verificar se já existe o produto no galpão
      const [existingRows] = await connection.execute(
        'SELECT quantidade FROM guarda WHERE galpao_id = ? AND produto_id = ?',
        [galpaoId, produto_id]
      );

      if (existingRows.length > 0) {
        // Atualizar quantidade
        await connection.execute(
          'UPDATE guarda SET quantidade = quantidade + ? WHERE galpao_id = ? AND produto_id = ?',
          [quantidade, galpaoId, produto_id]
        );
      } else {
        // Inserir novo produto
        await connection.execute(
          'INSERT INTO guarda (galpao_id, produto_id, quantidade) VALUES (?, ?, ?)',
          [galpaoId, produto_id, quantidade]
        );
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ message: 'Produto adicionado ao estoque com sucesso' }));
    } catch (err) {
      const status = err.status || 500;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ message: err.message || 'Erro ao adicionar produto ao estoque' }));
    }
  });
}

// DELETE /admin/galpoes/:id/estoque/:produto_id
if (pathname.match(/^\/admin\/galpoes\/\d+\/estoque\/\d+$/) && req.method === 'DELETE') {
  try {
    await ensureAdmin(req);
    const galpaoId = pathname.split('/')[3];
    const produtoId = pathname.split('/')[5];

    await connection.execute(
      'DELETE FROM guarda WHERE galpao_id = ? AND produto_id = ?',
      [galpaoId, produtoId]
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ message: 'Produto removido do estoque com sucesso' }));
  } catch (err) {
    const status = err.status || 500;
    res.writeHead(status, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ message: err.message || 'Erro ao remover produto do estoque' }));
  }
}

// --- ROTAS ADMIN: Histórico de Preços ---

// GET /admin/precos
if (pathname === '/admin/precos' && req.method === 'GET') {
  try {
    await ensureAdmin(req);
    const [rows] = await connection.execute(
      `SELECT 
        p.id_preco AS id,
        p.produto_id,
        pr.nome AS produto_nome,
        p.data_inicio_vigencia AS data_inicio,
        p.data_fim,
        p.preco_total,
        p.preco_com_desconto,
        p.quantidade_de_desconto,
        p.tipo_de_desconto
       FROM preco p
       JOIN produto pr ON pr.produto_id = p.produto_id
       ORDER BY p.produto_id, p.data_inicio_vigencia DESC`
    );
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(rows));
  } catch (err) {
    const status = err.status || 500;
    res.writeHead(status, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ message: err.message || 'Erro ao listar histórico de preços' }));
  }
}

// POST /admin/verificar-precos
if (pathname === '/admin/verificar-precos' && req.method === 'POST') {
  try {
    await ensureAdmin(req);
    
    console.log('🔍 Verificação manual de preços solicitada...');
    
    // Buscar todos os produtos
    const [produtos] = await connection.execute(
      'SELECT produto_id, nome, preco_atual FROM produto WHERE status = "ativo"'
    );
    
    let produtosAtualizados = 0;
    const detalhesAtualizacoes = [];
    
    for (const produto of produtos) {
      // Buscar o preço em vigor para este produto
      const [precosVigentes] = await connection.execute(
        `SELECT 
          id_preco,
          preco_com_desconto,
          data_inicio_vigencia,
          data_fim
         FROM preco 
         WHERE produto_id = ? 
         AND data_inicio_vigencia <= CURDATE()
         AND (data_fim IS NULL OR data_fim >= CURDATE())
         ORDER BY data_inicio_vigencia DESC, id_preco DESC
         LIMIT 1`,
        [produto.produto_id]
      );
      
      if (precosVigentes.length > 0) {
        const precoVigente = precosVigentes[0];
        const precoCorreto = parseFloat(precoVigente.preco_com_desconto);
        const precoAtual = parseFloat(produto.preco_atual);
        
        if (Math.abs(precoCorreto - precoAtual) > 0.01) {
          await connection.execute(
            'UPDATE produto SET preco_atual = ? WHERE produto_id = ?',
            [precoCorreto, produto.produto_id]
          );
          
          detalhesAtualizacoes.push({
            produto_id: produto.produto_id,
            nome: produto.nome,
            preco_anterior: produto.preco_atual,
            preco_novo: precoCorreto,
            tipo: 'preco_vigente'
          });
          produtosAtualizados++;
        }
      } else {
        // Se não há preço em vigor, buscar o preço base mais recente
        const [precosBase] = await connection.execute(
          `SELECT 
            id_preco,
            preco_total
           FROM preco 
           WHERE produto_id = ? 
           ORDER BY data_inicio_vigencia DESC, id_preco DESC
           LIMIT 1`,
          [produto.produto_id]
        );
        
        if (precosBase.length > 0) {
          const precoBase = parseFloat(precosBase[0].preco_total);
          const precoAtual = parseFloat(produto.preco_atual);
          
          if (Math.abs(precoBase - precoAtual) > 0.01) {
            await connection.execute(
              'UPDATE produto SET preco_atual = ? WHERE produto_id = ?',
              [precoBase, produto.produto_id]
            );
            
            detalhesAtualizacoes.push({
              produto_id: produto.produto_id,
              nome: produto.nome,
              preco_anterior: produto.preco_atual,
              preco_novo: precoBase,
              tipo: 'preco_base'
            });
            produtosAtualizados++;
          }
        }
      }
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      message: `${produtosAtualizados} produtos tiveram seus preços corrigidos`,
      produtos_atualizados: produtosAtualizados,
      detalhes: detalhesAtualizacoes
    }));
    
  } catch (err) {
    console.error('❌ Erro na verificação manual de preços:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ message: 'Erro ao verificar preços' }));
  }
}

// GET /admin/categorias
if (pathname === '/admin/categorias' && req.method === 'GET') {
  try {
    await ensureAdmin(req);
    const [rows] = await connection.execute(
      'SELECT id, nome FROM categoria ORDER BY nome'
    );
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(rows));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ message: 'Erro ao listar categorias' }));
  }
}

  // --- Arquivos estáticos em ./public ---
  const publicDir = path.join(__dirname, 'public');
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(publicDir, filePath);

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not Found');
    }
    res.writeHead(200, { 'Content-Type': getContentType(filePath) });
    res.end(content);
  });
});

// --- Inicia o servidor ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
