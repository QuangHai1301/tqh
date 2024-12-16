const mysql = require("mysql2");

const connection = mysql.createConnection({
  host:"localhost",
  port:3306,
  user:"root",
  database:"homehavendb",
  password:"123456",
});

connection.connect();
module.exports = connection;