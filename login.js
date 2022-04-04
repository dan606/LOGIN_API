const express = require("express");
const app = express();
const bcrypt = require("bcrypt");
const { all } = require("express/lib/application");
const events = require('events');
const { join } = require("path");
const { aql } = require("arangojs");
const res = require("express/lib/response");
var cors = require('cors');

cookieParser = require('cookie-parser')
cookieSession = require('cookie-session')

arangojs = require('arangojs');

Database = arangojs.Database;

app.use(express.json());
const emitter = new events.EventEmitter();
const emitter2 = new events.EventEmitter();
 	
app.use(cors())

app.listen(3000)

db = new Database('http://127.0.0.1:8529');
db.useBasicAuth("root", "root");

usersCollection = db.collection('users');
loginLogCollection = db.collection('loginlog');


app.use(cookieParser("dawd41aw6841vd8wa1vd86wa"));

module.exports = {

    getLoginCookie: function(req)
    {
        console.log(req.signedCookies.imortal)
        return req.signedCookies.imortal
    },

    isLoginNameUnique: async function(name)
    {
        var res = await db.query(aql`RETURN LENGTH(users[* FILTER CURRENT.name ==${name}])`);
        return res._result[0] > 0 ? 0:1;
    },

    createUser: async function (pname, password)
    {
        try
        {
            hashedPassword = await bcrypt.hash(password, 10); 
            //const user = { name: name, password: password}
            //users.push(user)
            userDoc = {
                //_key: 'firstDocument',
                name: pname,
                password: hashedPassword,
                Create: Date(),
                isSignedIn:false
                };
                usersCollection.save(userDoc).then(
                meta => console.log('Document saved:', meta._key),
                err => console.error('Failed to save document:', err)
                );
                return true;

        } catch {
            return false;
        }
    },

    register: app.post("/register", async (req, res) => 
    {
        if(await isLoginNameUnique(req.body.name) == 0)
        {
        console.log("failed to register due to duplicit name: " + req.body.name);
        res.send("failed");
        return;
        }

        if(createUser(req.body.name, req.body.password))
        {
        res.status(201).send("success")
        }
        else
        {
        res.status(500).send("failed");
        }
    }),

    login: app.post("/login", async (req, res) => {

        const result = await db.query(aql`FOR user IN ${usersCollection} FILTER user.name == ${req.body.name} RETURN user.password`).then(
          meta => console.log('Document updated:', meta.extra.stats),
          err => console.error('Failed to update document:', err)
        );;
        emitter.emit('login',  req.body.name, req.body.password, result._result, res);
        //onLogin(req.body.name, req.body.password, result._result, res);
    }),

logout: app.post("/logout", async (req, res) => {

  console.log("LOGOUT \n");
  db.query(aql`FOR user IN ${usersCollection} FILTER user.name == 
  ${req.body.name} UPDATE user WITH {isSignedIn: false} IN users`).then(
    meta => console.log('Document updated:', meta.extra.stats),
    err => console.error('Failed to update document:', err)
  );
  
  result = {name: req.body.name}
  emitter2.emit('signout', res, result);

}),

onLogin: async function (name, password, hashes, res) 
{
    if(isLoginNameUnique(name) == false)
    {
      console.log("NOT UINIQUE");
      res.send("failed");
      return;
    }
    console.log('Login event for password: ' + password + " found hashes: " + hashes);

    var result = false;
    for(const passhash of hashes)
    {
      try
      {
          if(await bcrypt.compare(password, passhash))
          {
            console.log(passhash);
            result = {login: name, result: true};
          }
          emitter2.emit('signedin', res, result);
          return
      }
      catch
      {
        result = {login: name, result: false};
        emitter2.emit('signedin', res, result);
      }
    }
    // no hash found
    result = {login: name, result: false};
    emitter2.emit('signedin', res, result);
 },

 signedin: emitter2.on('signedin', function (res, result) {

  result.loginDate = Date();
  result.action = "signin";
  if(result.result)
  {
      res.send("success")
      db.query(aql`FOR user IN ${usersCollection} FILTER user.name == 
      ${result.login} UPDATE user WITH {isSignedIn:
      ${result.result}} IN users`).then(
        meta => console.log('Document updated:', meta.extra.stats),
        err => console.error('Failed to update document:', err)
      );
      setLoginCookie();
  }
  else
  {
      res.send("failed")
  }
  loginLogCollection.save(result).then(
    meta => console.log('Document saved:', meta._key),
    err => console.error('Failed to save document:', err)
  );
}),

signedout: emitter2.on('signout', function (res, result) {

  result.loginDate = Date();
  result.action = "signout";
  loginLogCollection.save(result).then(
    meta => console.log('Document saved:', meta._key),
    err => console.error('Failed to save document:', err)
  );
})

};
