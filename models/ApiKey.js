const mongoose = require('mongoose');

const appSchema = new mongoose.Schema({
    app_name:    { type: String,  required: true, unique: true },  
    app_api_key: { type: String,  required: true, unique: true },  
    app_active:  { type: Boolean, required: true, default: true },  
}, {timestamps: true});
const AppApiKeys = mongoose.model('AppApiKeys', appSchema);
    
module.exports = AppApiKeys
 

//AppApiKeys.create({ app_name: "Poppycock", app_api_key: "d434509b-b4bc-4048-890c-def323c5eed2" })