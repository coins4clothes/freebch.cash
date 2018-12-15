let express = require('express');
let path = require('path');
let favicon = require('serve-favicon');
let cookieParser = require('cookie-parser');
let bodyParser = require('body-parser');
let logger = require('morgan');
let fs = require('fs');
let {promisify} = require('util');
fs.readFile = promisify(fs.readFile);

let app = express();
let server = require('http').Server(app);
let io = require('socket.io')(server);
let router = express.Router();

let BITBOXSDK = require('bitbox-sdk/lib/bitbox-sdk').default;
let BITBOX = new BITBOXSDK();

let delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(function(req, res, next){
  res.io = io;
  next();
});

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Serve the homepage

router.get('/', async function(req, res, next) {
  console.log('serving ', __dirname + '/index.html');

  let file;
  try {
    file = await fs.readFile(__dirname + '/index.html');
  }
  catch(nope) {
    console.log('Cannot load page from disk');
    throw nope;
  }

  res.set('Content-Type', 'text/html');
  return res.send(new Buffer(file));

});

router.get('/subscribe', async function(req, res, next) {
  console.log('subscribing:', req);
  return res.status(200).json({ success: true });
  // res.io.emit('socketToMe', 'users');
});


router.post('/sms', async function(req, res, next) {
  // Make them wait 2 seconds * the number of requests this ip has made 
  let paymentAddress = req.param('address');
  let smsCodeToSend = Math.floor(Math.random()*89999+10000);
  console.log('Giving user SMS Code',smsCodeToSend,'for address', paymentAddress);

  let sendFakeVerify = function() {
    io.emit('smsverified', { address: paymentAddress });
  };

  setTimeout(sendFakeVerify, 10000);

  return res.status(200).json({ code: smsCodeToSend });
});

router.post('/validate/sms', async function(req, res, next) {
  let codeToValidate = req.param('sms');
  console.log('User is validating SMS Code:', codeToValidate);

  await delay(3000);

  // read the json values from disk
  // If one matches the sms code provided by the user, send coins to the address
  // if not, provide an error message

  return res.status(200).json({ success: true });
});


router.get('/validate/address', async function(req, res, next) {
  let addressToValidate = req.param('address');
  console.log('validating', addressToValidate);

  let addressIsFine;
  try {
    addressIsFine = await BITBOX.Address.toCashAddress(addressToValidate);
  }
  catch(nope) {
    console.log('nope');
    return res.status(400).send();
  }

  if (addressIsFine) {
    console.log('Address checks out!');
    return res.status(200).json({
      address: addressIsFine
    });
  }

});


app.use('/', router);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  let err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status).json({
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status).json({
    message: err.message,
    error: {}
  });
});


let dripDrop = function() {
  // console.log('Dripping a drop');
  // io.emit('drop', { image: 'lol' });
};

let intervalId = setInterval(dripDrop, 10000);

module.exports = { app: app, server: server, io: io };
