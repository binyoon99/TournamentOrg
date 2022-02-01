var mongodb = require('mongodb');
var MongoClient = mongodb.MongoClient;
var url = 'mongodb+srv://dbUser:ivNu3Yf1X8zK2KQ1@cluster0.x4vsz.mongodb.net/cps731?retryWrites=true&w=majority';
var db = null;
var client = null;
var bcrypt = require("bcrypt");
var ObjectId = mongodb.ObjectID;
var assert = require('assert');
const { getSystemErrorMap } = require('util');





async function connect(){
    if (db == null){
         var options = {
            useUnifiedTopology: true,
         };
         client = await MongoClient.connect(url, options);
         db = await client.db("cps731");
    }

    return db;
}

async function register(email,username, password){
try{
    var conn = await connect();

    var existingUser = await conn.collection('users').findOne({username});
    var existingEmail = await conn.collection('users').findOne({email});

    var passwordValidator = require('password-validator');
    var schema = new passwordValidator();
    schema
    .is().min(8) 
    .has().uppercase()
    .has().lowercase()
    .has().digits()
    .has().symbols();

    if (existingUser != null){
        throw new Error('Username already exists');
    }
    else if(existingEmail != null){
        throw new Error('Email already Used');
    }
    else if(!schema.validate(password)){
        throw new Error('Password does not meet security requirements');
    }
    var SALT_ROUNDS = 6;
    var passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    conn.collection('users').insertOne({email,username, passwordHash});
    return true;
    }
    catch(err){
       console.error(err.message);
       return false;
    }
}

async function login(username, password){
    try{
        var conn = await connect();
        var existingUser = await conn.collection('users').findOne({username});
        if (existingUser == null){
            throw new Error('Username does not exists');
        }
        var valid = await bcrypt.compare(password, existingUser.passwordHash);

        if (valid != true){
            throw new Error('Invalid Password');
        }
        else{
            return true;
        }
    }
    catch(err){
        console.error(err.message);
        return false;
    }
}

async function terminate(username){
    var conn = await connect();
    var existingUser = await conn.collection('users').deleteOne({username});
    if (existingUser == null){
       throw new Error('Username does not exists');
    }
    
   
}

async function createTournament(name, no_participants, description, rules, username){
    var conn = await connect();
    var existingUser = await conn.collection('users').findOne({username});
    var count = await conn.collection('tournaments').count();
    try{
    if (existingUser == null){
        throw new Error('Not logged in');
    }
    else if(count>9){
        throw new Error('tournament limit reached');
    }
    else if(no_participants < 4 || no_participants >64){
        throw new Error('invalid participant size');
    }
    else {
        conn.collection('tournaments').insertOne({name, no_participants, description, rules, host:username}).then(result => {
            var query = {username: username};
            var newValues = {$set: {tournament: result.insertedId}}
            conn.collection('users').updateOne(query, newValues, function (err) {
                if (err) {
                    throw err;
                }
                console.log("1 user updated");
                //db.close();
            });
        });
    }
    }
    catch(err){
        console.error(err.message);
    }
}

async function participate(username, tournamentId){
    var conn = await connect();
    try{
    var existingUser = await conn.collection('users').findOne({username});
    if (existingUser.tournament != null){
       throw new Error('Already a part of another Tournament');
    }
    else{
         console.log(tournamentId);
         var curTournament = await conn.collection('tournaments').findOne({_id: ObjectId(tournamentId)});
         if (curTournament != null) {
            var participantCount = await conn.collection('users').find({tournament: tournamentId}).count();
            console.log("Number of participants plus host: " + participantCount+1);
            console.log("Max number of participants allowed: " + parseInt(curTournament.no_participants));
            if (parseInt(curTournament.no_participants) > participantCount+1) {
                var newValues = {$set: {tournament: tournamentId}}
                conn.collection('users').updateOne({"username" : username}, newValues, function (err, num) {
                    if (err) throw err;
                        console.log("1 user updated");
                        //db.close();
                });
                conn.collection('history').insertOne({username: username, tournament: ObjectId(tournamentId), tournament_name: curTournament.name, no_participants: curTournament.no_participants, description: curTournament.description, host: curTournament.host, status: curTournament.status});
            }
            else {
                console.log("tournament is full");
            }
        }
        else {
            console.log("tournament does not exist");
        }
    }
    } catch(err){
        console.error(err.message);
    }

}

async function editTournament(name, no_participants, description, rules, tournamentstatus, username){
    var conn = await connect();
    var existingUser = await conn.collection('users').findOne({username});
    if (existingUser == null){
        throw new Error('Not logged in');
    }
    else {
        var mongo = require('mongodb');
        var tournamentId = new mongo.ObjectID(existingUser.tournament);
        var existingTournament = await conn.collection('tournaments').findOne({_id: tournamentId});
        if (existingTournament != null) {
            console.log("found tournament");
            var tournamentHost = existingTournament.host;
            var newValues = {$set: {name: name, no_participants: no_participants, description: description, rules: rules, status: tournamentstatus}}
            if (tournamentHost == username) {   
                conn.collection('tournaments').updateOne(existingTournament, newValues, function (err) {
                    if (err) {
                        throw err; 
                    }
                    console.log("1 tournament updated");
                    //db.close();
                });
            }
            else {
                console.log("this user is not the host");
            }
        }
        else {
            console.log("no tournament found");
        }

        var existingHistory = await conn.collection('history').find({tournament: tournamentId});

        if (existingHistory) {
            console.log("found tournament in history");    
            var updateHistory = {$set: {tournament_name: name, no_participants: no_participants, description: description, status: tournamentstatus}}
            existingHistory.forEach(function(doc, err) {               
                assert.equal(null, err);
                conn.collection('history').updateOne(doc, updateHistory, function (err) {
                    if (err) {
                        throw err; 
                    }
                    console.log("1 history log updated");
                    //db.close();
                });
            })
        }
        else {
            console.log("no tournament history found");
        }
    }
}

