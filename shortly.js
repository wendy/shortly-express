var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('cookie-session');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

// app.use(express.cookieParser());
// app.use(express.session({secret:'wendycoin'}));

app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser('cutecat'));
app.use(session({secret: "meow"}));

app.use(express.static(__dirname + '/public'));


app.get('/',
  function(req, res) {
    if (req.session.name) {
      res.render('index');
    } else {
      res.render('login');
    }
  });

app.get('/create',
  function(req, res) {
    if (req.session.name) {
      res.render('index');
    } else {
      res.render('login');
    }
  });

app.get('/links',
  function(req, res) {
    Links.reset().fetch().then(function(links) {
      res.send(200, links.models);
    });
  });

app.post('/links',
  function(req, res) {
    var uri = req.body.url;

    if (!util.isValidUrl(uri)) {
      console.log('Not a valid url: ', uri);
      return res.send(404);
    }

    new Link({ url: uri }).fetch().then(function(found) {
      if (found) {
        res.send(200, found.attributes);
      } else {
        util.getUrlTitle(uri, function(err, title) {
          if (err) {
            console.log('Error reading URL heading: ', err);
            return res.send(404);
          }

          var link = new Link({
            url: uri,
            title: title,
            base_url: req.headers.origin
          });

          link.save().then(function(newLink) {
            Links.add(newLink);
            res.send(200, newLink);
          });
        });
      }
    });
  });

/************************************************************/
// Write your authentication routes here
/************************************************************/

app.get('/logout', function(req,res) {
  req.session = null;
  res.render('login');
});

app.get('/login',
  function(req,res){
    if (req.session.name) {
      res.render('index');
    } else {
      res.render('login');
    }
  });

app.get('/signup',
  function(req,res){
    res.render('signup');
  });

app.post('/signup',
  function(req, res) {

  // TODO: check validity of something?

  new User({username: req.body.username})
  .fetch().then(function(found) {
    if (found) {
      res.send(200, 'user already exists');
    } else {
      util.hashPassword(req.body.password, function(hash){
        var user = new User({
          username: req.body.username,
          password: hash
        });
        user.save().then(function(newUser) {
          Users.add(newUser);
            req.session.name = newUser.username; // set name
            console.log(req.session.name);
            res.render('index');
          });
      });
    }
  });
});

app.post('/login',
  function(req, res) {

  // TODO: check validity of something?
  //

  new User({username: req.body.username})
  .fetch().then(function(found) {
    if (found) {

      util.checkPassword(req.body.password, found.attributes.password, function(isCorrect){

        if (isCorrect) {
          // req.session.user = req.body.username;
          req.session.name = req.body.username;
          console.log(req.session.name);
          res.render('index');
        } else {
          res.redirect(401, 'login');
        }
      });
    } else {
          //reject
          res.redirect(400, 'login');
        }
      });
});

          // if( req.body.password === found.attributes.password ){
          //   res.render('index');
          //   // res.send(200, 'yayy! youre in!');
          // } else {
          //   res.send(200, 'bad password!')
          // }
          // //enter

          /************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
        .where('code', '=', link.get('code'))
        .update({
          visits: link.get('visits') + 1,
        }).then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
