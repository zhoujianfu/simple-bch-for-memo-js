// make sure you're running the newest version of node!! then it's just: node simple-bch-for-memo.js
const bch = require('bitcoincashjs'); // https://github.com/bitcoincashjs/bitcoincashjs
var request = require('request'); // https://github.com/request/request

const privateKey = new bch.PrivateKey(''); // enter your private key here! (e.g. ded892e2...)
var memotext = ""; // enter the text you want to post here!
const pm = ''; // if you want this to be a private message to somebody, enter their public memo.cash bch address here!

const address = privateKey.toAddress().toString();
const broadcast = 1; // 1 if you want to actually send the txn, 0 if you just want to craft it.
var memotype = '6d024c'; //see memo.cash/protocol .. not sure why 4c goes at the end but it does!

if (0) { // not implemented yet, and buggy!
if (pm) {
   const { encrypt, decrypt } = require('bitcoin-encrypt'); // https://github.com/kevinejohn/bitcoin-encrypt

   const yourPriv = privateKey.toString();
   const theirPub = GetPubFromAddr(pm);
   var encrypted = encrypt(theirPub, yourPriv, memotext);
   memotext = new Buffer(encrypted, 'binary').toString('base64');
   if (encoded.length > 217) {
      memotext = PublicURL(memotext);
      encrypted = encrypt(theirPub, yourPriv, publicurl);
      memotext = new Buffer(encrypted, 'binary').toString('base64');
   }
   memotype = '6d154c'; // hopefully 6d15 becomes the official memo.cash protocol for encrypted private messages.
}

function PublicURL(txt) {
   var url = 'https://paste.city';
   request.post({url:url, form: {'txt':txt}}, function (error, response, body) {
      var parts = response.headers['location'].split(/\//);
      return url+'/'+parts[1];
   })
}
}

var fee = 207+memotext.length; // note, the min fee that blockdozer send will allow for some reason is about 1/2 sat/byte. However, not everybody will relay it before it confs, so $

// build the op_return
var post_code = [];
post_code.push(memotype);
var text_list = encodeURI(memotext).split('%');
var formatted_list = [];
for (var i = 0; i < text_list[0].length; i++) {
    formatted_list.push(text_list[0].charCodeAt(i).toString(16));
}
text_list.shift();
for (i = 0; i < text_list.length; i++) {
    formatted_list.push(text_list[i].slice(0,2))
    for (j = 2; j < text_list[i].length; j++){
        formatted_list.push(text_list[i][j].charCodeAt(0).toString(16))
    }
}
var text_len = formatted_list.length;
for (var i = 0; i < post_code.length; i++) {
    var real_len = (text_len).toString(16);
    if (real_len.length === 1) {
       real_len = "0"+real_len;
    }
    opreturn = post_code[i] + real_len + formatted_list.join('');
}

// build the output
var script = bch.Script.buildDataOut(opreturn,'hex');
script.chunks[1].opcodenum = 2;
var out = new bch.Transaction.Output({script: script , satoshis: 0})


//get an unspent utxo and make that txn!
var url = 'https://bitcoincash.blockexplorer.com/api/addr/' + address+'/utxo?nocache='+ new Date().getTime();
request.get({
    url: url,
    json: true,
    headers: {'User-Agent': 'request'}
  }, (err, res, data) => {
    if (err) {
      console.log('Error:', err);
    } else if (res.statusCode !== 200) {
      console.log('Status:', res.statusCode);
    } else {
      // data is already parsed as JSON:
        for (var i = 0; i < data.length; i++) {
            if (Number(data[i]['satoshis']) > fee) {
               var utxo = {
                           'txId' : data[i]['txid'],
                           'outputIndex' : data[i]['vout'],
                           'address' : address,
                           'script' : data[i]['scriptPubKey'],
                           'satoshis' : data[i]['satoshis']
                          };
               const transaction = new bch.Transaction()
                                          .from(utxo)
                                          // WARNING! NEED THIS OR LOSE IT ALL TO FEES!
                                          .feePerKb(fee) // for some reason this just becomes the fee as opposed to the fee per kb (maybe thinks size is always 1 KB?) 
                                          .addOutput(out)
                                          .change(address)
                                          .sign(privateKey);
               console.log(transaction.toString())

               if (broadcast) {
                  var options = {
                                url: 'https://blockdozer.com/api/tx/send',
                                method: 'POST',
                                json: {'rawtx': transaction.toString()}
                  }
                  request(options, function (error, response, body) {
                         console.log(error)
                         if (!error && response.statusCode == 200) {
                            console.log(body)
                         }
                  })
               }

               break;
            }
        }
    }
});