async function getTournamentHistory(username, res){
    var conn = await connect();
    var existingUser = await conn.collection('users').findOne({username});
    if (existingUser == null){
        throw new Error('Not logged in');
    }
    else {
        var historyArray = [];

        var cursor = await conn.collection('history').find({username: username});
        if (cursor) {
            console.log("found tournament history");
            cursor.forEach(function(doc, err) {
                assert.equal(null, err);
                historyArray.push(doc);
            }, function() {
                console.log(historyArray);
                //db.close;
                res.render('history', {title: 'history', items: historyArray});
            })
        }
        else {
            console.log("no tournament history found");
        }
    }
}

async function withdraw(username){
     var conn = await connect();
        var existingUser = await conn.collection('users').findOne({username});
        if (existingUser.tournament == null){
            console.log("Not participating in tournament");
        }
        else{
            var mongo = require('mongodb');
            var tournamentId = new mongo.ObjectID(existingUser.tournament);
            var existingTournament = await conn.collection('tournaments').findOne({_id: tournamentId});
            var newValues = {$set: {tournament:undefined}};
            if (existingTournament != null) {
                console.log("found tournament");
                var tournamentHost = existingTournament.host;
                if (tournamentHost != username) {
                    conn.collection('users').updateOne({"username" : username}, newValues, function (err, num) {
                        if (err) throw err;
                            console.log("1 user updated");
                            //db.close();
                        });
                }
                else {
                    console.log("cannot withdraw from tournament as a host");
                }
            }
            else {
                console.log("cannot find tournament");
                conn.collection('users').updateOne({"username" : username}, newValues, function (err, num) {
                    if (err) throw err;
                        console.log("1 user updated");
                        //db.close();
                    });
            }
    }
}

async function deleteTournament(username){
    var conn = await connect();
    var existingUser = await conn.collection('users').findOne({username});
    if (existingUser == null){
        throw new Error('Not logged in');
    }
    else {
        var mongo = require('mongodb');
        var tournamentId = new mongo.ObjectID(existingUser.tournament);
        var existingTournament = await conn.collection('tournaments').findOne({_id: tournamentId});
        if (existingTournament != null) {
            console.log("found tournament");
            var tournamentHost = existingTournament.host;
            if (tournamentHost == username) {
                var newValues = {$set: {tournament:undefined}};

                conn.collection('tournaments').deleteOne(existingTournament, function (err) {
                    if (err) {
                        throw err;
                    }
                    console.log("1 tournament deleted");
                    //db.close();
                });

                conn.collection('users').updateOne({"username" : username}, newValues, function (err, num) {
                    if (err) throw err;
                        console.log("1 user updated");
                        //db.close();
                    });
            }
            else {
                console.log("this user is not the host");
            }
        }
        else {
            console.log("no tournament found");
        }
    }
}


async function getEditPageRender(username, res){
    var conn = await connect();
    var existingUser = await conn.collection('users').findOne({username});
    if (existingUser == null){
        throw new Error('Not logged in');
    }

    else {
        var mongo = require('mongodb');
        var tournamentId = new mongo.ObjectID(existingUser.tournament);
        var existingTournament = await conn.collection('tournaments').findOne({_id: tournamentId});

        if (existingTournament != null) {
            console.log(existingUser.tournament);
            res.render('edit', {title: 'edit', tourneyID: existingUser.tournament});
        }
        else {
            console.log("no tournament found");
            res.redirect('/home');
        }
    }
}

async function getBrackeRender(username, res){
    var conn = await connect();
    var existingUser = await conn.collection('users').findOne({username});
    if (existingUser == null){
        throw new Error('Not logged in');
    }

    else {
        var mongo = require('mongodb');
        var tournamentId = new mongo.ObjectID(existingUser.tournament);
        var existingTournament = await conn.collection('tournaments').findOne({_id: tournamentId});

        if (existingTournament != null) {
            console.log(existingUser.tournament);
            res.render('bracket', { title: 'bracket' });
        }
        else {
            console.log("no tournament found");
            res.redirect('/participate');
        }
    }
}

async function getParticipatePageRender(username, res){
    var conn = await connect();
    var existingUser = await conn.collection('users').findOne({username});
    if (existingUser == null){
        throw new Error('Not logged in');
    }
    else {
        var mongo = require('mongodb');
        var tournamentId = new mongo.ObjectID(existingUser.tournament);
        var existingTournament = await conn.collection('tournaments').findOne({_id: tournamentId});

        if (existingTournament != null) {
            console.log(existingUser.tournament);
            res.render('participate', {title: 'participate', tourneyID: existingUser.tournament, host: existingTournament.host});
        }
        else {
            console.log("no tournament found");
            res.render('participate', {title: 'participate'});

        }
    }
}

module.exports = {
    login,
    terminate,
    register,
    createTournament,
    editTournament,
    getTournamentHistory,
    participate,
    withdraw,
    deleteTournament,
    getEditPageRender,
    getParticipatePageRender,
    getBrackeRender,
    url,
}
