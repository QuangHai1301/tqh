const mysql = require("mysql");

const connection = mysql.createConnection({
  host:"localhost",
  port:3307,
  user:"root",
  database:"homehavendb",
  password:"",
});

connection.connect();
module.exports = connection;