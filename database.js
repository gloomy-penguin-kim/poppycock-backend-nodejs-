const mongoose = require('mongoose');

require('dotenv').config(); 

mongoose.set('strictQuery', true);
  
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}`;
const clientOptions = { dbName: 'socialDb', serverApi: { version: '1', strict: true, deprecationErrors: true } };  
mongoose.set('debug', true);
mongoose.connect(uri, clientOptions)
  .then(() => console.log('Connected to database:', mongoose.connection.name) );

module.exports = mongoose 