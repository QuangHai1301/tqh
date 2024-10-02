const express = require('express');
const jwt = require('jsonwebtoken');
const app = express();
const cors = require('cors')


const PORT = process.env.PORT || 19006;

app.use(express.json());
app.use(cors());

const router = require('./routes/router');
app.use('/api',router)

app.get('/',function(req,res){
res.send('data test');
});

// Start the server
app.listen(PORT , () => {
  console.log('Server started on port ' + PORT);
});
