const mysql = require("mysql2");

const connection = mysql.createConnection({
  host: "localhost", // Alamat server MySQL (biasanya localhost jika menggunakan phpMyAdmin lokal)
  user: "root", // Username MySQL (biasanya root)
  password: "Dimas210904", // Password MySQL (biasanya kosong)
  database: "auth_db", // Nama database kamu (buat dulu di phpMyAdmin)
  port: 3307,
  charset: "utf8mb4",
  connectTimeout: 10000,
  supportBigNumbers: true,
  bigNumberStrings: true,
  multipleStatements: true,
});

connection.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL:", err);
    return;
  }
  console.log("Connected to MySQL!");
});

module.exports = connection;
