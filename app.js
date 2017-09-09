const express = require('express');
const app = express();
const path = require('path');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const passport = require('passport');
const passportJson = require('passport-json');
const LocalStrategy = require('passport-local').Strategy;
const expressValidator = require('express-validator');
const flash = require('express-flash-messages');
const session = require('express-session');
const mustacheExpress = require('mustache-express');
const models = require("./models/user");
const port = 3000;
const User = models.User


const Snippet = require("./models/snippet");

const DUPLICATE_RECORD_ERROR = 11000;

const mongoURL = 'mongodb://localhost:27017/snippet';
mongoose.connect(mongoURL, {useMongoClient: true});
mongoose.Promise = require('bluebird');

app.use(bodyParser.urlencoded({extended: true}));

app.engine('mustache', mustacheExpress());
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'mustache')
app.set('layout', 'layout');
app.use('/static', express.static('static'));

passport.use(new LocalStrategy(
    function(username, password, done) {
        User.authenticate(username, password, function(err, user) {
            if (err) {
                return done(err)
            }
            if (user) {
                return done(null, user)
            } else {
                return done(null, false, {
                    message: "There is no user with that username and or password."
                })
            }
        })
    }));

passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
        done(err, user);
    });
});

app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(expressValidator());

app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: false,
    store: new(require('express-sessions'))({
        storage: 'mongodb',
    })
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

app.use(function (req, res, next) {
  res.locals.user = req.user;
  next();
})

app.get('/', function(req, res) {
    res.render("index");
})

app.get('/login/', function(req, res) {
    res.render("login", {
        messages: res.locals.getMessages()
    });
});

app.post('/login/', passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login/',
    failureFlash: true
}))

app.get('/register/', function(req, res) {
    res.render('register');
});

app.post('/register/', function(req, res) {
    req.checkBody('username', 'Username must be alphanumeric').isAlphanumeric();
    req.checkBody('username', 'Username is required').notEmpty();
    req.checkBody('password', 'Password is required').notEmpty();

    req.getValidationResult()
        .then(function(result) {
            if (!result.isEmpty()) {
                return res.render("register", {
                    username: req.body.username,
                    errors: result.mapped()
                });
            }
            const user = new User({
                username: req.body.username,
                password: req.body.password
            })

            const error = user.validateSync();
            if (error) {
                return res.render("register", {
                    errors: normalizeMongooseErrors(error.errors)
                })
            }

            user.save(function(err) {
                if (err) {
                    return res.render("register", {
                        messages: {
                            error: ["That username is already taken."]
                        }
                    })
                }
                return res.redirect('/');
            })
        })
});

function normalizeMongooseErrors(errors) {
    Object.keys(errors).forEach(function(key) {
        errors[key].message = errors[key].msg;
        errors[key].param = errors[key].path;
    });
}

app.get('/logout/', function(req, res) {
    req.logout();
    res.redirect('/');
});

const requireLogin = function (req, res, next) {
  if (req.user) {
    next()
  } else {
    res.redirect('/login/');
  }
}

app.get('/new/', function(req, res) {
    res.render('new_snippet');
});

app.post('/new/', function(req, res) {
    Snippet.create(req.body).then(function(snippet) {
        res.redirect('/');
    }).catch(function(error) {
        let errorMsg;
        if (error.code === DUPLICATE_RECORD_ERROR) {
            errorMsg = `The snippet name "${req.body.name}" has already been used.`
        } else {
            errorMsg = "You have encountered an unknown error."
        }
        res.render('new_snippet', {errorMsg: errorMsg});
    })
});

const getSnippet = function(req, res, next) {
    Snippet.findOne({_id: req.params.id}).then(function(snippet) {
        req.snippet = snippet;
        next();
    })
}

app.get('/:id/', getSnippet, function(req, res) {
    const snippet = req.snippet;
    snippet.findSnippetFromSameLanguage().then(function(otherSnippets) {
        res.render("snippet", {
            snippet: snippet,
            snippetsFromSameLanguage: otherSnippets
        });
    })
})

app.get('/:id/edit/', getSnippet, function(req, res) {
    const snippet = req.snippet;
    res.render("edit_snippet", {
        snippet: snippet,
    });
})

app.post("/:id/edit/", getSnippet, function(req, res) {
    const snippet = req.snippet;
    snippet.title = req.body.title;
    snippet.body = req.body.body;
    snippet.optionalNotes = req.body.optionalNotes;
    snippet.language = req.body.language;
    snippet.tags = req.body.tags;


    const error = snippet.validateSync();

    if (!error) {
        snippet.save();
        res.redirect(`/${snippet._id}/`);
    } else {
        res.render("edit_snippet", {
            snippet: snippet,
            errors: error.errors
        });
    }

})

app.get('/:id/new_snippet/', function(req, res) {
    Snippet.findOne({_id: req.params.id}).then(function(snippet) {
        res.render("new_snippet", {snippet: snippet});
    })
})

app.post('/:id/new_snippet/', function(req, res) {
    Snippet.findOne({_id: req.params.id}).then(function(snippet) {
        snippet.ingredients.push(req.body);
        snippet.save().then(function() {
            res.render("new_snippet", {snippet: snippet});
        })
    })
})

app.get('/:id/edit_snippet/', function(req, res) {
    Snippet.findOne({_id: req.params.id}).then(function(snippet) {
        res.render("edit_snippet", {snippet: snippet});
    })
})

app.post('/:id/edit_snippet/', function(req, res) {
    Snippet.findOne({_id: req.params.id}).then(function(snippet) {
        snippet.steps.push(req.body.step);
        snippet.save().then(function() {
            res.render("edit_snippet", {snippet: snippet});
        })
    })
})

app.get('/', function(req, res) {
    Snippet.find().then(function(snippets) {
        res.render('index', {snippets: snippets});
    })
})





app.listen(3000, function() {
    console.log('Express running on localhost 3000.')
});
