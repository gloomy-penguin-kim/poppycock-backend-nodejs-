const express = require('express');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcrypt'); 
const { timeStamp } = require('console');
const axios = require('axios').default;

const morgan = require('morgan'); 
const cors = require('cors'); 

require('dotenv').config();

const fs = require('fs')

const db = require('./database')
const User = require('./models/user')
const Post = require('./models/post')
const Word = require('./models/word')
const allPostsByWord = require('./models/vw_all_posts_by_word') 
const appApiKey = require('./models/ApiKey')
const refreshTokens = require('./models/RefreshToken')

const cookieParser = require("cookie-parser");
const helmet = require('helmet')

const app = express(); 

const PORT = process.env.PORT || 3002;
const SECRET_KEY = process.env.SECRET_KEY;
const REFRESH_SECRET_KEY = process.env.REFRESH_SECRET_KEY; 
const saltRounds = 5 

app.use(morgan('dev'));
app.use(cors()); 
app.use(helmet()); 
app.use(cookieParser()); 
app.use(express.json());
app.use(express.urlencoded({ extended: true })); 
app.use(session({ 
    secret: SECRET_KEY, 
    resave: false, 
    saveUninitialized: true, 
    cookie: { 
        //secure: true, 
        maxAge: 24 * 60 * 60 * 1000  // 24 hours 
    } }
));

 
 
// Insert your authenticateJWT Function code here.
function authenticateJWT(req, res, next) { 
    console.log("req.session", req.session)
    console.log("res.session", res.session)

    const access_token = req.session.access_token || req.headers.authorization.split(' ')[1] || null;  
    
    if (!access_token) 
        return res.status(401).json({ error: 'Unauthorized - No access token' });
   
    try {
      const decoded = jwt.verify(access_token, SECRET_KEY);
      req.user = decoded; 
      //req.session.access_token = access_token 
      next()
    } catch (err) {
        console.log(err) 
        if (err.name === 'TokenExpiredError') {
            // Handle expired token
            console.log("checking for refresh token", res.cookies)
            const refresh_token = req.cookies?.refresh_token || req.session?.refresh_token|| null

            try {
                if (refresh_token) {
                    refreshTokens.findOne({refresh_token: refresh_token})
                        .then(foundToken => {
                            if (foundToken) {
                                // delete it since we'll either use it or it is corrupted  
                                res.cookie("refresh_token", null)
                                req.session.refresh_token = null 
                                res.session.refresh_token = null 

                                refreshTokens.findByIdAndDelete(foundToken._id)
                                    .then(response => {
                                        //req.cookie("refresh_token", null)
                                        // we found something to delete from teh database
                                        if (response) {
    
                                            res.redirect('/api/authorize')
    
                                            try {
                                                const decoded_refresh = jwt.verify(refresh_token, REFRESH_SECRET_KEY)
                                                res.redirect('/api/authorize')
                                            }
                                            catch (err) {
                                                console.log(err)  
                                                return res.status(401).json({error: "Invalid refresh token"})
                                            }
                                        }
                                        else 
                                            return res.status(404).json({error: "Refresh key already used or was never issued"})
                                    })
                                    .catch(err =>  {
                                        console.log(err)
                                        return res.status(404).json({error:"Problem deleting refresh token from database"})
                                    })
                            } 
                            else  
                                return res.status(404).json({error: "Refresh token not found in the databse"})
                        })
                        .catch(err => {
                            console.log(err)
                            return res.status(404).json({error: "Database error"})
                        })
                   
                    // const { userId, username } = req.body
                
                    // const access_token = jwt.sign({ userId, username }, SECRET_KEY, { expiresIn: '15m' }); 
                    // return res.status(401).json({ error: "New token issued",
                    //                        access_token: access_token
                    // })
                }
                else
                    return res(404).json({error: "Refresh token not found in http cookies"})
            }
            catch (err) {
                console.log(err) 
                res.cookie.refresh_token = null 
                return res.status(401).json({ error: 'Invalid Refresh token' });
            }
        } else {
            return res.status(401).json({ error: 'Err.name was not TokenExpiredError' });
        }
        //return res.status(401).json({ error: 'Invalid token' });
    }
  } 

