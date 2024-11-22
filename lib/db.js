const mysql = require("mysql2");

const connection = mysql.createConnection({
  host:"localhost",
  port:3307,
  user:"root",
  database:"homehavendb",
  password:"",
});

connection.connect();
module.exports = connection;