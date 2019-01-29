var async=require('async');
var _=require('lodash');
var Plivo = require('plivo');

var plivoHook = function(sails) {

  return {

    defaults: {
    },
    testmode: true,
    initialize: function (callback) {

      // After the services and orm have been loaded let's setup exchanges
      sails.after(['hook:services:loaded', 'hook:orm:loaded'], function () {

        sails.hooks.plivo.client = new Plivo.Client(sails.config.plivo.authId, sails.config.plivo.authToken);

        return callback();

      });

    },
    client: undefined,
    test: async function(){

      try {
        await sails.hooks.plivo.text({
          phone: sails.config.plivo.adminPhone,
          message: 'Im just a little test.  Love me'
        });
      }
      catch(nope) {
        console.log('nope:', nope);
      }

    },
    text: async function(options) {
      let params = {
        'src': sails.config.plivo.sourceNumber, // Caller Id
        'dst' : options.phone, // User Number to Call
        'text' : options.message,
        'type' : 'sms'
      };

      let sendTextResponse;
      try {
        sendTextResponse = await sails.hooks.plivo.client.messages.create(
          sails.config.plivo.sourceNumber,
          options.phone,
          options.message
        );
      }
      catch(nope) {
        console.log('Cannot send SMS message using params', params,':', nope);
        throw nope;
      }
      console.log('SMS Sent!', sendTextResponse);

      return true;
    }
  };
};

module.exports = plivoHook;
