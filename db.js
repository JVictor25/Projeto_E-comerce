// db.js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:     'localhost',
  user:     'weuler',
  password: 'Deusefiel@2002',
  database: 'mydb',
  port:     3306,
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0
});

module.exports = pool;
