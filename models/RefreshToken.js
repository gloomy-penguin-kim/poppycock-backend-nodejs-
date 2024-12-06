const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema({
    userId:    { type: String,  required: true  },  
    username: { type: String,  required: true },  
    refresh_token:  { type: String, required: true, unique: true },  
    active: { type: Boolean, required: true, default: true}
}, {timestamps: true});
const RefreshTokens = mongoose.model('RefreshTokens', refreshTokenSchema);

module.exports = RefreshTokens