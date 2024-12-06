const mongoose = require('mongoose');

const allPostsByWordSchema = new mongoose.Schema({
    name: { type: String, required: true }, 
    word: { type: String, required: true },
    text: { type: String, required: true },
    clean: { type: String, required: true },
    word_array: [ {type: String} ],
    postId: { type: mongoose.Schema.Types.ObjectId}
}, {timestamps: true});

const allPostsByWord = mongoose.model('view', allPostsByWordSchema, 'vw_all_posts_by_word');

module.exports = allPostsByWord;

// {
//     "word_array": [],
//     "name": "kim",
//     "text": "once upon a time, there was a baby bear.  he was very kind and gentle... and very intelligent",
//     "word": "peter",
//     "clean": "once upon a time there was a baby bear he was very kind and gentle and very intelligent",
//     "createdAt": {
//       "$date": "2024-12-02T03:13:03.446Z"
//     },
//     "updatedAt": {
//       "$date": "2024-12-02T03:13:03.446Z"
//     },
//     "postId": {
//       "$oid": "674d25bf4f90e06da72d0b1f"
//     }
//   }