var callServer = async function(url, options) {
  return new Promise(function(resolve, reject) {
    io.socket.post(url, options, function(responseData, resObject) {
      if (resObject.statusCode >= 400) {
        return reject(responseData);
      }
      else {
        return resolve(responseData);
      }
    });
  });
}

var steps = {
  cashAddress: {
    header: 'Enter your Bitcoin Cash Address',
    message: 'Reference the photos on the previous page if you need help.',
    value: undefined
  },
  phoneNumber: {
    header: 'Enter your mobile phone number',
    message: 'This is only used to identify you in our system.  It will never be shared with other companies.  It will never be sold.',
    value: undefined
  },
  code: {
    header: 'Enter the SMS Code',
    message: 'Enter the 5 digit code we just sent you via SMS.'
  },
  success: {
    header: 'You did it!',
    message: 'Check your wallet.  The funds have been sent!'
  },
  fail: {
    header: 'Something went wrong',
    message: 'Please try later or something.'
  }
};

var delay = ms => new Promise(resolve => setTimeout(resolve, ms));

var validateAddress = async function() {
  let addressValue = document.getElementById('cashAddress') && document.getElementById('cashAddress').value;
  console.log('Checking cashAddress', addressValue);

  let addressCheckResults;
  try {
    addressCheckResults = await callServer('/validate/address', {
      cashAddress: addressValue
    });
  }
  catch(nope) {
    console.log('Didnt work:', nope);
  }

  if (addressCheckResults) {
    console.log('it worked:', addressCheckResults);
    steps.cashAddress.value = addressCheckResults.cashAddress;
    $('#cashAddress').hide();

    $('#top-header').text(steps.cashAddress.value);

    $('#hint-title').text(steps.phoneNumber.header);
    $('#hint-message').text(steps.phoneNumber.message);
    $('#phoneNumber-container').show();
  }
};


var getCode = async function() {
  let codeValue = document.getElementById('phoneNumber') && document.getElementById('phoneNumber').value;

  let useParams = {
    phoneNumber: document.getElementById('phoneNumber') && document.getElementById('phoneNumber').value,
    cashAddress: steps.cashAddress.value
  };

  console.log('Getting code with params', useParams);

  let phoneCheckResults;
  try {
    phoneCheckResults = await callServer('/send/sms',  useParams);
  }
  catch(nope) {
    console.log('Didnt work:', nope);
    showError(nope);
  }

  if (phoneCheckResults) {
    console.log('it worked:', phoneCheckResults);
    steps.phoneNumber.value = phoneCheckResults.phoneNumber;

    $('#hint-title').text(steps.code.header);
    $('#hint-message').text(steps.code.message);
    $('#code-container').show();

    $('#phoneNumber-container').hide();
  }
};

var showError = function(someError) {
  console.log('An error must have occured:', someError);
  $('#code-container').hide();
  $('#phoneNumber-container').hide();
  $('#results-container').hide();

  $('#hint-title').text(steps.fail.header);
  $('#hint-message').text( (someError ? someError : steps.fail.message) );

};

var verifyCode = async function() {
  let codeValue = document.getElementById('code') && document.getElementById('code').value;
  console.log('Checking code', codeValue);

  let codeCheckResults;
  try {
    codeCheckResults = await callServer('/verify/code', {
      cashAddress: steps.cashAddress.value,
      code: codeValue
    });
  }
  catch(nope) {
    console.log('Didnt work:', nope);
    showError(nope);
  }

  if (codeCheckResults) {
    console.log('it worked:', codeCheckResults);
    $('#code-container').hide();

    $('#hint-title').text(steps.success.header);
    $('#hint-message').text(steps.success.message);
    $('#results-container').html('<a class="showcase" href="'+codeCheckResults.txUrl+'">See it on the blockchain!</a>');
    $('#results-container').show();

  }
  else {
    await delay(5000);
    $('#hint-title').text(steps.code.header);
    $('#hint-message').text(steps.code.message);
    $('#code-container').show();

  }
};

$( document ).ready(function() {
  $('#code-container').hide();
  $('#phoneNumber-container').hide();
  $('#results-container').hide();

  $('#hint-title').text(steps.cashAddress.header);
  $('#hint-message').text(steps.cashAddress.message);

  console.log('loading');
  io.socket.get('/checkin');
});