//   try {
//     const decoded = jwt.verify(accessToken, secretKey);
//     // Token is valid, proceed with your logic
//   } catch (err) {
//     if (err.name === 'TokenExpiredError') {
//       // Verify refresh token
//       try {
//         const decoded = jwt.verify(refreshToken, refreshSecretKey);
//         // Generate new access token
//         const newAccessToken = jwt.sign({ /* payload */ }, secretKey, { expiresIn: '15m' });
//         // Return new access token
//         res.json({ accessToken: newAccessToken });
//       } catch (err) {
//         // Handle refresh token error
//         res.status(401).json({ error: 'Refresh token invalid or expired' });
//       }
//     } else {
//       // Handle other errors
//       res.status(401).json({ error: 'Invalid token' });
//     }
//   }

function authenticateApiKey(req, res, next) {
    console.log("authenticateApiKey", req.headers['x-api-key'])
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) return res.status(401).json({ error: 'Unauthorized - No API Key' });

    appApiKey.find({ app_api_key: apiKey })
        .then(data => {
            if (data.length == 0) {
                return res.status(500).json({error: "Unauthorized - Api key not found in database"})
            }
            next() 
        })
        .catch(err => {
            return res.status(500).json({error: "Unauthorized - Could not verify your api key"})
        }) 
}

app.post('/api/authorize', [authenticateApiKey], (req, res) => {
    const { userId, username } = req.body

    if (!userId || userId.length == 0) return res.send(401).json({error: "Missing information: userId"})
    if (!username || username.length == 0) return res.send(401).json({error: "Missing information: username"})
 
    const access_token = jwt.sign({ userId, username }, SECRET_KEY, { expiresIn: '2m' }); 
    const refresh_token = jwt.sign({ userId, username }, REFRESH_SECRET_KEY, { expiresIn: '1h' });

    console.log("access_token", access_token)
    console.log("resfresh_token", refresh_token)
    refreshTokens.create({ userId: userId, username: username, refresh_token: refresh_token })  

    req.session.access_token = access_token    
    req.session.refresh_token = refresh_token    
    res.cookie("refresh_token", refresh_token, { httpOnly: true, expiresIn: '1h' }) 
    res.status(201).send({refresh_token:refresh_token, access_token:access_token});
})

app.post('/api/refresh', [authenticateApiKey], (req, res) => {
    const { userId, username, refresh_token } = req.body
 
    const access_token = jwt.sign({ userId, username }, SECRET_KEY, { expiresIn: '15m' }); 
    const resfresh_token = jwt.sign({ userId, username }, REFRESH_SECRET_KEY, { expiresIn: '1h' });

    req.session.access_token = access_token    
    req.session.refresh_token = resfresh_token    

    res.status(200).send(token);
})

const cleanText = (text) => {
    return text.replaceAll("-","_")
            .replaceAll("'","_")
            .replaceAll(/[^\w\s_]/g,' ')
            .replaceAll(/\s\s+/g, ' ')
            .replaceAll(/_+/g, '_')
            .toLowerCase() 
}
const cleanWord = (word) => {
    return word.replaceAll("-","_")
            .replaceAll("'","_")
            .replaceAll(/[^\w\s_]/g,'')
            .replaceAll(/\s+/g, '')
            .replaceAll(/_+/g, '_')
            .toLowerCase() 
}
const isValidUsername = (name) => {
    const usernameRegex = /^[0-9A-Za-z._\-]{1,30}$/
    return usernameRegex.test(name)
}
const isValidEmail = (email) => { 
    email = email.replaceAll(".","").replaceAll("_","")
    try {
        let emails = email.split("@") 
        console.log("emails", emails)
        const emailRegex = /^[0-9A-Za-z]{1,254}$/
        return emailRegex.test(emails[0]) && emailRegex.test(emails[1]) 
    }
    catch(err) {
        return false; 
    }
}



// Insert your user registration code here.
app.post('/api/register', authenticateApiKey, async (req, res) => {
    const { name, email, password } = req.body; 

    if (!name || !email || !password)
        return res.status(400).send({ message: 'One or more of the fields are empty' }); 

    if (!isValidUsername(name)) 
        return res.status(400).send({ message: 'The username is invalid' });

    if (!isValidEmail(email)) 
        return res.status(400).send({ message: 'The email is invalid' });
  
    const existingUser = await User.findOne({ "$or": [
        { "name": { $regex: "^"+name+"$", $options: 'i' } },
        { "email": { $regex: "^"+email+"$", $options: 'i' } }] }); 
    if (existingUser) return res.status(409).send({ message: 'User already exists' });
    
    try { 
        bcrypt.genSalt(saltRounds, (err, salt) => { 
            if (err) throw Error(err) 
            bcrypt.hash(password, salt, (err, hash) => {
                if (err) throw Error(err) 
                const newUser = new User({ "name": name, "email": email, "password": hash }); 
                newUser.save()
                    .then(() => { 
                        console.log("newUser", newUser)
                        const userObj = { 
                            userId: newUser._id, 
                            username:   newUser.name,
                            email:  newUser.email 
                        }
                        const token = jwt.sign(userObj, SECRET_KEY, { expiresIn: '1h' });
                        req.session.token = token; 
                        res.status(200).send({"message":`The user ${newUser.name} has been created`,
                                             "user": userObj,
                                             token: token
                                            });
                    }) 
            }); 
        });
   
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: error });
    }
  });


