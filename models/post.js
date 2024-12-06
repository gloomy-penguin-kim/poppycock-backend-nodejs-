const mongoose = require('mongoose');

const postSChema = new mongoose.Schema({
    wordId: { type: mongoose.Schema.Types.ObjectId, index: true  },
    word: { type: String, required: true, index: true }, 
    name: { type: String, required: true, index: true  }, 
    text: { type: String, required: true, index: false  }, 
    clean: { type: String, required: true, index: false  }, 
}, {timestamps: true});

const Post = mongoose.model('Post', postSChema);

module.exports = Post;
 

// mongoose.createView(
//     "VW_Word_Posts",
//     "Post",
//     [
//         {
//           $addFields:
//             {
//               postCleaned: { $replaceAll: { input: "$clean", find: "'", replacement: "_" } }
//             }
//         },
//        {
//           $addFields:
//             {
//               postCleaned: { $replaceAll: { input: "$clean", find: "-", replacement: "_" } }
//             }
//         },
//        {
//          $addFields: {
//            key_words: {
//              $split: ["$postCleaned", " "]
//            }
//          }
//        },
//        { $unwind: "$key_words" },
//        {
//          $lookup: {
//            from: "words",
//            localField: "key_words",
//            foreignField: "word",
//            as: "lookup_result"
//          }
//        },
//        {
//          $match: {
//            $expr: {
//              $gte: [{ $size: "$lookup_result" }, 1]
//            }
//          }
//        },
//        {
//          $group: {
//            _id: {
//              createdAt:  "$createdAt",
//              updatedAt:  "$updatedAt",
//              _id:   "$_id",
//              clean: "$clean",
//              text:  "$text",
//              user:  "$user",
//              word:  "$word"
//            },
//            word_array: { $addToSet: "$key_words" }
//          }
//        },
//        {
//          $addFields: {
//            user: "$_id.user",
//            word: "$_id.word",
//            text: "$_id.text",
//            clean: "$_id.clean",
//            createdAt: "$_id.createdAt",
//            updatedAt: "$_id.updatedAt",
//            _id: "$_id._id"
//          }
//        }
//      ]
//  )
// //  {
// //     "_id": {
// //       "$oid": "673e43d705703fa24b48c624"
// //     },
// //     "word_array": [ "hello", "_nothing_", "and", "hello_again" ],
// //     "user": "nemo",
// //     "post": "hello and hello_again and underscore... isn't! _nothing_ nothing_...",
// //     "word": "hello"
// //   }

// mongoose.VW_Word_Posts.find({ })
// .then(data => {
//     console.log("data", data)
// })
