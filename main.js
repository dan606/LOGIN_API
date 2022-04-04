const express = require("express");
const bcrypt = require("bcrypt");
const events = require('events');
const { aql } = require("arangojs");
var cors = require('cors');
const cookieParser = require('cookie-parser')
const cookieSession = require('cookie-session')
const arangojs = require('arangojs');

const app = express();
app.use(cors())

// // Add headers before the routes are defined
// app.use(function (req, res, next) {

//   // Website you wish to allow to connect
//   res.setHeader('Access-Control-Allow-Origin', '*');

//   // Request methods you wish to allow
//   res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

//   // Request headers you wish to allow
//   res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

//   // Set to true if you need the website to include cookies in the requests sent
//   // to the API (e.g. in case you use sessions)
//   res.setHeader('Access-Control-Allow-Credentials', true);

//   // Pass to next layer of middleware
//   next();
// });

app.use(express.json());
app.use(cookieParser("dawd41aw6841vd8wa1vd86wa"));
app.listen(3000)

Database = arangojs.Database;

db = new Database('http://127.0.0.1:8529');
db.useBasicAuth("root", "root");

usersCollection = db.collection('users');
loginLogCollection = db.collection('loginlog');


function setLoginCookie(name)
{
  if(isLoginNameUnique(name))
  {
    console.log("create cookie");
  }
}

async function isLoginNameUnique(name)
{
  var res = await db.query(aql`RETURN LENGTH(users[* FILTER CURRENT.name ==${name}])`);
  return res._result[0] <= 1 ? true : false;
}

async function isUserSignedin(name)
{
    const result = await db.query(aql`FOR user IN ${usersCollection} FILTER user.name == ${name} RETURN user.isSignedIn`);
    return result._result[0];
}

app.post('/isUnique', async (req,res)=>
{
  res.send({result: await isLoginNameUnique(req.body.name)});
})

app.get('/set/cookie', (req,res)=>
{
  // read cookies
  console.log(req.cookies) 

  let options = {
      //maxAge: 1000 * 60 * 15, // would expire after 15 minutes
      httpOnly: true, // The cookie only accessible by the web server
      signed: true, // Indicates if the cookie should be signed
      secure: true,
      expires: new Date(253402300000000)
  }
  // Set cookie
  res.cookie('imortal', 'neverExpire2', options) // options is optional
  res.send("COOKIE SET")
})

app.get("/get/cookies", (req, res) =>
{
  console.log('Cookies: ', req.cookies);
  console.log('Signed Cookies: ', req.signedCookies)
})

app.get("/get/loginCookie", (req, res) =>
{
  console.log(req.signedCookies.imortal)
  return req.signedCookies.imortal
});

async function createUser(pname, password)
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
}

app.get("/users", (req,res) => 
{
    usersCollection.all().then(
        doc => res.send(doc._result),
        err => console.error('Failed to fetch all documents:', err)
      );
})

app.post("/register", async (req, res) => 
{
    if(await isLoginNameUnique(req.body.name) == 0)
    {
      console.log("failed to register due to duplicit name: " + req.body.name);
      res.send("failed, login name already exists");
      return;
    }

    if(createUser(req.body.name, req.body.password))
    {
      res.status(201).send()
    }
    else
    {
      res.status(500).send();
    }
})

app.post("/login", async (req, res) => {

    const result = await db.query(aql`FOR user IN ${usersCollection} FILTER user.name == ${req.body.name} RETURN user.password`);
    onLogin(req.body.name, req.body.password, result._result, res)
})

app.post("/logout", async (req, res) => 
{
  result = {}
  if(await isUserSignedin(req.body.name) == true)
  {
    db.query(aql`FOR user IN ${usersCollection} FILTER user.name == 
    ${req.body.name} UPDATE user WITH {isSignedIn:
    false} IN users`).then(
      meta => console.log('Document updated:', meta.extra.stats),
      err => console.error('Failed to update document:', err)
    );
    result = {result: true}
    res.status(200).send("success");
  }
  else
  {
    result = {result: false}
    res.status(200).send("failed");
  }
  result.name = req.body.name;
  onSignout(res, result);
});

async function onLogin(name, password, hashes, res) 
{
    if(await isLoginNameUnique(name) == false)
    {
      res.send("failed, not unique, internal error");
      return;
    }

    if(await isUserSignedin(name))
    {
      res.send("failed, user is already signedin");
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
            setLoginCookie(name)
          }
          await onSignedin(res, result);
          return
      }
      catch
      {
        result = {login: name, result: false};
        await onSignedin(res, result);
      }
    }
    // no hash found
    result = {login: name, result: false};
    await onSignedin(res, result);
 };

 async function onSignedin (res, result) 
 {
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
      //await setLoginCookie();

      loginLogCollection.save(result).then(
        meta => console.log('Document saved:', meta._key),
        err => console.error('Failed to save document:', err)
      );
  }
  else
  {
      resultJs = {};
      resultJs.login = "ERROR";
      resultJs.result = false;
      resultJs.loginDate = Date();
      resultJs.action = "signin";
      res.send("failed");

      loginLogCollection.save(resultJs).then(
      meta => console.log('Document saved:', meta._key),
      err => console.error('Failed to save document:', err)
    );
  }

};

function onSignout(res, result) 
{
  result.loginDate = Date();
  result.action = "signout";
  loginLogCollection.save(result).then(
    meta => console.log('sigout log saved:', meta._key),
    err => console.error('Failed to save sigout log:', err)
  );
}