// Insert your user login code here.
app.post('/api/login', authenticateApiKey, async (req, res) => { 
    const { name, password } = req.body; 

    console.log("/api/login", req.body);

    if (!name) 
        return res.status(401).json({ message: 'Username/email is empty' }); 

    if (!password) 
        return res.status(401).json({ message: 'Password is empty' }); 
 
    User.findOne({"$or": [{ name: { $regex: "^"+name+"$", $options: 'i' } },
                          { email:{ $regex: "^"+name+"$", $options: 'i' } }] })
        .then(user => {
            console.log("USER", user)
            if (user) {   
                bcrypt.compare(password, user.password, (err, result) => { 
                    if (result) {   
                        const userObj = { 
                            userId: user._id, 
                            username: user.name,
                            email: user.email 
                        }
                        
                        const token = jwt.sign(userObj, SECRET_KEY, { expiresIn: '1h' }); 
                        req.session.token = token    
                        console.log("login token", req.session)
             
                        res.status(200).send( { "message":`${user.name} has logged in`, 
                                                "user": userObj,
                                                token: token 
                                                });
                    } else {
                        return res.status(401).json({ error: 'Invalid credentials' }); 
                    } 
                });
            }
            else {
                res.status(500).json({ error: 'User not found' });
            }
        })
        .catch(error => {  
            console.log(error) 
            res.status(500).json({ error: "Internal server error" });
        }) 
  });


 
// create a new post 
app.post('/api/posts', [authenticateApiKey], (req, res) => {
    const { word, text, username } = req.body; 
  
    if (!text || typeof text !== 'string') 
        return res.status(400).json({ message: 'Please provide valid post content' });

    const clean = cleanText(text)  
    const wordClean = cleanWord(word)
  
    console.log(req.user)
    const newPost = new Post({ name: username, word: wordClean, text: text, clean: clean });
    console.log(newPost)
    newPost.save()
        .then(() => { 
            res.status(200).json({ message: 'Post created successfully' });

            Word.find({ word: wordClean })
                .then(data => {
                    if (!data || data.length == 0) {
                        console.log("A new word!", wordClean)
                        Word.create({ word: wordClean }) 
                    }
                    else {
                        console.log("data isnt empty", data)
                    }
                })
        })
        .catch(() => {
            res.status(500).json({ error: "Error saving new post" })
        }) 
  });

// random words
app.get('/api/random/:num', [authenticateApiKey], async (req, res) => {
    const num = parseInt(req.params.num);  
    console.log("/api/posts", req.params)
 
    Word.aggregate() 
        .sample(num)
        .exec()       
        .then((data) => {  
            res.status(200).send(data) 
        })
        .catch(error => {
            console.log(error) 
            res.status(500).send(error)  
        }) 
});


// list all posts for this user
app.get('/api/posts/:name', [authenticateApiKey], async (req, res) => {
    const name = req.params.name;  
    console.log("/api/posts", req.params)
 
    Post.aggregate()
        .match({ name: { $regex: "^"+name+"$", $options: 'i' } })
        .group({ _id: { postId: "$_id", word: "$word" }, updatedAt: { $max: "$createdAt" } })
        .project({  postId : "$_id.postId", word: "$_id.word", updatedAt: "$updatedAt", "_id": "$taco" })
        .sort({ updatedAt: -1 })
        .addFields({yearMonthDay: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } }})
        .exec()       
        .then((data) => {  
            res.status(200).send(data) 
        })
        .catch(error => {
            console.log(error) 
            res.status(500).send(error)  
        }) 
});

