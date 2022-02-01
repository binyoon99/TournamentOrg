var express = require('express');
var router = express.Router();
var assert = require('assert');
var db = require("../db");
var check = null;
router.get('/register', function(req, res, next) {
  res.render('signup', { title: 'Register' });
});

router.get('/', function(req, res, next) {
  var { username } = req.session;
  res.render('home', { title: 'home' });
});



router.get('/contact', function(req, res, next) {
  res.render('contact', { title: 'contact' });
});



router.get('/login', function(req, res, next) {
  res.render('login', { title: 'login' });
});

router.get('/logout', function(req, res, next) {
  res.render('logout', { title: 'logout' });
});

router.post('/loggingIn', async function(req, res, next) {
  var {user,pw} = req.body;
  if(await db.login(user,pw) == false){
    res.redirect('/login');
  }
  else{
  req.session.username = user;

    res.redirect('/home');

  }
  });

router.post ('/loggingOut', async function(req, res, next){
  req.session.username = '';
  res.redirect('/');
});

router.post ('/terminating', async function(req, res, next){

  await db.terminate(req.session.username );
  req.session.username = '';
  res.redirect('/');
});

router.get('/saveData', function(req, res, next) {
  console.log(req.body);
});

router.post('/create-user', async function(req, res, next){
    var {email,user,pw} = req.body;
    if(await db.register(email,user,pw)==false){
        res.redirect('/register');
    }
    else{
    req.session.username = user;
    res.redirect('/home');
    }
});

function ensureLoggedIn(req, res, next){
    if (!req.session.username){
        res.redirect('/login');
    } else {
        next();
    }
}

router.use(ensureLoggedIn);


router.get('/edit', function(req, res, next) {
  db.getEditPageRender(req.session.username, res);
});

router.post('/edit-tournament', async function(req, res, next){
  var {name,no,desc,rules,tournamentstatus} = req.body;
  await db.editTournament(name,no,desc,rules,tournamentstatus,req.session.username);
  res.redirect('/edit');
});



router.get('/history', function(req, res, next) {
  db.getTournamentHistory(req.session.username, res);
});

router.get('/create', function(req, res, next) {
    res.render('create', { title: 'create' });
});

router.post('/create-tournament', async function(req, res, next){
  var {name,no,desc,rules} = req.body;
  await db.createTournament(name,no,desc,rules,req.session.username);
  res.redirect('/home');
});

router.get('/edit', function(req, res, next) {
  res.render('edit', { title: 'edit' });
});

router.get('/participate', function(req, res, next) {
  db.getParticipatePageRender(req.session.username, res);
});

router.post('/joinTourn', async function(req, res, next){
    var {code} = req.body;
    await db.participate(req.session.username,code);
    res.redirect('/home');
});

router.get('/withdraw', async function(req,res,next){
    await db.withdraw(req.session.username);
    res.redirect('/participate');
});

router.get('/home', function(req, res, next) {
  var { username } = req.session;
  res.render('index', { title: 'home' });
});

router.get('/delete-tournament', async function(req,res,next){
  await db.deleteTournament(req.session.username);
  res.redirect('/create');
});

router.get('/bracket', function(req, res, next) {

    db.getBrackeRender(req.session.username,res);
});



module.exports = router;
