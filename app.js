const express = require('express');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt'); 
const { timeStamp } = require('console');
const axios = require('axios').default;


require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY;

mongoose.set('strictQuery', true);
 
// Connect to MongoDB   
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}`;
const clientOptions = { dbName: 'socialDb', serverApi: { version: '1', strict: true, deprecationErrors: true } };  
mongoose.set('debug', true);
mongoose.connect(uri, clientOptions)
  .then(() => console.log('Connected to database:', mongoose.connection.name) );

const User = mongoose.model('User', { 
    _id: mongoose.Schema.Types.ObjectId, 
    username: String, 
    email: String, 
    password: String 
});
const Post = mongoose.model('Post', { 
    id: mongoose.Schema.Types.ObjectId, 
    userId: mongoose.Schema.Types.ObjectId, 
    text: String,
    time : { type : Date, default: Date.now }
});
const UserPostView = mongoose.model('user_post_info', { 
    postId: mongoose.Schema.Types.ObjectId, 
    userId: mongoose.Schema.Types.ObjectId, 
    username: String, 
    email: String, 
    text: String,
    time : { type : Date, default: Date.now }
});



app.use(express.json());
app.use(express.urlencoded({ extended: true })); 
app.use(session({ secret: SECRET_KEY, resave: false, saveUninitialized: true, cookie: { secure: false } }));

 
 
// Insert your authenticateJWT Function code here.
function authenticateJWT(req, res, next) {
    const token = req.session.token;
  
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
  
    try {
      const decoded = jwt.verify(token, SECRET_KEY);
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ message: 'Invalid token' });
    }
  }


// Insert your requireAuth Function code here.
function requireAuth(req, res, next) {
    const token = req.session.token;
  
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
app.get('/posts', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', 'posts.html')));
app.get('/posts/all', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', 'allposts.html')));
app.put('/posts/:id', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', 'posts.html')));
app.get('/index', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', 'index.html'), { username: req.user.username }));

const saltRounds = 5 

// Insert your user registration code here.
app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;

    console.log("/api/register req.body", req.body)

    const existingUser = await User.findOne({ username }); 
    if (existingUser) return res.status(400).send({ message: 'Username already exists' });
    
    const existingUserEmail = await User.findOne({ email }); 
    if (existingUserEmail) return res.status(400).send({ message: 'Email already exists' });
  
    try { 
        bcrypt.genSalt(saltRounds, (err, salt) => { 
            bcrypt.hash(password, salt, (err, hash) => {
                
                console.log("hash", hash )
                const newUser = new User({ "username": username, "email": email, "password": hash }); 
                newUser.save()
                    .then(() => { 
                        const token = jwt.sign({ userId: newUser._id, username: newUser.username }, SECRET_KEY, { expiresIn: '1h' });
                        req.session.token = token; 
                        res.status(200).send({"message":`The user ${username}has been added`});
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
    const { username, password } = req.body;
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
                    console.log("user", user)
                    bcrypt.compare(password, user.password, (err, result) => { 
                        if (result) {  
                            const token = jwt.sign({ userId: user._id, username: user.username }, SECRET_KEY, { expiresIn: '1h' });
                            req.session.token = token;  

                            res.cookie.username = user.username
                            res.cookie.userId = user.id || user._id 

                            res.status(200).send( { "message":`${user.username} has logged in`, 
                                                     userId: user.id, 
                                                     username: user.username 
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
    const { text } = req.body;
  
    if (!text || typeof text !== 'string') return res.status(400).json({ message: 'Please provide valid post content' });
     
    const newPost = new Post({ userId: req.user.userId, text });
    newPost.save()
        .then(() => { 
            res.status(200).send({ message: 'Post created successfully' });
        })
        .catch(() => {
            res.status(500).send({ message: "Error creating post" })
        })
 
  });

// get a list of posts.
app.get('/api/posts', authenticateJWT, (req, res) => {     
 
    Post.aggregate()
        .lookup({ from: "users", localField: "userId", foreignField: "_id", as: "result" })
        .unwind("$result")
        .addFields({ "username": "$result.username", "email": "$result.email" })
        .sort({time: -1})
        .limit(100)
        .then((data) => { 
            console.log("get /api/posts", data)
            res.send(data);
        })
        .catch((error) => {  
            res.sendStatus(400).end({ message: error });
        }) 
   
  });


// Insert your post updation code here.
app.put('/api/posts/:postId', authenticateJWT, (req, res) => {
    const postId = parseInt(req.params.postId);
    Post.findByIdAndUpdate(postId, {})
  
    res.json({ message: 'Post updated successfully', updatedPost: posts[postIndex] });
});


// Insert your  deletion code here.
app.delete('/api/posts/:postId', authenticateJWT, (req, res) => {
    const postId = parseInt(req.params.postId);
  
    const postIndex = posts.findIndex((post) => post.id === postId && post.userId === req.user.userId);
  
    if (postIndex === -1) return res.status(404).json({ message: 'Post not found' });
  
    const deletedPost = posts.splice(postIndex, 1)[0];
  
    res.json({ message: 'Post deleted successfully', deletedPost });
  });


// Insert your user logout code here.
app.get('/api/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) console.error(err);
      res.redirect('/login');
    });
  });


app.listen(PORT, () => console.log(`Server is running on port http://localhost:${PORT}`));
