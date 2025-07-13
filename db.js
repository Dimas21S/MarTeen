const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "Dimas210904",
    port: "3307",
    database: "marteen"
});

connection.connect((err) => {
    if (err) {
        console.error("Error connecting to MySql: ", err);
        return;
    }
    console.log("Berhasil");
});

module.exports = connection;