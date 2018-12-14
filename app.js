const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, printf } = format;

/*
Importing all the required libraries for the program
 */
var debug = process.argv.length > 3 ? process.argv[3]==="false": true;
var express = require('express'),
    fs = require('fs'),
    ejs = require('ejs'),
    path = require('path'),
    bodyParser = require('body-parser'),
    http = require('http'),
    https = require('https'),
    uuid = require('node-uuid'),
    _ = require('lodash'),
    app = express(),
    session = require('express-session')({
      secret: 'Life, the universe, and everything',
      resave: true,
      saveUninitialized: true
    }),
    port = process.argv.length > 2 ? parseInt(process.argv[2]): 8080;
/*
Initializing the express app to program the url paths in browser
*/
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname + '/front_end'));
app.use(express.static(__dirname + '/front_end'));
app.use('/scripts', express.static(__dirname + '/node_modules'));
app.use('/assets', express.static(__dirname + '/assets'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session);
app.use('/', function (req, res) {
  req.session.user = {pid: uuid.v4()};
  res.render('index');
});

/*
Start the program in debug mode as http, or in regular mode as https
 */
if(debug){
  console.log(`Starting server on port ${port}`);
  var server = http.createServer(app).listen(port);
  console.log(`Server started!`);
}
else{
  console.log("Attempting to load certs");
  const options = {
    key: fs.readFileSync(process.env.SERVER_KEY),
    cert: fs.readFileSync(process.env.SERVER_CERT)
  };
  console.log(`Starting server on port ${port}`);
  var server = https.createServer(options, app).listen(port);
  console.log(`Server started!`);
}



io = require('socket.io').listen(server);

/*
 Setup a new connection when a client connects
 */
io.on('connection', function(client) {
  myFormat = printf(info => {
    return `[${info.timestamp}][UID:${client.id}] ${info.level}: ${info.message}`;
  });
  //Initialize a logger for the program information
  logger = createLogger({
    level: 'debug',
    prettyPrint: true,
    colorize: true,
    format: combine(
      timestamp(),
      myFormat
    ),
    transports: [
      new transports.Console({ level: 'info'}),
    ]
  });
  logger.info("New client connected");

  //Initialize the player object to default values
  var player = {
    pid: 0,
    balance: 500,
    hand: {
      cards: [],
      value: 0,
      canHit: true,
      canSplit: false,
    },
    split: {
      cards: [],
      value: 0,
      canHit: false,
    },
    bet: 0,
    playing: true,
    sid: client.id,
    canDouble: false,
    hasDoubled: false,
    hasDoubledSplit: false,
    canInsure: false,
  };

  //Create the game for this connection
  var game = {
    /*
    Whenever required, reset all values back to their default amounts (like on the first game, or a new game)
    */
    reset: function(cards){
      player = {
        pid: 0,
        balance: player.balance,
        hand: {
          cards: [],
          value: 0,
          canHit: true,
          canSplit: false,
        },
        split: {
          cards: [],
          value: 0,
          canHit: false,
        },
        bet: player.bet,
        playing: true,
        sid: client.id,
        canDouble: false,
        hasDoubled: false,
        hasDoubledSplit: false,
        canInsure: false,
      };
      game.table = [];
      game.inProgress = false;
      game.deck = [];
      game.dealer = { 
        pid: "dealer", 
        hand: {
          cards: [],
          value: 0,
        },
        playing: true
       };
      game.start(cards);
      return { message: "Reset Successful!", alert_user: false }
    },
    /*
    Generate a new deck
    */
    generateDeck: function() {
      var ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9","T", "J", "Q", "K"];
      var suits = ["C", "D", "H", "S"];
      var deck = [];
      for (var i = 0; i < suits.length; i++) {
        for (var j = 0; j < ranks.length; j++) {
          deck.push({rank: ranks[j], suit: suits[i], hidden: false});
        }
      }
      logger.info("Deck Created");
      return game.shuffle(deck);
    },
    /*
    Shuffle the deck
    */
    shuffle: function(deck) {
      logger.info("Deck Shuffled");
     return _.shuffle(deck);
    },
    /*
    Deal each player two cards.
    If "cards" is specified, the specified cards are dealt to the players instead
    */
    deal: function(cards) {
      var card = cards && cards[0] ? cards[0] : game.deck.pop();
      card.hidden = true;
      logger.info("Dealer Dealt a " + card.rank + card.suit + " face down");
      game.dealer.hand.cards.push(card);

      card = cards && cards[1] ? cards[1] : game.deck.pop();
      card.hidden = false;
      logger.info("Dealer Dealt a " + card.rank + card.suit);
      game.dealer.hand.cards.push(card);

      card = cards && cards[2] ? cards[2] : game.deck.pop();
      card.hidden = true;
      logger.info("Player Dealt a " + card.rank + card.suit);
      player.hand.cards.push(card);

      var card2 = cards && cards[3] ? cards[3] : game.deck.pop();
      card2.hidden = false;
      logger.info("Player Dealt a " + card2.rank + card2.suit);
      player.hand.cards.push(card2);
      game.calculateHands();
      
      if(game.dealer.hand.cards[1].rank==="A" && player.balance >= Math.floor(player.bet/2) && player.hand.value!==21){
        player.canInsure = true;
        logger.info('Asking player to insure');
        io.sockets.connected[player.sid].emit('insure', data);
      }
      else if(player.hand.value==21){
        logger.info("Player has blackjack!");
        game.finishGame();
        return -1;
      }
      if(card.rank==card2.rank && player.balance>=player.bet){
        player.hand.canSplit = true;
      }
      if(player.balance>=player.bet){
        player.canDouble = true;
      }
      return 1;
    },
  
    /*
    Refresh the table for the game, sending data to the UI
    */
    refreshTable: function() {
      if (!('sid' in player))
        return;

      game.calculateHands();

      var cleanedDealer = _.cloneDeep(game.dealer);
      for(var i=0;i<cleanedDealer.hand.cards.length;i++){
        if(cleanedDealer.hand.cards[i].hidden && game.inProgress){
          cleanedDealer.hand.cards[i] = '??';
        }
      }

      var data = {
        dealer: cleanedDealer,
        me: player,
      };

      logger.info("Refreshing table with new data: " + JSON.stringify(data));
      io.sockets.connected[player.sid].emit('refresh', data);
      if(!player.playing && game.inProgress){
        game.inProgress = false;
        game.playDealer();
        game.finishGame();
      }
    },
    /*
    Calculates the score of the hand given to the function
    */
    calculateHand: function(hand) {
      var value = 0;
      var aceCount = 0;
      for(var i=0;i<hand.cards.length;i++){
        switch (hand.cards[i].rank){
          case 'K':
          case 'Q':
          case 'J':
          case 'T':
            value+=10;
          break;
          case 'A':
            aceCount++;
            break;
          default:
            value+=parseInt(hand.cards[i].rank);          
            break;
        }
      }
      if(value+11+(aceCount-1)*1<=21 && aceCount > 0){
        value+=11 + aceCount - 1;
      }
      else{
        value+=aceCount;
      }
      return value;
    },
    /*
    Calculate and store the score of all hands in the table
    */
    calculateHands: function() {
      player.hand.value = game.calculateHand(player.hand);
      player.split.value = game.calculateHand(player.split);
      game.dealer.hand.value = game.calculateHand(game.dealer.hand);
    },
    /*
    Play the dealers hand given the current game state
    */
    playDealer: function() {
      if(game.dealer.hand.value < 17 && (player.hand.value <= 21 || (player.split.value <= 21 && player.split.cards.length!=0))){
        game.dealer.hand.cards.push(game.deck.pop());
        game.calculateHands();
        game.refreshTable();
        game.playDealer();  
      }

    },
    /*
    Determine the winning hands at the table
    */
    determineWinner: function() {
      /*
       * 1 represents dealer, 
       * 2 represents player, 
       * 3 represents split,
       * 4 represents insurance
       */
      game.calculateHands();
      winners = [];
      losers = [];
      ties = [];
      winnings = 0;

      //Dealer Beats Player Main Hand (through bust or otherwise)
      if(game.dealer.hand.value<=21 && 
        (game.dealer.hand.value > player.hand.value ||  player.hand.value > 21)){
        logger.info("Dealer beat player hand!");
        winners.push(1);
        losers.push(2);
        winnings-=player.bet;
      }

      //Dealer Beats Player Split Hand (if exists) (through bust or otherwise)
      if(player.split.cards.length>0 && game.dealer.hand.value<=21 && 
        (game.dealer.hand.value > player.split.value || player.split.value > 21)){
          logger.info("Dealer beat player split!");
        if(!winners.includes(1)){
          winners.push(1);
        }
        losers.push(3);
        winnings-=player.bet;
      }

      //Player Beats Dealer Main Hand (through bust or otherwise)
      if(player.hand.value<=21 && 
        (player.hand.value > game.dealer.hand.value ||  game.dealer.hand.value > 21)){
          logger.info("Player hand beat dealer!");
          winners.push(2);
          losers.push(1);
          winnings+=player.bet;
          player.balance+=player.bet*2;
          if(player.split.cards.length===0 && player.hand.cards.length===2 && player.hand.value===21){
            logger.info("Player got blackjack!");
            player.balance+=Math.floor(player.bet*0.5);
          }
      }

      //Player Split Hand Beats Dealer Hand (if exists) (through bust or otherwise)
      if(player.split.cards.length>0 && player.split.value<=21 && 
        (player.split.value > game.dealer.hand.value ||  game.dealer.hand.value > 21)){
          logger.info("Player split beat dealer!");
          winners.push(3);
          if(!losers.includes(1)){
            losers.push(1);
          }
          winnings+=player.bet;
          player.balance+=player.bet*2;
      }

      //One or More Ties Exists
      //Everyone Busted
      if(winners.size===0 && losers.size===0){
        logger.info("Everyone Busted!");
        ties.push([1,2,3]);
        player.balance+=player.bet;
      }
      //Player hand or split and Dealer Busted
      else if((player.hand.value > 21 || player.split.value > 21) &&  game.dealer.hand.value > 21){
        if(player.hand.value > 21){
          logger.info("Player hand and dealer busted!");
          player.balance+=player.bet;
          ties.push([1, 2]);
        }
        if(player.split.cards.length>0 && player.split.value > 21){
          logger.info("Player split and dealer busted!");
          player.balance+=player.bet;
          ties.push([1, 3]);
        }
      }
      //Player hand or split and Dealer tied
      else if(player.hand.value===game.dealer.hand.value || player.split.value===game.dealer.hand.value){
        if(player.hand.value===game.dealer.hand.value){
          logger.info("Player hand and dealer tied!");
          player.balance+=player.bet;
          ties.push([1, 2]);
        }
        if(player.split.cards.length>0 && player.split.value===game.dealer.hand.value){
          logger.info("Player split and dealer tied!");
          player.balance+=player.bet;
          ties.push([1, 3]);
        }
      }

      //Insurance Bet Win
      if(player.insured && game.dealer.hand.cards.length===2 && game.dealer.hand.value===21){
        logger.info("Player won insurance bet!");
        winners.push(4);
        winnings+=player.bet;
        player.balance+=Math.floor(player.bet*1.5)
      }
      logger.info(`Player net; $${winnings}`);
      player.bet=0;
      logger.info(`${winners} ${losers} ${ties} ${winnings}`);
      return {"winners" : winners, "losers": losers, "ties": ties, "winnings": winnings};
  
    },
    /*
    Send the game finishing data to the UI
    */
    finishGame: function() {
      data = game.determineWinner();
      game.refreshTable();
      logger.info("Sending following winner data: " + JSON.stringify(data));
      io.sockets.connected[player.sid].emit('endGame', data);
    },
    /*
    Start a new game, if "cards" is specified, those cards are dealt to the new player
    */
    start: function(cards) {
      game.inProgress = true;
      game.deck = game.generateDeck();
      if(game.deal(cards) > 0){
        game.calculateHands();
        game.refreshTable(player);
        logger.info("New Game Started!");
      }
    },
    /*
    Increases the players bet by the specified amount
    */
    bet: function(amount){
      if(player.balance>=amount && player.bet+amount<=500){
        logger.info(`Betting ${amount}`);
        player.balance-=amount;
        player.bet+=amount;
        data = {
          message: "Bet Successful!", 
          alert_user: false
        };
      }
      else if(player.balance<amount){
        data = {
          message: "You don't have enough money!",
          alert_user: true
        };
      }
      else{
        data = {
          message: "You can only bet a maximum of $500!",
          alert_user: true
        };
      }
      io.sockets.connected[player.sid].emit('updateBet', player);
      return data;
    },
    /*
    Resets the players bet to 0
    */
    resetBet: function(){
      logger.info(`Resetting bet to 0`)
      player.balance+=player.bet;
      player.bet=0;
      io.sockets.connected[player.sid].emit('updateBet', player);
      return { message: "Reset Successful!", alert_user: false };
    },
    /*
    Bets insurance for the player
    */
    insurance: function(){
      logger.info(`Betting insurance`)
      player.insured=true;
      player.canInsure=false;
      player.balance-=Math.floor(player.bet/2);
      game.refreshTable();
      if(game.dealer.hand.value==21){
        game.finishGame();
      }
      return { message: `You bet $${Math.floor(player.bet/2)} on insurance!`, alert_user: false };
      
    },
    /*
    Sets the current hand to stay, disabling hitting and splitting
    */
    stay: function(hand) {
      hand.canSplit = false;
      hand.canHit = false;
      return { message: "Stay Successful!", alert_user: false };
    },
    /*
    Adds a card to the specified hand
    */
    hit: function(hand, card) {
      data = { message: "Hit Successful!", alert_user: false };
      hand.canSplit = false;
      console.log(card);
      card ? hand.cards.push(card) : hand.cards.push(game.deck.pop());
      game.calculateHands();
      if(hand.value > 21){
        hand.canHit = false;
        data = { message: "You busted!", alert_user: true };
      }
      return data;
    },
    /*
    Bets double for the player
    */
    double: function(player, split=false) {
      player.balance-=player.bet;
      player.bet+=player.bet;
      player.hand.canHit = false;
      data = game.hit(player.hand);
      return data;
    },
    /*
    Splits the players inital hand into two new hands
    */
    split: function() {
      player.balance-=player.bet;
      player.hand.canSplit = false;
      player.split.canHit = true;
      player.split.cards.push(player.hand.cards.pop());
      game.hit(player.split);
      game.hit(player.hand);
      if(player.split.cards[0].rank==="A" && player.hand.cards[0].rank==="A"){
        player.split.canHit = false;
        player.hand.canHit = false;
        player.playing = false;
      }
      game.refreshTable(player);
      return { message: "Split Successful!", alert_user: false };
    }
  };
  /*
  The following sections handle all the socket/connection logic from the player and the website
  */
  askSid = client.id;
  io.sockets.connected[client.id].emit('connected', debug, player);

  client.on('bet', function(amount, callback) {
    data = game.bet(amount);
    callback(data.message, data.alert_user);
  });

  client.on('resetBet', function(_data, callback) {
    data = game.resetBet();
    callback(data.message, data.alert_user);
  });

  client.on('insurance', function(insure) {
    if(insure){
      game.insurance(player);
    }
    player.canInsure = false;
  });

  client.on('hit', function(data , callback) {
    data.card = game.cheating ? data.card : undefined;
    ret = data.split ? game.hit(player.split, data.card) : game.hit(player.hand, data.card);
    player.canDouble = false;
    player.canInsure = false;
    if(player.split.canHit==false && player.hand.canHit==false){
      player.playing=false;
    }
    game.refreshTable(player);
    callback(ret.message, ret.alert_user);
  });

  client.on('stay', function(split, callback) {
    data = split ? game.stay(player.split) : game.stay(player.hand);
    player.canDouble = false;
    player.canInsure = false;
    if(player.split.canHit==false && player.hand.canHit==false){
        player.playing=false;
    }
    game.refreshTable(player);
    callback(data.message, data.alert_user);
  });

  client.on('double', function(_data, callback) {
    data = game.double(player);
    player.canDouble = false;
    player.canInsure = false;
    if(player.split.canHit==false && player.hand.canHit==false){
      player.playing=false;
    }
    game.refreshTable(player);
    callback(data.message, data.alert_user);
  });

  client.on('doubleSplit', function(_data, callback) {
    data = game.double(player, true);
    player.canDoubleSplit = false;
    player.canInsure = false;
    if(player.split.canHit==false && player.hand.canHit==false){
      player.playing=false;
    }
    game.refreshTable(player);
    callback(data.message, data.alert_user);
  });

  client.on('split', function(_data, callback) {
    data = game.split();
    callback(data.message, data.alert_user);
  });

  client.on('newGame', function(data) {
      game.cheating = data.cheating && debug;
      data = game.reset(data.cards);
  });
});

