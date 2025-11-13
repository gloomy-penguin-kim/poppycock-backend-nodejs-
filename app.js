const express = require('express');
const jwt = require('jsonwebtoken');
const session = require('express-session'); 
const bcrypt = require('bcrypt');   

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
app.use(session({ secret: 'somevalue' }));

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
    // console.log("authenticateApiKey", req.headers['x-api-key'])
    // const apiKey = req.headers['x-api-key'];

    // if (!apiKey) return res.status(401).json({ error: 'Unauthorized - No API Key' });

    // appApiKey.find({ app_api_key: apiKey })
    //     .then(data => {
    //         if (data.length == 0) {
    //             return res.status(500).json({error: "Unauthorized - Api key not found in database"})
    //         }
    //         next() 
    //     })
    //     .catch(err => {
    //         return res.status(500).json({error: "Unauthorized - Could not verify your api key"})
    //     }) 
    next() 
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
const cleanWord = (text) => {
    return text.replace(/-/g,"_")
            .replace(/'/g,"_")
            .replace(/ /g,"_")
            .replace(/\s+/g, '_')
            .replace(/[^\w\s]/g,'')
            //.replace(/_+/g, '_')
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
    
    if (!username)  
        return res.status(400).json({ error: 'Username is empty' });
  
    if (!text || typeof text !== 'string') 
        return res.status(400).json({ error: 'Please provide valid post content' });

    const clean = cleanText(text)  
    const wordClean = cleanWord(word)
  
    console.log(req.user)
    console.log(text)
    const newPost = Post.create({ name: username, word: wordClean, text: text, clean: clean })
        .then(data => { 
            res.status(200).json({ message: 'Post created successfully', post: data });
        })

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
});

// get a post by its postId 
app.get('/api/posts/:postId', [authenticateApiKey], (req, res) => {
    const postId = req.params.postId;    
    console.log(req.params.postId) 

    const objId = db.mongoose.Types.ObjectId(postId);

    allPostsByWord.aggregate() 
        .match({postId: objId})
        .then(data => { 
            if (data) 
                res.status(200).json(data) 
            else 
                res.status(200).json([]) 
        })
        .catch(err => {
            console.log(err) 
            res.status(500).json({ error: "Error finding post in database" })
        })
 
});

