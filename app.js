const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, printf } = format;

var debug = process.argv.length>3 ? process.argv[3]==="true": false;
var express = require('express'),
    fs = require('fs'),
    bodyParser = require('body-parser'),
    http = require('http'),
    https = require('https'),
    uuid = require('node-uuid'),
    sleep = require('sleep'),
    _ = require('lodash'),
    app = express(),
    session = require('express-session')({
      secret: 'Life, the universe, and everything',
      resave: true,
      saveUninitialized: true
    }),
    port = process.argv.length > 2 ? parseInt(process.argv[2]): 443;

app.set('view engine', 'ejs');
app.set('views', __dirname + '/front_end');
app.use(express.static(__dirname + '/front_end'));
app.use('/scripts', express.static(__dirname + '/node_modules'));
app.use('/assets', express.static(__dirname + '/assets'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session);

app.all('/', function (req, res) {
  req.session.user = {pid: uuid.v4()};
  res.render('index');
});

if(debug){
  console.log(`Starting server on port ${port}`);
  var server = http.createServer(app).listen(port);
  console.log(`Server started!`);
}
else{
  const options = {
    key: fs.readFileSync(process.env.SERVER_KEY),
    cert: fs.readFileSync(process.env.SERVER_CERT)
  };
  console.log(`Starting server on port ${port}`);
  var server = https.createServer(options, app).listen(port);
  console.log(`Server started!`);
}



io = require('socket.io').listen(server);

// New game connection requested
io.on('connection', function(client) {
  myFormat = printf(info => {
    return `[${info.timestamp}][UID:${client.id}] ${info.level}: ${info.message}`;
  });

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

  // New player
  var player = {
    pid: 0,
    balance: 500,
    hand: [],
    split: [],
    value: 0,
    bet: 0,
    canHit: true,
    splitCanHit: false,
    playing: true,
    playingSplit: false,
    sid: client.id,
    bust: false,
    splitBust: false,
    movesLeft: 1,
    canDouble: false,
    canBetInsurance: false,
    insured: false
  };
  var game = {

    reset: function(){
      player = {
        pid: 0,
        hand: [],
        split: [],
        value: 0,
        bet: player.bet,
        balance: player.balance,
        canHit: true,
        splitCanHit: false,
        playing: true,
        playingSplit: false,
        sid: client.id,
        bust: false,
        splitBust: false,
        movesLeft: 1,
        canDouble: false,
        canBetInsurance: false,
        insured: false
      };
      game.table = [];
      game.inProgress = false;
      game.deck = [];
      game.dealer = { pid: "dealer", hand: [], value: 0, playing: true, bust: false };
      game.start();
    },
  
    generateDeck: function() {
      var ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9","10", "J", "Q", "K"];
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
  
    shuffle: function(deck) {
      logger.info("Deck Shuffled");
     return _.shuffle(deck);
    },
  
    // deal two cards to each player at the table
    deal: function() {
      var card = game.deck.pop();
      card.hidden = true;
      logger.info("Player Dealt a " + card.rank + card.suit);
      player.hand.push(card);

      var card2 = game.deck.pop();
      card2.hidden = false;
      logger.info("Player Dealt a " + card2.rank + card2.suit);
      player.hand.push(card2);
      if(card.rank==card2.rank && player.balance>=player.bet){
        player.canSplit = true;
      }
      if(player.balance>=player.bet){
        player.canDouble = true;
      }
  
      card = game.deck.pop();
      card.hidden = true;
      logger.info("Dealer Dealt a " + card.rank + card.suit + " face down");
      game.dealer.hand.push(card);

      card = game.deck.pop();
      card.hidden = false;
      logger.info("Dealer Dealt a " + card.rank + card.suit);
      game.dealer.hand.push(card);

      if(card.rank==="A"){
        player.canBetInsurance = true;
      }
    },
  
    // Emit the state of the table to the player, stripping data
    refreshTable: function() {
      // They don't have a socket ID? Don't send, its the dealer
      if (!('sid' in player))
        return;
      game.calculateHands();
      var cleanedDealer = _.cloneDeep(game.dealer);
      for(var i=0;i<cleanedDealer.hand.length;i++){
        if(cleanedDealer.hand[i].hidden && game.inProgress){
          cleanedDealer.hand[i] = debug ? cleanedDealer.hand[i] : '??' + i.toString();
        }
      }
      player.name = "Player"
      
      var data = {
        dealer: cleanedDealer,
        me: player,
      };
      logger.info("Refreshing table with new data: " + JSON.stringify(data));
      io.sockets.connected[player.sid].emit('refresh', data);
      if(!player.playing && !player.playingSplit && game.inProgress){
        game.inProgress = false;
        game.playDealer();
        game.finishGame();
      }
    },
  
    calculateHand: function(hand) {
      var value = 0;
      var aceCount = 0;
      for(var i=0;i<hand.length;i++){
        switch (hand[i].rank){
          case 'K':
          case 'Q':
          case 'J':
            value+=10;
          break;
          case 'A':
            aceCount++;
            break;
          default:
            value+=parseInt(hand[i].rank);          
            break;
        }
      }
      if(aceCount===1){
        if(value+11>21){
          value+=1;
        }
        else{
          value+=11;
        }
      }
      else{
        value+=1*aceCount;
      }
      return value;
    },
  
    calculateHands: function() {
      player.value = game.calculateHand(player.hand);
      player.splitValue = game.calculateHand(player.split);
      game.dealer.value = game.calculateHand(game.dealer.hand);
    },
  
    playDealer: function() {
      if ( ( player.bust && player.playingSplit==false ) ||
           ( player.bust && player.splitBust) ){
             return;
           }
      else if(game.dealer.value < 17){
        game.hit(game.dealer);
        game.refreshTable();
        game.playDealer();  
      }

    },
  
    determineWinner: function() {
      game.calculateHands();
      winner = []
      if( (player.value>game.dealer.value && player.value <= 21) ||
          (player.value <= 21 && game.dealer.value > 21) ){
        logger.info("Player has won!");
        if(player.hand.length==2 && player.value==21){
          logger.info("Player got blackjack!")
          player.balance += player.bet*2 + Math.floor(player.bet/2);
        }
        else{
          player.balance += player.bet*2;
        }
        winner.push(2);
      }
      if( (player.splitValue>game.dealer.value && player.splitValue <= 21) ||
          (player.splitValue <= 21 && game.dealer.value > 21 && player.splitValue != 0) ){
        logger.info("Player split hand has won!");
        player.balance += player.bet*2;
        winner.push(3);
      }
      if(winner.length===0 && game.dealer.value <= 21 && 
        ( (player.value>21 && player.splitValue>21) || 
          (game.dealer.value>player.value && game.dealer.value>player.splitValue))){
        logger.info("Dealer has won!");
        winner.push(1);
      }
      if(player.insured && game.dealer.hand.length==2 && game.dealer.value==21){
        logger.info("Player won insurance!");
        player.balance+=player.bet * 1.5;
        winner.push(4);
      }
      logger.info("Sending following winner data: " + JSON.stringify(winner));
      player.bet=0;
      return winner;
  
    },
  
    finishGame: function() {
      winner = game.determineWinner();
      game.refreshTable();
      io.sockets.connected[player.sid].emit('endGame', winner);
    },
  
  
    start: function() {
      game.inProgress = true;
      game.deck = game.generateDeck();
      game.deal();
      game.firstRound = true;
      game.calculateHands();
      game.refreshTable(player);
  
      logger.info("New Game Started!");
    },
    
    bet: function(amount){
      if(player.balance>=amount && player.bet+amount<=500){
        logger.info(`Betting ${amount}`)
        player.balance-=amount;
        player.bet+=amount;
      }
      io.sockets.connected[player.sid].emit('updateBet', player);
    },

    resetBet: function(){
      logger.info(`Resetting bet to 0`)
      player.balance+=player.bet;
      player.bet=0;
      io.sockets.connected[player.sid].emit('updateBet', player);
    },

    insurance: function(){
      logger.info(`Betting insurance`)
      player.insured=true;
      player.balance-=Math.floor(player.bet/2);
      game.refreshTable();
    },
  
    stay: function(player) {
      player.canSplit = false;
      player.playing = false;
      player.canHit = false;
      player.canDouble = false;
      game.refreshTable(player);
    },
  
    hit: function(player) {
      player.canDouble = false;
      player.canSplit = false;
      player.hand.push(game.deck.pop());
      player.hand[player.hand.length-1].hidden = false;
      game.calculateHands();
      if(player.value > 21){
        player.canHit = false;
        player.bust = true;
        player.playing = false;
      }
      game.refreshTable(player);
    },

    double: function(player) {
      player.balance-=player.bet;
      player.bet+=player.bet;
      player.canHit = false;
      game.hit(player);
    },

    staySplit: function(player) {
      player.playingSplit = false;
      player.splitCanHit = false;
      game.refreshTable(player);
    },
  
    hitSplit: function(player) {
      player.split.push(game.deck.pop());
      player.split[player.split.length-1].hidden = false;
      game.calculateHands();
      if(player.splitValue > 21){
        player.splitCanHit = false;
        player.splitBust = true;
        player.playingSplit = false;
      }
      game.refreshTable(player);
    },
  
    split: function() {
      player.balance-=player.bet;
      player.canSplit = false;
      player.splitCanHit = true;
      player.playingSplit = true;
      player.split.push(player.hand.pop());
      game.refreshTable(player);
    }
  };

  askSid = client.id;
  io.sockets.connected[client.id].emit('connected', debug, player);

  client.on('bet', function(amount) {
    game.bet(amount);
  });
  client.on('resetBet', function(amount) {
    game.resetBet();
  });
  client.on('insurance', function() {
    game.insurance(player);
  });

  client.on('hit', function() {
    game.hit(player);
  });
  client.on('stay', function() {
    game.stay(player);
  });

  client.on('double', function() {
    game.double(player);
  });

  client.on('split', function() {
    game.split();
  });
  client.on('hitSplit', function() {
    game.hitSplit(player);
  });
  client.on('staySplit', function() {
    game.staySplit(player);
  });

  client.on('newGame', function() {
      game.reset();
  })
});

