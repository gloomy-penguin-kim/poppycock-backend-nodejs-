const mongoose = require('mongoose');

const wordSchema = new mongoose.Schema({
    word: { type: String, required: true, unique: true },  
}, {timestamps: true});

const Word = mongoose.model('Word', wordSchema);

 

// db.createView(
//     "VW_Word_Posts",
//     "Post",
//     [
//         {
//           $lookup: {
//             from: "posts",
//             localField: "word",
//             foreignField: "word",
//             as: "hasPosts"
//           }
//         },
//         {
//           $addFields: {
//             hasPosts: { $size: "$hasPosts" }
//           }
//         }
//     ])

    // {
    //     "_id": {
    //       "$oid": "673e3e4105703fa24b48c613"
    //     },
    //     "postId": {
    //       "$oid": "673e3e4105703fa24b48c613"
    //     },
    //     "word": "hello",
    //     "hasPosts": 2
    //   }


module.exports = Word;

