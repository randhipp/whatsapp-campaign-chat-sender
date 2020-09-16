require('dotenv').config();
const fs = require('fs');
const csv = require('csv-parser');
const venom = require('venom-bot');

// Edit this directly or using .env
var image = process.env.IMAGE_URL;
var forwardNumber = process.env.FORWARD_NUMBER || null; 
var autoReplyMessage = process.env.AUTOREPLY_MESSAGE ;
var greetings = process.env.GREETINGS.split(",");;
var campaign = process.env.CAMPAIGN_MESSAGE;
var footer = process.env.FOOTER; 
// End stop edit here

var venomOption = {
    headless: true, // Headless chrome
    devtools: false, // Open devtools by default
    useChrome: true, // If false will use Chromium instance
    debug: false, // Opens a debug session
    logQR: true, // Logs QR automatically in terminal
    browserArgs: [''], // Parameters to be added into the chrome browser instance
    refreshQR: 15000, // Will refresh QR every 15 seconds, 0 will load QR once. Default is 30 seconds
    autoClose: 60000, // Will auto close automatically if not synced, 'false' won't auto close. Default is 60 seconds (#Important!!! Will automatically set 'refreshQR' to 1000#)
    disableSpins: true, // Will disable Spinnies animation, useful for containers (docker) for a better log
  };

var savedClient = [];
var filteredContacts = []; 
const phonelist = [];

fs.createReadStream('phonelist.csv')
  .pipe(csv())
  .on('data', (data) => phonelist.push(data))
  .on('end', () => {
    const batches = randChunkSplit(phonelist,2,10);
    run(batches)
  });

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function verifyPhoneNumber(number){
    var validity = new RegExp("^[0-9]{8,14}$");
    return validity.test(number);
}

function randomBetween(min, max) {
    if (min < 0) {
        return Math.ceil(min + Math.random() * (Math.abs(min)+max));
    }else {
        return Math.ceil(min + Math.random() * max);
    }
}

function saveFiltered(filteredContacts){
    fs.writeFile(`./active-wa-list-${+ new Date()}.json`, JSON.stringify(filteredContacts, null, 2), function(err, result) {
        if(err) console.log('error', err);
      });
}

async function start(client) {
    client.onMessage(async (message) => {
        if(message.from.includes("@c.us")) {
            
            client.sendImage(
                message.from,
                image,
                'wafvel-whatsapp-gateway-wafvel-dot-com.jpg',
                'Hello from 🤖 wafvel.com'
                ); 
            
            client.startTyping(message.from);
            await sleep(randomBetween(3000,8000));
            client.stopTyping(message.from);
            client.sendText(message.from, autoReplyMessage);
            
            if(forwardNumber !== null){
                const output = await client.checkNumberStatus(`${phone}@c.us`);
                console.log(verifyWa(output));
                if(verifyWa(output)){
                    let senderName = typeof(message.sender.name) !== 'undefined' ? message.sender.name : ( typeof message.sender.verifiedName !== 'undefined' ? message.sender.verifiedName : message.from.replace("@c.us","") ); 
                    client.startTyping(forwardNumber);
                    await sleep(randomBetween(3000,8000));
                    client.stopTyping(forwardNumber);
                    client.sendText(forwardNumber, `You got new message via bot from ${senderName} : ${message.from.replace("@c.us","")}\n⬇️⬇️⬇️`);
                    client.startTyping(forwardNumber);
                    await sleep(randomBetween(3000,8000));
                    client.stopTyping(forwardNumber);
                    client.forwardMessages( forwardNumber, [message.id.toString()], true );
                    await sleep(randomBetween(5000,60000)); 
                } else {
                    console.log(output);
                    console.log('Forward number not a whatsapp number!');
                }
            } else {
                console.log('No Forward number, reply to bot was not forwarded to anyone!');
            }
        }
    });
}

function verifyWa(output){
    if(
        output.status === 200 
        && output.canReceiveMessage === true
        && output.numberExists === true
    ){return true;} else { return false;}
}

async function blastPromo(client, name, phone){
    
    let randomIndex = Math.floor(Math.random() * greetings.length); 
    let randomGreeting = greetings[randomIndex];
    let footerCheck = typeof(footer) !== 'undefined' ? footer : "-- whatsapp rest api on wafvel.com";
    let message = `${randomGreeting} Mr/Mrs. ${name},\n${campaign}\n\n${footerCheck}`;
    try {
        client.startTyping(phone);
        await sleep(randomBetween(3000,8000));
        client.stopTyping(phone);
        client.sendText(phone, message);
    } catch (error) {
        console.log(error);
    }
    

}

async function startBot(){
    const bot = await venom.create('bot',null,null,venomOption).catch((err) => {
        console.log(err)
    });
    start(bot);
    savedClient.push(bot);
}

function randChunkSplit(arr,min,max) {
    // uncomment this line if you don't want the original array to be affected
    // var arr = arr.slice();
    var arrs = [],size=1; 
    var min=min||1;
    var max=max||min||1;
    while (arr.length > 0) {
      size = Math.min(max,Math.floor((Math.random()*max)+min));
      arrs.push(arr.splice(0, size));
    }
    return arrs;
}

async function checkWaActive(users) {
    const client = savedClient[0];
    console.log("Starting...");
            for (let i = 0; i < users.length; i++) {
                try {
                    let phone = users[i].phone.replace(/^0+/, process.env.COUNTRY_PHONECODE);
                    if(verifyPhoneNumber(phone)){
                        try {
                            const output = await client.checkNumberStatus(`${phone}@c.us`);
                            console.log(output);
                            console.log(verifyWa(output));
                            if(verifyWa(output)){
                                blastPromo(client, users[i].name, `${phone}@c.us` );
                                filteredContacts.push({
                                    name: users[i].name,
                                    phone: users[i].phone,
                                    result: output
                                });
                                console.log(`Number verified & send message to : ${users[i].name} - ${phone}`);
                                fs.appendFile('blast-log.txt', `Number verified & send message to : ${users[i].name} - ${phone}\n`, function (err) {
                                    if (err) throw err;
                                });
                                let wait = randomBetween(8000,30000);
                                console.log(`wait ${wait} seconds`);
                                await sleep(wait);
                            } else {
                                console.log('Skipped, number not using whatsapp, message not sent to this number.');
                                console.log(`Number: ${users[i].phone}`);
                            }
                        } catch (error) {
                           console.log(error); 
                        }
                        
                    } else {
                        console.log('verifyPhoneNumber error, phone in csv in wrong format, use country+number like this : 62812313213 , min 8 & max 14 digit,')
                    }
                } catch (error) {
                    console.log(error);
                    console.log(users[i]);
                }
                
            }
            console.log("This Batch done, wait for another batch!");
}


async function run(batches) {

    await startBot();

    for (let i = 0; i < batches.length; i++) {    
        console.log(batches[i]);

        console.log(`start sending in batch ${i}`);
        await checkWaActive(batches[i]);
        console.log(`batch ${i} done`);
        let wait = randomBetween(180000,300000);
        console.log(`wait ${wait} ms for next batch`);
        await sleep(wait);
    }
    saveFiltered(filteredContacts);
    console.log('All sending batch done! thanks..');
    savedClient[0].close();
    await sleep(5000);
    process.exitCode = 1;    
};

process.on('SIGINT', function() {
    bot = savedClient[0];
    bot.client.close();
});