// random words
app.get('/api/random/:num', [authenticateApiKey], async (req, res) => {
    const num = parseInt(req.params.num) || 1;  
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
app.get('/api/users/:name', [authenticateApiKey], async (req, res) => { 
    const name = req.params.name;  
    const tz = parseInt(req.query.tz) || 0;  
    console.log("/api/posts", req.params)
 
    Post.aggregate()
        .match({ name: { $regex: "^"+name+"$", $options: 'i' } })
        .group({ _id: { postId: "$_id", word: "$word" }, updatedAt: { $max: "$updatedAt" } })
        .project({  postId : "$_id.postId", word: "$_id.word", updatedAt: "$updatedAt", "_id": "$taco" })
        .sort({ updatedAt: -1 }) 
        .addFields({
            yyyymmddhms: {
              $dateToString: {
                format: "%Y-%m-%d %H:%M:%S",
                date: { $dateSubtract: {startDate: "$updatedAt", unit: "minute", amount: tz }}
              }
            }, 
            yearMonthDay: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: { $dateSubtract: {startDate: "$updatedAt", unit: "minute", amount: tz }}
                }
              }
        })
        .exec()       
        .then((data) => {  
            console.log(data) 
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
    let tz = parseInt(req.query.tz,10) || 0; 

    if (dt == 'null' || dt == 'undefined') dt = null 
    if (!dt) {
        let data = await Post.aggregate() 
                        //.addFields({yearMonthDay: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } }}
                        .sample(1)
                        .exec()               
        console.log("DATA", data[0].updatedAt)
        console.log("dt", dt)
        dt = dt ||  data[0].updatedAt;  
        console.log("dt", dt)
    }

    dt = new Date(dt).setUTCHours(0,0,0,0)        
    // else { 

    //     function formatDate(dt) {
    //         return dt.toISOString().split['T'][0]
    //     }
        function addMinutes(date, minutes) {
            return new Date(date.getTime() - minutes*60*1000);
        }
    //     dt = new Date(dt)
    //     console.log("date 1", dt)
    //     // dt = addMinutes(dt, tz) 
    //     // console.log("date 2", dt)
    //     console.log("toisostring",dt.toISOString().split('T')[0])
    //     dt = dt.toISOString().split('T')[0] 
    // }
    date = addMinutes(new Date(new Date(dt).setUTCHours(0, 0, 0)), tz) 
    date = date.toISOString()

    date_plus_a_day = addMinutes(new Date(new Date(dt).setUTCHours(0, 0, 0) + 24 * 60 * 60 * 1000), tz) 
    date_plus_a_day = date_plus_a_day.toISOString()
    
 
    console.log("dt", dt)
    Post.aggregate()      
        .addFields({ updatedAtTZ: { $dateSubtract: { startDate: "$updatedAt", unit: "minute", amount: tz, } }})
        .match( {
            $and: [
                { updatedAtTZ: { $gte:  new Date(new Date(dt).setUTCHours(0, 0, 0)) } },
                { updatedAtTZ: { $lt:   new Date(new Date(dt).getTime() + 24 * 60 * 60 * 1000)   } }
           ]}) 
        .group( { _id: { word: "$word", name: "$name" }, maxUpdatedDate: { $max: "$updatedAt"} }) 
        .project({ word: "$_id.word", name: "$_id.name", maxUpdatedDate: "$maxUpdatedDate", _id: "$taco"})
        .addFields({yearMonthDay: { $dateToString: { format: "%Y-%m-%d", date: { $dateSubtract: { startDate: "$maxUpdatedDate", unit: "minute", amount: tz }} } }}).addFields({yearMonthDay: { $dateToString: { format: "%Y-%m-%d", date: { $dateSubtract: { startDate: "$maxUpdatedDate", unit: "minute", amount: tz }} } }})
        .sort( { maxUpdatedDate: -1})
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
app.get('/api/users/info/:name', [authenticateApiKey], async (req, res) => {
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
    const tz = req.query.tz || 0 
    // let dt = new Date(); 
    // let year = dt.getFullYear();
    // let month = String(dt.getMonth() + 1).padStart(2, '0'); // JavaScript months are 0-indexed
    // let day = String(dt.getDate()).padStart(2, '0');
    // const today = year + "-" + month + "-" + day 
    // console.log("today", today)
    
    // let yesterday = new Date(new Date().setDate(new Date().getDate()-1));
    // year = yesterday.getFullYear();
    // month = String(yesterday.getMonth() + 1).padStart(2, '0'); // JavaScript months are 0-indexed
    // day = String(yesterday.getDate()).padStart(2, '0');
    // yesterday = year + "-" + month + "-" + day 
    // console.log("yesterday", yesterday)
    

    // const yesterday2 = new Date();
    // yesterday2.setDate(yesterday.getDate() - 1);
    // const yesterdayISO = yesterday2.toISOString().split('T')[0];
    
    //console.log(yesterdayISO); 

    function subtractMinutes(date, minutes) {
        return new Date(date.getTime() - minutes*60*1000);
    }
  

    let today = new Date();
    today.setDate(today.getDate() - 0);
    today.setUTCHours(0,0,0,0);
    today = subtractMinutes(today, tz)
    console.log("Today: ", today);
    
    let yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setUTCHours(0,0,0,0);
    yesterday = subtractMinutes(yesterday, tz)
    console.log("Yesterday: ", yesterday);
    // console.log(yesterdayISO); 
    // db.post.find({
    //     "createdAt": {
    //       $gte: ISODate("2012-01-12T00:00:00Z"),
    //       $lt: ISODate("2012-01-13T00:00:00Z")
    //     }
    //   })

    let rData = {}

    try {
        rData.yesterday = await Post.aggregate()
                                .match({ updatedAt: { 
                                            $gte: yesterday,
                                            $lt: today
                                        } }) 
                                .group( { _id: { word: "$word" }, maxUpdatedDate: { $max: "$updatedAt"} })
                                .sort( { maxUpdatedDate: -1})
                                .addFields({ word: "$_id.word", _id: "$taco" })
                                // .addFields({yearMonthDay: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } }})
                                // .project({ postId: "$_id", word: "$word", name: "$name", updatedDt: "$updatedAt", yearMonthDay: "$yearMonthDay" })
                                // .group( { _id: { word: "$word" }, maxUpdatedDate: { $max: "$updatedDt"} })
                                // .sort( { maxUpdatedDate: -1})
                                // .addFields({ word: "$_id.word", _id: "$taco" })
                                .exec();
        rData.today = await Post.aggregate()
                                .match({ updatedAt: { 
                                            $gte: today 
                                        } })
                                .group( { _id: { word: "$word" }, maxUpdatedDate: { $max: "$updatedAt"} })
                                .sort( { maxUpdatedDate: -1})
                                .addFields({ word: "$_id.word", _id: "$taco" })
                                //         .addFields({yearMonthDay: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } }})
                                // .project({ postId: "$_id", word: "$word", name: "$name", updatedDt: "$updatedAt", yearMonthDay: "$yearMonthDay" })
                                // .sort( { maxUpdatedDate: -1})
                                .exec();
        res.status(200).json(rData);
    }
    catch (err) {
        console.log(err); 
        res.status(500).json({error: "Internal server error"})
    }
});


// random word
app.get('/api/word', [authenticateApiKey], async (req, res) => {  
    Word.aggregate() 
        .sample(1)
        .exec()       
        .then((data) => {  
            console.log(data) 
            //res.redirect('/api/word/'+data[0].word)  

            allPostsByWord.find({word: { $regex: "^"+data[0].word+"$", $options: 'i' } })
            .then(data => {
                res.status(200).json(data) 
            })
            .catch(err => {
                console.log(err)
                res.status(500).json({ message: "Cannot find the posts" })
            })

        })
        .catch(error => {
            console.log(error) 
            res.status(500).send(error)  
        }) 
});

// random word
app.get('/api/word/random', [authenticateApiKey], async (req, res) => {  
    Word.aggregate() 
        .sample(1)
        .exec()       
        .then((data) => {  
            console.log(data)   

        })
        .catch(error => {
            console.log(error) 
            res.status(500).send(error)  
        }) 
});


// list all posts for this word
app.get('/api/word/:word', [authenticateApiKey], async (req, res) => {
    console.log("here", req.query.tz)
    const word = req.params.word; 
    const tz = parseInt(req.query.tz); 
    const clean = cleanWord(word) 
    
    allPostsByWord.aggregate()
        .match({word: { $regex: "^"+clean+"$", $options: 'i' } })
        .addFields({
            yyyymmddhms: {
              $dateToString: {
                format: "%Y-%m-%d %H:%M:%S",
                date: { $dateSubtract: {startDate: "$updatedAt", unit: "minute", amount: tz }}
              }
            }, 
            yearMonthDay: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: { $dateSubtract: {startDate: "$updatedAt", unit: "minute", amount: tz }}
                }
              }
        })
        .exec() 
        .then(data => {
            res.status(200).json(data) 
        })
        .catch(err => {
            console.log(err)
            res.status(500).json({ message: "Cannot find the posts" })
        }) 
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