// list all posts for this date 
app.get('/api/when/:dt?', [authenticateApiKey], async (req, res) => {
    let dt = req.params.dt;  
    console.log("/api/when", req.params)

    if (dt == 'null' || dt == 'undefined') dt = null 

    if (!dt) {
        let data = await Post.aggregate() 
                        .addFields({yearMonthDay: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } }})
                        .sample(1)
                        .exec()
        console.log("DATA", data[0].yearMonthDay)
        dt = dt ||  data[0].yearMonthDay; 
    }
 
    Post.aggregate()
        .addFields({yearMonthDay: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } }})
        .match({ yearMonthDay: { $eq: dt }})
        .project({ postId: "$_id", word: "$word", name: "$name", updatedDt: "$updatedAt", yearMonthDay: "$yearMonthDay" })
        .sort( { updatedAt: -1})
        .exec()  
        .then((data) => {  
            res.status(200).send(data) 
        })
        .catch(error => {
            console.log(error) 
            res.status(500).send({ error : "Internal server error" })  
        }) 
});


// get user info 
app.get('/api/users/:name', [authenticateApiKey], async (req, res) => {
    const name = req.params.name;   
    User.aggregate()
        .match({ name: { $regex: "^"+name+"$", $options: 'i' } })
        .project({ "name": "$name", "email": "$email", "userId":"$_id" })
        .exec()       
        .then((data) => {  
            res.status(200).send(data) 
        })
        .catch(error => {
            console.log(error) 
            res.status(500).send({ error : "Internal server error" })  
        }) 
});


// get who is posting 
app.get('/api/who', [authenticateApiKey], async (req, res) => { 
    Post.aggregate()
        .group({ _id: { word: "$word", name: "$name" }, maxUpdatedAt: { $max: "$updatedAt" } })
        .addFields({ word: "$_id.word", name: "$_id.name", maxUpdatedAt: "$maxUpdatedAt" })
        .sort( { maxUpdatedAt: -1 })
        .limit(30)
        .sort({ name: 1, word: 1})
        .addFields({ _id: "$taco"})
        .exec()
        .then(data => {
            console.log(data) 
            res.status(200).json(data)
        })
        .catch(err => {
            console.log(err) 
            res.status(500).json({error: "Internal server error"})
        })
        
});


// get stats for today, yesterday 
app.get('/api/stats', [authenticateApiKey], async (req, res) => {
    let dt = new Date(); 
    let year = dt.getFullYear();
    let month = String(dt.getMonth() + 1).padStart(2, '0'); // JavaScript months are 0-indexed
    let day = String(dt.getDate()).padStart(2, '0');
    const today = year + "-" + month + "-" + day 
    
    let yesterday = new Date(new Date().setDate(new Date().getDate()-1));
    year = yesterday.getFullYear();
    month = String(yesterday.getMonth() + 1).padStart(2, '0'); // JavaScript months are 0-indexed
    day = String(yesterday.getDate()).padStart(2, '0');
    yesterday = year + "-" + month + "-" + day 
    
    let rData = {}

    try {
        rData.yesterday = await Post.aggregate()
                                .addFields({yearMonthDay: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } }})
                                .match({ yearMonthDay: { $eq: yesterday }})
                                .sort( { updatedAt: -1})
                                .project({ postId: "$_id", word: "$word", name: "$name", updatedDt: "$updatedAt", yearMonthDay: "$yearMonthDay" })
                                .group( { _id: { word: "$word" }, maxUpdatedDate: { $max: "$updatedDt"} })
                                .sort( { maxUpdatedDate: -1})
                                .addFields({ word: "$_id.word", _id: "$taco" })
                                .exec();
        rData.today = await Post.aggregate()
                                .addFields({yearMonthDay: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } }})
                                .match({ yearMonthDay: { $eq: today }})
                                .project({ postId: "$_id", word: "$word", name: "$name", updatedDt: "$updatedAt", yearMonthDay: "$yearMonthDay" })
                                .group( { _id: { word: "$word" }, maxUpdatedDate: { $max: "$updatedDt"} })
                                .sort( { maxUpdatedDate: -1})
                                .addFields({ word: "$_id.word", _id: "$taco" })
                                .exec();
        res.status(200).json(rData);
    }
    catch (err) {
        console.log(err); 
        res.status(500).json({error: "Internal server error"})
    }
});

