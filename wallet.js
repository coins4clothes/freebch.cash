
let fse = require('fs-extra');
let appConfig = fse.readJsonSync(__dirname + '/local.js', { throws: true }) || {};

let _ = require('lodash');

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

wallet.sendMoney = async function(options) {
  let paymentAmount = 20000;

  // Ensure there are no undefined or duplicate
  // addresses in the from array.
  options.from = BITBOX.Address.toCashAddress(appConfig.paymentAddress);

  let arrayOfInputAddresses = [];
  arrayOfInputAddresses.push({cashAddress: options.from});

  let toAddress = BITBOX.Address.toCashAddress(options.to);

  // Use Bitbox API to get a list of all the unspent outputs for
  // all the sending user's payment addresses. Do this 15 at a time.
  let userUtxos = [];
  while (arrayOfInputAddresses.length) {
    let someRecords = arrayOfInputAddresses.splice(0, 15);
    let justAddresses = _.map(someRecords, 'cashAddress');

    console.log('Now fetching:', justAddresses);

    let someResults;

    try {
      someResults = await BITBOX.Address.utxo(justAddresses);
    }
    catch(nope) {
      console.log('Something went wrong with utxo checking during sendMoney:', nope);
      continue;
    }

    console.log('Got:', (someResults&&someResults.length),'from bitbox');

    someResults = _.flatten(someResults);

    // // Attach to every utxo a reference to its GitCash PaymentAddress record.
    for (let oneUtxo of someResults) {
      userUtxos.push( _.extend(oneUtxo, {
        paymentAddressRecord: { cashAddress: oneUtxo.cashAddress }
      }) );
    }

    // Wait a few seconds before we ask for more
    if (arrayOfInputAddresses.length) {
      await delay(500);
    }

  }

  userUtxos = _.sortBy(_.flatten(userUtxos), ['amountSatoshis'] ).reverse();

  if (!userUtxos.length) {
    throw new Error ('NO_CONFIRMED_DEPOSITS');
  }

  let txData = {
    spendables: [],
    total: 0,
    feesNeeded: 0,
    changeNeeded: 0,
    batchFailed: false,
    feesExceedBalance: false
  };

  while (userUtxos.length) {
    let topElement = userUtxos.shift();

    if (topElement.satoshis > 0) {
      txData.spendables.push(topElement);
    }

    txData.total = _.sumBy(txData.spendables, 'satoshis');
    let numOfInputs = _.flatten(_.map(txData.spendables,'utxos')).length;

    txData.feesNeeded = BITBOX.BitcoinCash.getByteCount({ P2PKH: numOfInputs }, { P2PKH: 2 });

  }

  // Order the inputs by amount
  txData.spendables = _.sortBy(txData.spendables, 'satoshis').reverse();

  // If we are dusting, set our changeNeeded amount to the
  // sum of our dust inputs
  txData.changeNeeded = txData.total - ( txData.feesNeeded + paymentAmount );

  if (txData.feesNeeded > txData.total) {
    txData.feesExceedBalance = true;
  }

  // If the mining fees required to sweep the wallet are greater
  // than the contents of the wallet, throw an error.
  if (txData.feesExceedBalance) {
    console.log(util.inspect(txData,null,4));
    throw new Error('FEES_EXCEED_BALANCE');
  }

  // console.log('txData:', txData);

  // Instantiate the Bitbox transaction builder
  let transactionBuilder = new BITBOX.TransactionBuilder('bitcoincash');

  console.log('\n\nAdding Outputs\n\n');
  console.log('\tAdding output:', toAddress, paymentAmount);
 
  // Add output w/ address and amount to send
  transactionBuilder.addOutput(toAddress, paymentAmount);

  console.log('\tAdding output:', appConfig.paymentAddress, txData.changeNeeded);

  // Change address
  transactionBuilder.addOutput(appConfig.paymentAddress, txData.changeNeeded);

  // Coerce the data into a flat collection of objects containing
  // everything needed to add inputs to our transaction.
  try {

    let inputIndex = 0;
    txData.spendables = txData
    .spendables
    .map( (oneUtxo) => {

      return {
        index: inputIndex++,
        path: oneUtxo.paymentAddressRecord.derivationPath,
        txid: oneUtxo.txid,
        vout: oneUtxo.vout,
        amountSatoshis: oneUtxo.satoshis,
        cashAddress: oneUtxo.cashAddress
      };

    });

    console.log('\n\nAdding Inputs\n\n');
    // Add those inputs
    for (let oneTxInput of txData.spendables) {
      console.log(`\tAdding input ${oneTxInput.txid}[${oneTxInput.index}] with vout ${oneTxInput.vout} from ${oneTxInput.cashAddress} in the amount of ${oneTxInput.amountSatoshis} to transaction`);
      transactionBuilder.addInput(oneTxInput.txid, oneTxInput.vout);
    }

    console.log('\n\nSigning Inputs\n\n');

    // Sign those inputs

    for (let oneTxInput of txData.spendables) {
      // Create an ECpair to sign this particular input from.  If we are sweeping
      // from a paper wallet, we'll use the `signingECpair` created earlier.
      // Otherwise, create a signing pair for this input from it's associated
      // PaymentAddress's derivationString.
      let inputSigningPair;
      try {
        inputSigningPair = BITBOX.ECPair.fromWIF(appConfig.privateKey);
      }
      catch(nope) {
        console.log('Cannot create ECPair from private key to sweep paper wallet:', nope);
        throw new Error('BAD_PAPER');
      }
      transactionBuilder.sign(oneTxInput.index, inputSigningPair, undefined, transactionBuilder.hashTypes.SIGHASH_ALL, oneTxInput.amountSatoshis);
    }

  }
  catch(nope) {
    console.log('Cannot build transaction:', nope);
    throw nope;
  }

  console.log('\n\nNow building transaction!\n\n');

  // Now let's build it!
  let tx;
  try {
    tx = transactionBuilder.build();
  }
  catch (nope) {
    console.log('Cannot build transaction:', nope);
    throw nope;
  }

  console.log('\n\nPreparing to send:\n\t',txData);

  console.log('tx ready:', tx);

  let hexTx = tx.toHex();

  console.log('\n\n', hexTx,'\n\n');

  // process.exit();

  // Now convert the transaction to hex and broadcast it to
  // our connected full node.
  let submissionResults;
  try {
    submissionResults = await BITBOX.RawTransactions.sendRawTransaction(hexTx);
  }
  catch (nope) {
    console.log('Cannot broadcast transaction:', nope);
    throw nope;
  }

  if (!submissionResults) {
    console.log('\n\n*********** SUBMISSION RESULTS **************');
    console.log(require('util').inspect(submissionResults, null, 4));
    console.log('\n\n');
  }

  // If the transaction fails but doesn't throw, make sure
  // it throws.
  let errorInfo;
  if (typeof submissionResults === 'string' && submissionResults.indexOf(':') > -1) {
    if (_.toNumber(submissionResults.split(':')[0])) {
      errorInfo = {
        code: Number(submissionResults.split(':')[0]),
        description: submissionResults.split(':')[1]
      };
    }
  }

  if (errorInfo&&errorInfo.code) {
    let someError = new Error('SUBMIT_ERROR');
    _.extend(someError, errorInfo);
    console.log('Cannot broadcast transaction:', someError);
    throw someError;
  }

  console.log('Transaction broadcasted!', submissionResults);

  // Return the results
  let sendResults = {
    txData: txData,
    transactionId: submissionResults,
    transaction: tx,
    amountSatoshis: paymentAmount,
    fee: txData.feesNeeded
  };

  return sendResults;

}







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