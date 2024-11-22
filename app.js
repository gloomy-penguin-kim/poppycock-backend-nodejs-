const express = require('express');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcrypt'); 
const { timeStamp } = require('console');
const axios = require('axios').default;

const cors = require('cors'); 

require('dotenv').config();

const db = require('./database')

const app = express(); 

const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY;
 
const User = db.mongoose.model('User', {  
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true, unique: true }, 
});
const Post = db.mongoose.model('Post', {  
    userId: {type: db.mongoose.Schema.Types.ObjectId, required: true}, 
    text: { type: String, required: true, unique: true },
    time : { type : Date, default: Date.now }
}); 
const UserPostInfo = db.mongoose.model('user_post_info', {  
    userId: db.mongoose.Schema.Types.ObjectId, 
    username: String, 
    email: String,
    text: { type: String, required: true, unique: true },
    time : { type : Date, default: Date.now }
}); 



app.use(cors()); 
app.use(express.json());
app.use(express.urlencoded({ extended: true })); 
app.use(session({ secret: SECRET_KEY, resave: false, saveUninitialized: true, cookie: { secure: false } }));

 
 
// Insert your authenticateJWT Function code here.
function authenticateJWT(req, res, next) {
    let token = req.session.token;  

    if (!token) { 
        let foundIt = ""
        req.rawHeaders.forEach((header) => {
            if (header.includes("Bearer")) {
                foundIt = header  
            }
        })  
        token = foundIt.split(" ")[1]
    }
 
    if (!token) return res.status(401).json({ message: 'Unauthorized - No token' });
   
    try {
      const decoded = jwt.verify(token, SECRET_KEY);
      req.user = decoded; 
      req.session.token = token 
      next()
    } catch (error) {
      return res.status(401).json({ message: 'Invalid token' });
    }
  }


