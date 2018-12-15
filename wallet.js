
let BITBOXSDK = require('bitbox-sdk/lib/bitbox-sdk').default;
let BITBOX = new BITBOXSDK();

var wallet = {
  state: {
    ready: false,
    intervalId: undefined,
    dripId: undefined
  },
  ws: {
    bitcoinDotCom: undefined,
    clientIo: undefined
  }
};

module.exports = (clientIo) => {

  if (wallet.state.ready) {
    return;
  }
  else {
    wallet.ws.clientIo = clientIo;
  }

  try {
    // Get a websocket to the Bitcoin.com node
    wallet.ws.bitcoinDotCom = require('socket.io-client')('https://cashexplorer.bitcoin.com/');

    wallet.ws.bitcoinDotCom.on('tx', (data) => {
      let timestamp = new Date().getTime();

      console.log(timestamp, 'Got a transaction from Bitcoin.com:', data.txid);

    });

    wallet.ws.bitcoinDotCom.on('block', async (data) => {
      console.log('Got a block from Bitcoin.com:', data);
    });

    wallet.ws.bitcoinDotCom.on('error', function(){
      console.log(arguments);
    });

    wallet.ws.bitcoinDotCom.on('connect', (stuff) => {
      console.log('Websockets connection to Bitcoin.com established');
      wallet.ws.bitcoinDotCom.emit('subscribe', 'inv');
    });
  }
  catch(nope) {
    console.log('Something went wrong:', nope);
    throw nope;
  }

  wallet.state.ready = true;

  return true;

};

module.exports = wallet;