// list all posts for this word
app.get('/api/words/:word', [authenticateApiKey], async (req, res) => {
    console.log("here", req.params.word)
    const word = req.params.word; 
    const clean = cleanWord(word) 
    
    allPostsByWord.find({word: { $regex: "^"+clean+"$", $options: 'i' } })
        .then(data => {
            res.status(200).json(data) 
        })
        .catch(err => {
            console.log(err)
            res.status(500).json({ message: "Cannot find the posts" })
        })
 
    // Post.aggregate()
    //     .match({ word: { $regex: "^"+word+"$", $options: 'i' } })
    //     .addFields({ key_words: { $split: ["$clean", " "] } })
    //     .unwind("$key_words")
    //     .lookup({
    //         "from": "words",
    //         "localField": "key_words",
    //         "foreignField": "word",
    //         "as": "lookup_result"
    //       })
    //     //.match({ $expr: { $gt: [{$size:"$lookup_result"}, 0] } })
    //     .addFields({ "foundWordsCount": { "size": "$lookup_result" } })
    //     .group({
    //         "_id": {
    //           "createdAt":  "$createdAt", "updatedAt":  "$updatedAt", "_id": "$_id", 
    //           "text": "$text", "name": "$name", "word": "$word", "clean": "$clean"
    //         },
    //         "word_array": { "$addToSet": { "$cond": { "if": { "$gte": [ "$foundWordsCount", 1] }, "then": "$key_words", "else": "$$REMOVE" }}}
    //       })
    //     .project({
    //         "name": "$_id.name",
    //         "word": "$_id.word",
    //         "text": "$_id.text",
    //         "clean": "$_id.clean",
    //         "createdAt": "$_id.createdAt",
    //         "updatedAt": "$_id.updatedAt",
    //         "postId": "$_id._id",
    //         "_id": "$taco",
    //         "word_array": "$word_array"
    //       }) 
    //     .sort({ updatedAt: -1 })
    //     .exec()       
    //     .then((data) => {  
    //         res.status(200).send(data) 
    //     })
    //     .catch(error => {
    //         console.log(error) 
    //         res.status(500).send({ "message" : error })  
    //     }) 
});


// update a post 
app.put('/api/posts/:postId', [authenticateJWT, authenticateApiKey], async (req, res) => {   
    console.log("GET /api/posts", req.query) 
    const postId = req.params.postId;  
    const { text } = req.body;  
    const clean = cleanText(text)

    Post.findOneAndUpdate({ _id: postId}, { text: text, clean: clean })
        .then(response => { 
            res.status(200).json({ message: "Resource updated" }) 
        })
        .catch(err => { 
            res.status(500).json({ message: "Error updating" })
        })
  });
 
 
// delete a post 
app.delete('/api/posts/:postId', [authenticateJWT, authenticateApiKey], async (req, res) => {
    const postId = req.params.postId; 

    if (!postId) 
        return res.status(400).send({ error: 'Provide a valid PostId' });

    const objectId = db.mongoose.Types.ObjectId(postId); 
    
    Post.findOneAndDelete({ _id: objectId, name: req.user.name })
        .then((data) => { 
            if (!data) {
                res.status(404).json({ error: "Resource not found" })
            }
            else {
                res.status(200).send({ message : "Successfully deleteed the post" }) 
                console.log("delete data", data)
                Word.aggregate() 
                    .match({ word: data.word })
                    .lookup({"from": "posts", 
                        "localField": "word",
                        "foreignField": "word", 
                        "as": "hasPosts"
                    })
                    .addFields({ "hasPosts": { "$size": "$hasPosts" } })
                    .exec() 
                    .then(data => {
                        console.log("data.word", data[0])
                        if (data && data[0] && data[0].hasPosts == 0) {
                            Word.findByIdAndDelete( data[0]._id )
                                .then(data =>{
                                    console.log("deleted word response", data)
                                })
                                .catch(err => {
                                    console.log(err)
                                })
                        }
                    })
            }
        })
        .catch(error => {
            console.log(error)
            res.status(500).send({ error : "Internal server error" })  
        })  
  });
  

// Insert your user logout code here.
app.get('/api/logout', [authenticateJWT, authenticateApiKey], async (req, res) => {
    req.session.destroy((err) => {
      if (err) console.error(err); 
      else res.status(200).send("logged out")
    });
});


const options = {
    key: fs.readFileSync('/home/kim/cert/localhost/localhost.decrypted.key'),
    cert: fs.readFileSync('/home/kim/cert/localhost/localhost.crt')
};

//const https = require('https')
//https.createServer(options, app).listen(PORT, () => console.log(`Server is running on port https://localhost:${PORT}`));


app.listen(PORT, () => console.log(`Server is running on port http://localhost:${PORT}`));