// Insert your requireAuth Function code here.
function requireAuth(req, res, next) {
    const token = req.session.token;
    const kim = req.query.kim;  
  
    if (!token) return res.redirect('/login');
  
    try {
      const decoded = jwt.verify(token, SECRET_KEY);
      req.user = decoded;
      next();
    } catch (error) {
      return res.redirect('/login');
    }
}

  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} ${req.statusCode}`); 
    next();
  });

// Insert your routing HTML code here.
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'index.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'views', 'register.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'views', 'login.html')));
app.get('/logout', (req, res) => res.sendFile(path.join(__dirname, 'views', 'login.html')));

app.post('/posts', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', 'posts.html')));
app.get('/posts/all', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', 'allposts.html')));
app.put('/posts', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', 'posts.html')));
app.delete('/posts', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', 'posts.html'))); 

app.get('/index', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', 'index.html'), { username: req.user.username }));

const saltRounds = 5 

// Insert your user registration code here.
app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body; 

    if (!username || !email || !password)
        return res.status(400).send({ message: 'One or more of the fields are empty' });

    const existingUser = await User.findOne({ "username": username }); 
    if (existingUser) return res.status(400).send({ message: 'Username already exists' });
    
    const existingUserEmail = await User.findOne({ "email" : email }); 
    if (existingUserEmail) return res.status(400).send({ message: 'Email already exists' });
  
    try { 
        bcrypt.genSalt(saltRounds, (err, salt) => { 
            if (err) throw Error(err) 
            bcrypt.hash(password, salt, (err, hash) => {
                if (err) throw Error(err) 
                const newUser = new User({ "username": username, "email": email, "password": hash }); 
                newUser.save()
                    .then(() => { 
                        console.log("newUser", newUser)
                        const userObj = { 
                            userId: newUser._id, 
                            username: newUser.username,
                            email: newUser.email 
                        }
                        const token = jwt.sign(userObj, SECRET_KEY, { expiresIn: '4h' });
                        req.session.token = token; 
                        res.status(200).send({"message":`The user ${newUser.username} has been created`,
                                             "user": userObj, 
                                             token: token 
                                            });
                    }) 
            }); 
        });
   
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });


// Insert your user login code here.
app.post('/api/login', async (req, res) => {
    console.log("/api/login req.body", res.body)
    const { username, password } = req.body.data;
    console.log("LOGIN PAGE", req.body)

    if (!username) 
        return res.status(401).json({ message: 'Username is empty' }); 

    if (!password) 
        return res.status(401).json({ message: 'Password is empty' }); 
  
    console.log("LOGIN PAGE", req.body)
    try {
        User.findOne({ username: username })
            .then(user => {
                if (user) {   
                    bcrypt.compare(password, user.password, (err, result) => { 
                        if (result) {   
                            const userObj = { 
                                userId: user._id, 
                                username: user.username,
                                email: user.email 
                            }
                            
                            const token = jwt.sign(userObj, SECRET_KEY, { expiresIn: '4h' });
                            req.session.token = token 
                            req.session.cookie.token = token 
                        
                            res.cookie.username = user.username
                            res.cookie.userId = user.id || user._id 

                            res.status(200).send( { "message":`${user.username} has logged in`, 
                                                     "user": userObj, 
                                                     token: token 
                                                    });
                        } else {
                            return res.status(401).json({ message: 'Invalid credentials' }); 
                        } 
                    });
                }
                else {
                    res.status(500).json({ message: 'User not found' });
                }
            })
            .catch(error => {  
                res.status(500).json({ message: error });
            })
   
    } catch (error) { 
      res.status(500).json({ message: error });
    }
  });



// Insert your post creation code here.
app.post('/api/posts', authenticateJWT, (req, res) => {
    const { text, userId } = req.body;
    console.log("text", req.body)
  
    if (!text || typeof text !== 'string') 
        return res.status(400).json({ message: 'Please provide valid post content' });

    if (!userId || userId == "")
        return res.status(400).json({ message: 'Please provide a UserId' });
     
    const newPost = new Post({ userId: userId, text: text });
    newPost.save()
        .then(() => { 
            res.status(200).send({ message: 'Post created successfully' });
        })
        .catch(() => {
            res.status(500).send({ message: "Error creating post" })
        }) 
  });



// Insert your findbyid code here.
app.get('/api/posts/:postId', authenticateJWT, (req, res) => {
    const postId = req.params.postId; 
    const objectId = db.mongoose.Types.ObjectId(postId);  
 
    Post.aggregate()
        .match({ _id: objectId })
        .lookup({ from: "users", localField: "userId", foreignField: "_id", as: "result" })
        .unwind("$result")
        .addFields({ "username": "$result.username", "email": "$result.email", "postId": "$_id", "result": "" }) 
        .exec()       
        .then((data) => { 
            console.log("one post data", data[0])
            res.status(200).send({ message: "found the data!", data: data[0]}) 
        })
        .catch(error => {
            console.log(error) 
            res.status(500).send({ "message" : error })  
        }) 
});

// get a list of posts.
app.get('/api/posts', authenticateJWT, async (req, res) => {   
    console.log("GET /api/posts", req.query) 
    const page = parseInt(req.query.page) | 1
    const limit = parseInt(req.query.limit) | 200 

    try {
        let data = [] 
        if (page && limit) {
            data = await Post.aggregate()
                    .lookup({ from: "users", localField: "userId", foreignField: "_id", as: "result" })
                    .unwind("$result")
                    .addFields({ "username": "$result.username", "email": "$result.email", "postId": "$_id", "result": "" }) 
                    .sort({ time: -1 })
                    .skip((page - 1) * limit)
                    .limit(limit) 
                    .exec() 

            const count = await Post.countDocuments(); 

            res.json({
                data,
                currentPage: page,
                totalPages: Math.ceil(count / limit)
                });
        }
        else {
            data = await Post.aggregate()
                    .lookup({ from: "users", localField: "userId", foreignField: "_id", as: "result" })
                    .unwind("$result")
                    .addFields({ "username": "$result.username", "email": "$result.email", "postId": "$_id", "result": "" }) 
                    .sort({ time: -1 }) 
                    .limit(200) 
                    .exec()               

            res.json(data);              
        }


    } 
    catch(error) {  
        console.log(error)
        res.sendStatus(400).end({ message: error });
    }
  });


// Update your post updation code here. authenticateJWT
app.put('/api/posts', authenticateJWT, (req, res) => {
    const { postId, text } = req.body;
    console.log("req.body", req.body)
    
    if (!text || typeof text !== 'string') 
        return res.status(400).send({ message: 'Please provide valid post content' });
     
    Post.findByIdAndUpdate(postId, { "text" : text }) 
        .then(() => { 
            res.status(200).send({ message: 'Post updated successfully' });
        })
        .catch(() => {
            res.status(500).send({ message: "Error updating post" })
        }) 
 
});


// Insert your  deletion code here.
app.delete('/api/posts/:postId', authenticateJWT, (req, res) => {
    const postId = req.params.postId; 

    if (!postId) 
        return res.status(400).send({ message: 'Please provide valid post content' });

    const objectId = db.mongoose.Types.ObjectId(postId); 
   
    console.log("trying to delete... /api/posts/:postId, postId")
    Post.findByIdAndDelete({ _id: objectId })
        .then((data) => { 
            res.status(200).send({ "message" : "Successfully deleteed the post" })  
        })
        .catch(error => {
            res.status(500).send({ "message" : error })  
        })  
  });

// Insert your  deletion code here.
app.get('/api/posts/delete/:postId', authenticateJWT,  (req, res) => {
    const postId = req.params.postId; 
    const objectId = db.mongoose.Types.ObjectId(postId); 
    console.log("trying to delete... /api/posts/:postId", req.params)

    Post.findByIdAndDelete({ _id: objectId })
        .then((data) => { 
            res.status(200).send({ "message" : "Successfully deleteed the post" }) 
        })
        .catch(error => {
            console.log(error) 
            res.status(500).send({ "message" : error })  
        }) 
});


// Insert your user logout code here.
app.get('/api/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) console.error(err);
      res.redirect('/login');
    });
  });


app.listen(PORT, () => console.log(`Server is running on port http://localhost:${PORT}`));
