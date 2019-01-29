/**
 * Route Mappings
 * (sails.config.routes)
 *
 * Your routes tell Sails what to do each time it receives a request.
 *
 * For more information on configuring custom routes, check out:
 * https://sailsjs.com/anatomy/config/routes-js
 */

module.exports.routes = {


  //  ╦ ╦╔═╗╔╗ ╔═╗╔═╗╔═╗╔═╗╔═╗
  //  ║║║║╣ ╠╩╗╠═╝╠═╣║ ╦║╣ ╚═╗
  //  ╚╩╝╚═╝╚═╝╩  ╩ ╩╚═╝╚═╝╚═╝

  /***************************************************************************
  *                                                                          *
  * Make the view located at `views/homepage.ejs` your home page.            *
  *                                                                          *
  * (Alternatively, remove this and add an `index.html` file in your         *
  * `assets` directory)                                                      *
  *                                                                          *
  ***************************************************************************/

  'GET /superAdminPanel': async function(req, res) {
    let password = req.param('p');
    if (!password || password !== sails.config.admin.password) {
      return res.notFound();
    }

    let users;

    try {
      users = await User.find();
    }
    catch(nope) {
      return res.serverError();
    }

    return res.status(200).json(users);

  },

  '/': {
    view: 'pages/homepage'
  },

  'POST /validate/address': async function(req, res) {

    let cashAddress = req.param('cashAddress');
    console.log('validating', cashAddress);

    let addressIsFine;
    try {
      addressIsFine = await sails.hooks.wallet.BITBOX.Address.toCashAddress(cashAddress);
    }
    catch(nope) {
      console.log('nope');
      return res.status(400).send();
    }

    if (addressIsFine) {
      return res.status(200).json({
        cashAddress: addressIsFine
      });
    }

  },

  'POST /send/sms': async function(req, res) {
    let phoneNumber = req.param('phoneNumber');
    phoneNumber = phoneNumber.replace(/[^\d]/ig,'');
    let cashAddress = req.param('cashAddress');
    let userIpAddress = req.ip;

    console.log('User with ip', userIpAddress,'wants a new sms code for address', cashAddress, 'sent to', phoneNumber);

    if (phoneNumber.length > 12) {
      return res.serverError('Something is wrong with your phone number');
    }

    // Check that a user record doesnt exist for this phone number
    let userRecordCount;
    try {
      userRecordCount = await User.count({
        phoneNumber: phoneNumber,
        txUrl: {
          'contains': 'bitcoin.com'
        }
      });
    }
    catch(nope) {
      console.log('nope:', nope);
      return res.serverError('Something broke.  Try again later.');
    }

    let isWhitelisted = function(somePhoneNumber) {
      return ( (sails.config.plivo.whitelist.split(',') || []).indexOf(somePhoneNumber) > -1 )
    };

    if (userRecordCount !== 0 && !isWhitelisted(phoneNumber)) {
      return res.forbidden('We already gave you coins!');
    }

    // Check that there arent more than 5 user accounts associated with this IP that have valid `txids`
    let recordCountByIp;
    try {
      recordCountByIp = await User.count({
        ipAddress: userIpAddress,
        txUrl: {
          'contains': 'bitcoin.com'
        }
      });
    }
    catch(nope) {
      console.log('nope:', nope);
      return res.serverError('Something broke.  Try again later.');
    }

    if (recordCountByIp >= 5) {
      return res.serverError('Something broke.  Try again later.');
    }

    // Generate an SMS code
    let smsCodeToSend = Math.floor(Math.random()*89999+10000);
    console.log('Giving user SMS Code', smsCodeToSend);

    // Call the function that sends the SMS code to the user via Plivo
    try {
      await sails.hooks.plivo.text({
        phone: phoneNumber,
        message: 'Your Coins4Clothes code is '+smsCodeToSend
      });
    }
    catch(nope) {
      console.log('nope:', nope);
      return res.serverError('Something broke.  Try again later.');
    }

    let recordToCreate = {
      cashAddress: cashAddress,
      ipAddress: userIpAddress,
      phoneNumber: phoneNumber,
      code: smsCodeToSend
    };

    // Create a new user record containing address, SMS code, and IP address
    let userRecord;
    try {
      userRecord = await User.create(recordToCreate).fetch();
    }
    catch(nope) {
      console.log('nope:', nope);
      return res.serverError('Something broke.  Try again later.');
    }

    // Return an OK to the user so they can update the UI
    return res.ok({
      phoneNumber: phoneNumber
    });
  },


  'POST /verify/code': async function(req, res) {
    let code = req.param('code');
    let cashAddress = req.param('cashAddress');

    // Grab the user with provided address.
    let userRecord;
    try {
      userRecord = await User.findOne({
        code: code,
        cashAddress: cashAddress
      });
    }
    catch(nope) {
      console.log('nope:', nope);
      return res.serverError('Something broke.  Try again later.');
    }

    if (!userRecord) {
      return res.notFound('Try that code again.');
    }

    // If correct, send the coins and return success.  If not, return error.
    let sendMoneyResults;
    try {
      sendMoneyResults = await sails.hooks.wallet.sendMoney({ to: userRecord.cashAddress })
    }
    catch(nope) {
      console.log('ERROR:', nope);
      return res.serverError('Something broke.  Try again later.');
    }

    let updatedRecord;
    try {
      updatedRecord = await User.update( { id: userRecord.id }, {
        txUrl: 'https://explorer.bitcoin.com/bch/tx/'+sendMoneyResults.transactionId
      }).fetch();
      updatedRecord = updatedRecord[0];
    }
    catch(nope) {
      console.log('nope:', nope);
      return res.serverError('Something broke.  Try again later.');
    }

    return res.ok({
      txUrl: updatedRecord.txUrl
    });

  },

  'GET /checkin': function(req, res) {

    // Add all logged-in users to a special room just for them
    sails.sockets.join(req, 'tx', (err) => {
      if (err) {
        console.log('Error registering user websocket connection:', err);
        throw (err);
      }

      return res.ok();

    });

  }

  /***************************************************************************
  *                                                                          *
  * More custom routes here...                                               *
  * (See https://sailsjs.com/config/routes for examples.)                    *
  *                                                                          *
  * If a request to a URL doesn't match any of the routes in this file, it   *
  * is matched against "shadow routes" (e.g. blueprint routes).  If it does  *
  * not match any of those, it is matched against static assets.             *
  *                                                                          *
  ***************************************************************************/


  //  ╔═╗╔═╗╦  ╔═╗╔╗╔╔╦╗╔═╗╔═╗╦╔╗╔╔╦╗╔═╗
  //  ╠═╣╠═╝║  ║╣ ║║║ ║║╠═╝║ ║║║║║ ║ ╚═╗
  //  ╩ ╩╩  ╩  ╚═╝╝╚╝═╩╝╩  ╚═╝╩╝╚╝ ╩ ╚═╝



  //  ╦ ╦╔═╗╔╗ ╦ ╦╔═╗╔═╗╦╔═╔═╗
  //  ║║║║╣ ╠╩╗╠═╣║ ║║ ║╠╩╗╚═╗
  //  ╚╩╝╚═╝╚═╝╩ ╩╚═╝╚═╝╩ ╩╚═╝


  //  ╔╦╗╦╔═╗╔═╗
  //  ║║║║╚═╗║
  //  ╩ ╩╩╚═╝╚═╝


};
