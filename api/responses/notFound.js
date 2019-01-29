
module.exports = function notFound(optionalData) {

  // Get access to `req` and `res`
  var req = this.req;
  var res = this.res;

  // Define the status code to send in the response.
  var statusCodeToSet = 404;

  // If no data was provided, use res.sendStatus().
  if (optionalData === undefined) {
    sails.log.info('Ran custom response: res.notFound()');
    return res.sendStatus(statusCodeToSet);
  }
  // Else if the provided data is an Error instance, if it has
  // a toJSON() function, then always run it and use it as the
  // response body to send.  Otherwise, send down its `.stack`,
  // except in production use res.sendStatus().
  else if (_.isError(optionalData)) {
    sails.log.info('Custom response `res.notFound()` called with an Error:', optionalData);
  }
  // Set status code and send response data.
  else {
    return res.status(statusCodeToSet).send(optionalData);
  }

};
