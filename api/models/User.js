/**
 * User.js
 *
 * @description :: A model definition.  Represents a database table/collection/etc.
 * @docs        :: https://sailsjs.com/docs/concepts/models-and-orm/models
 */

module.exports = {

  attributes: {

    cashAddress: {
      type: 'string'
    },

    ipAddress: {
      type: 'string'
    },

    phoneNumber: {
      type: 'string'
    },

    code: {
      type: 'number'
    },

    txUrl: {
      type: 'string'
    }

  },

};

