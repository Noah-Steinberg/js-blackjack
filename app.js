// Module Dependencies
// This file loosely based off of the tutorial at https://www.fenixapps.com/blog/express-nodejs-angularjs-and-socket-io/
// I've done this disgustingly because I'm lazy
var debug = process.argv.length>3 ? process.argv[3]==="true": false;
var rigged= process.argv.length>4 ? process.argv[4]==="true": false;
var alwaysStay= process.argv.length>4 ? process.argv[6]==="true": false;
var chooseStrat= process.argv.length>4 ? process.argv[7]==="true": false;
var askSid = '';
var express = require('express'),
    fs = require('fs'),
    bodyParser = require('body-parser'),
    http = require('http'),
    uuid = require('node-uuid'),
    sleep = require('sleep'),
    _ = require('lodash'),
    app = express(),
    session = require('express-session')({
      secret: 'Life, the universe, and everything',
      resave: true,
      saveUninitialized: true
    }),
    sharedsession = require('express-socket.io-session'),
    port = process.argv.length > 2 ? parseInt(process.argv[2]): 8080;
    onlyShowAI = true, // Turn on if dev messages will only display AI messages
    dev  = true; // disable if you want the prod version
var num_ais = 0;
var ais = "";
// Global logs. Logged on server and on the client
var broadcast = function(msg) {
  console.log(msg);
  io.emit("new message", msg);
};

// dev broadcasts. Developes only if dev mode is active
var _bc = function(msg, obj) {
  if (!dev)
    return;
  if (onlyShowAI) {
    if (msg.substring(0,4) === "[AI]" ||
        msg.substring(0,4) === "[DEA") {
          if (obj)
            console.log(msg, obj);
          else
              console.log(msg);
          io.emit("new message", msg);
        }
  }
  else {
    msg = "[DEV] ".concat(msg);
    if (obj)
      console.log(msg, obj);
    else
        console.log(msg);
    io.emit("new message", msg);
  }

};
function AIStrategy(player){
  this.player = player;
  this.strategy = function() {
    throw new Error("Unimplemented strategy class")
  }  
}

function AIStrategyOne(player){
  this.constructor.prototype = AIStrategy;
  this.player = player;
  this.strategy = function(player) {
    game.calculateHands();
    if(player.value < 4){
      broadcast("aiStrategyOne: Exchanging all non-paired cards");
      var cards_to_remove = [0,1,2,3,4]
      for(var i=0;i<player.hand.length;i++){
        for(var j=i+1;j<player.hand.length;j++){
          if(player.hand[i].rank===player.hand[j].rank){
            if (cards_to_remove.indexOf(i)!==-1){
              cards_to_remove.splice(cards_to_remove.indexOf(i),1);
            }
            if (cards_to_remove.indexOf(j)!==-1){
              cards_to_remove.splice(cards_to_remove.indexOf(j),1);
            }
          }
        }
      }
    var move = "exchange";
    for(var i=0; i<player.hand.length;i++){
      move+=",";
      move += String(cards_to_remove.indexOf(i)!==-1);
    }
    broadcast("aiStrategyOne, Exchanging: " + String(move) + " unpaired cards out of 5");
    game.exchange(player,move);
    game.stay(player);
  }
  else{
    broadcast("aiStrategyOne: Has a straight or better... holding");
    game.stay(player);
  }
  };
} 

function AIStrategyTwo(player){
  this.constructor.prototype = AIStrategy;
  this.player = player;
  this.strategy = function(player) {
    var flag = false;
    for(var i=0; i<game.table.length;i++){
      for(var j=0; j<game.table[i].hand.length;j++){
        if(game.table[i].hand[j].hidden==false){
          flag = true;
        }
      }
    }
    for(var i; i<game.dealer.hand.length; i++){
      if(game.dealer.hand[i].hidden==false){
        flag = true;
      }
    }
    if(!flag){
      broadcast("aiStrategyTwo: No Cards Visible, Using aiStrategyOne");
      new AIStrategyOne(player).strategy(player);
    }
    else{
      var flag = false;
      for(var i=0; i<game.table.length;i++){
        for(var j=0; j<game.table[i].hand.length;j++){
          for(var k=j+1; k<game.table[i].hand.length;k++){
            for(var l=k+1; l<game.table[i].hand.length;l++){
              if(game.table[i].hand[j].rank===game.table[i].hand[k].rank && game.table[i].hand[k].rank===game.table[i].hand[l].rank){
                if(!flag)
                  broadcast("aiStrategyTwo: Player " + String(i) + " has three of a kind, using strategy 2");
                flag = true;
              }
              if(game.table[i].hand[j].suit===game.table[i].hand[k].suit && game.table[i].hand[k].suit===game.table[i].hand[l].suit){
                if(!flag)
                  broadcast("aiStrategyTwo: Player " + String(i) + " has three of a kind, using strategy 2");
                flag = true;
              }
            } 
          }
        }
      }
      for(var j=0; j<game.dealer.hand.length;j++){
        for(var k=j; k<game.dealer.hand.length;k++){
          for(var l=k; l<game.dealer.hand.length;l++){
            if(game.dealer.hand[j].rank===game.dealer.hand[k].rank && game.dealer.hand[k].rank===game.dealer.hand[l].rank){
              if(!flag)
                broadcast("aiStrategyTwo: Dealer has three of a kind, using strategy 2");
              flag = true;
            }
            if(game.dealer.hand[j].suit===game.dealer.hand[k].suit && game.dealer.hand[k].suit===game.dealer.hand[l].suit){
              if(!flag)
                broadcast("aiStrategyTwo: Dealer has three of a kind, using strategy 2");
              flag = true;
            }
          } 
        }
      }
      if(flag){
        var cards_to_remove = [0,1,2,3,4]
        for(var i=0;i<player.hand.length;i++){
          for(var j=i+1;j<player.hand.length;j++){
            if(player.hand[i].rank===player.hand[j].rank){
              if (cards_to_remove.indexOf(i)!==-1){
                cards_to_remove.splice(cards_to_remove.indexOf(i),1);
              }
              if (cards_to_remove.indexOf(j)!==-1){
                cards_to_remove.splice(cards_to_remove.indexOf(j),1);
              }
            }
          }
        }
        var move = "exchange";
        for(var i=0; i<player.hand.length;i++){
          move+=",";
          move += String(cards_to_remove.indexOf(i)!==-1);
        }
      broadcast("aiStrategyTwo, Exchanging: " + String(move) + " unpaired cards out of 5");
      game.exchange(player,move);
      game.stay(player);
    }
    else{
      broadcast("aiStrategyTwo: No Three Similar Cards Found (Similar is same suit OR same rank). Using aiStrategyOne");
      new AIStrategyOne(player).strategy(player);
    }
    }
  };
}
// Define some needed model data
var game = {
  table: [],
  queuedPlayers: [],
  inProgress: false,
  deck: [],
  dealer: { pid: "dealer", hand: [], value: 0, isAI: true, playing: false, hasSplit: false, bust: false },
  currentPlayer: {},
  firstRound: true, // set to false every round
  currentPlayerIndex: 0,

  generateDeck: function() {
    var ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9","10", "J", "Q", "K"];
    var suits = ["C", "D", "H", "S"];
    var deck = [];

    // fill the deck
    for (var i = 0; i < suits.length; i++) {
      for (var j = 0; j < ranks.length; j++) {
        deck.push({rank: ranks[j], suit: suits[i], hidden: false});
      }
    }

    _bc("New Deck Generated");

    return game.shuffle(deck);
  },

  shuffle: function(deck) {
    _bc("Deck Shuffled");
   return _.shuffle(deck);
  },

  // deal two cards to each player at the table
  deal: function() {
    if(process.argv.length>5 && debug){
      var array = fs.readFileSync(process.argv[5]).toString().split("\n");
      for(var i=0;i<array.length;i++){
        var hand = JSON.parse(array[i]);
        for(var j=0;j<hand.length;j++){
          if(i===3){
            game.dealer.hand.push({rank: hand[j][0], suit:  hand[j][1], hidden: true});
          }
          else{
            game.table[i].hand.push({rank: hand[j][0], suit:  hand[j][1], hidden: true});
          }
        }
      }
      return;
    }
    else if(rigged){
      game.getCard(0,5);
      game.getCard(1,5);
      game.getCard(2,5);
      game.getCard(3,5);
      return;
    }
    for (var i = 0; i < game.table.length; i++) {
      for(var j =0; j < 5; j++){
        var card = game.deck.pop();
        card.hidden = true;
        _bc("Player "+game.table[i].pid+" Dealt a " + card.rank + card.suit);
        game.table[i].hand.push(card);
      }
    }
    for(var i =0; i < 5; i++){
      var card = game.deck.pop();
      card.hidden = true;
      _bc("Dealer Dealt a " + card.rank + card.suit);
      game.dealer.hand.push(card);
    }
  },

  clearBoard: function() {
    _bc("Board cleared");
    for (var i = 0; i < game.table.length; i++) {
      if (game.table[i].isAI) {
        game.table.splice(i--,1);
      }
      else {
        game.table[i].hand = [];
        game.table[i].value = 0;
        game.table[i].playing = false;
        game.table[i].bust = false;
        game.table[i].winner = false;
        game.table[i].canExchange = true;
      }
    }
    game.dealer = { pid: "dealer", hand: [], value: 0, isAI: true, playing: false, hasSplit: false, bust: false, movesLeft: 3, strategy: 2};
    game.currentPlayerIndex = 0;
    game.currentPlayer = game.table[0];
  },

  addFromQueue: function() {
    // If table isn't full, loop add people from the queue
    while (game.table.length < 3 && game.queuedPlayers.length !== 0) {
      var newPlayer = game.queuedPlayers.pop();
      game.table.push(newPlayer);
      _bc("Player Added from queue: " + newPlayer.pid);
      io.sockets.connected[newPlayer.sid].emit('begin', newPlayer);
    }
  },

  addAI: function() {
    // If there are spots left and the queue hasn't filled, add AI
    var remaining = num_ais+1 - game.table.length;
    var strats = ais.split(',');
    for (var i = 0; i < remaining; i++) {
      var AI = { "pid": "AI-"+i, "hand": [], "value": 0, "isAI": true, "playing": false, "hasSplit": false, bust: false, movesLeft: 3, strategy: parseInt(strats[i])};
      game.table.push(AI);
      _bc("AI added to game");
    }
  },

  // Emit the state of the table to the player, stripping data
  emitTable: function(player) {
    // They don't have a socket ID? Don't send, probably AI or error
    if (!('sid' in player))
      return;
    var newTable = _.cloneDeep(game.table);
    var playerIndex = -1;
    // For everyone, if it's not the current player
    for (var i = 0; i < newTable.length; i++) {
      if (newTable[i].pid != player.pid) {
        var other = newTable[i];
        for(var j=0;j<other.hand.length;j++){
          if(other.hand[j].hidden){
            other.hand[j] = debug ? other.hand[j] : '??' + j.toString();
          }
        }
        if ("sid" in other)
          delete other.sid;
        if (newTable[i].pid == game.currentPlayer.pid)
          newTable[i].active = true;
        else
          newTable[i].active = false;
        newTable[i].name = "Player " + i;
      }
      else
        playerIndex = i;
      
    }
    newTable.splice(playerIndex, 1);

    var cleanedDealer = _.cloneDeep(game.dealer);
    for(var i=0;i<cleanedDealer.hand.length;i++){
      if(cleanedDealer.hand[i].hidden){
        cleanedDealer.hand[i] = debug ? cleanedDealer.hand[i] : '??' + i.toString();
      }
    }
    if (game.currentPlayer.pid == game.dealer.pid) {
      cleanedDealer.active = true;
    }
    else {
      cleanedDealer.active = false;
    }

    player.name = "Player " + playerIndex;

    var data = {
      dealer: cleanedDealer,
      players: newTable,
      me: player,
      myTurn: game.currentPlayer === player
    };
    
    io.sockets.connected[player.sid].emit('turnPlayed', data);
  },

  broadcastTable: function() {
    for (var i = 0; i < game.table.length; i++) {
      game.emitTable(game.table[i]);
    }
  },

  onlyAI: function() {
    for (var i = 0; i < game.table.length; i++) {
      if (!game.table[i].isAI) {
        _bc("Checking if Only AI left... Player found.");
        return false;
      }
    }
    _bc("Only AI remaining, quitting game.");
    return true;
  },

  threePlayersDone: function() {
    var remainingPlayers = game.table.length+1;
    var bust = 0;
    if (!game.dealer.playing)
      remainingPlayers--;
    if (game.dealer.bust)
      bust++;
    for (var i = 0; i < game.table.length; i++) {
      if (!game.table[i].playing)
        remainingPlayers--;
      if (game.table[i].bust)
        bust++;
    }
    // If the dealer is done, then it must be true
    _bc("Determined: " + bust + " players are bust");
    _bc("Determined: " + remainingPlayers + " players are still playing");
    return remainingPlayers===0 || bust === game.table.length;
  },

  // Game is over when all players are not currently playing, inProgress is false (somebody won)
  // or there is only AI players
  isGameOver: function() {
    _bc("Game should end: " + !(game.inProgress) || game.threePlayersDone() || game.onlyAI());
    return !(game.inProgress) || game.threePlayersDone() || game.onlyAI();
  },

  findHighestRank: function(hand, value, ranks_count){
    rank = "2";
    rank_values = {"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"10":10,"J":11,"Q":12,"K":13,"A":14};
    card_values = {2:"2",3:"3",4:"4",5:"5",6:"6",7:"7",8:"8",9:"9",10:"10",11:"J",12:"Q",13:"K",14:"A"};
    if(value===9){
      return "A";
    }
    else if(value===8 || value===4 || value ===5 || value===6 || value < 1){
      for(var i=0;i<hand.length;i++){
        if(rank_values[rank] < rank_values[hand[i].rank]){
          rank = hand[i].rank;
        }
      }
    }
    else if(value===7){
      for(var i=0;i<hand.length;i++){
        if(rank_values[rank] < rank_values[hand[i].rank] && ranks_count[rank_values[hand[i].rank]]==4){
          rank = hand[i].rank;
        }
      }
    }
    else if(value===3){
      for(var i=0;i<hand.length;i++){
        if(rank_values[rank] < rank_values[hand[i].rank] && ranks_count[rank_values[hand[i].rank]]==3){
          rank = hand[i].rank;
        }
      }
    }
    else if(value===2){
      for(var i=0;i<hand.length;i++){
        if(rank_values[rank] < rank_values[hand[i].rank] && ranks_count[rank_values[hand[i].rank]]==2){
          rank = hand[i].rank;
        }
      }
    }
    else if(value===1){
      for(var i=0;i<hand.length;i++){
        if(rank_values[rank] < rank_values[hand[i].rank] && ranks_count[rank_values[hand[i].rank]]==2){
          rank = hand[i].rank;
        }
      }
    }
    return rank;
  },

  compareCard: function(card1, card2){
    rank_values = {"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"10":10,"J":11,"Q":12,"K":13,"A":14};
    suit_values = {"D": 0, "C": 1, "H": 2, "S": 3};
    if(rank_values[card1.rank] > rank_values[card2.rank]){
      return 1;
    }
    else if(rank_values[card1.rank] > rank_values[card2.rank]){
      return -1;
    }
    else if(rank_values[card1.rank] === rank_values[card2.rank] && suit_values[card1.suit] > suit_values[card2.suit]){
      return 1;
    }
    else if(rank_values[card1.rank] === rank_values[card2.rank] && suit_values[card1.suit] < suit_values[card2.suit]){
      return -1;
    }
    else if(rank_values[card1.rank] === rank_values[card2.rank] && suit_values[card1.suit] === suit_values[card2.suit]){
      return 0;
    }
  },

  findCardOfRank: function(hand, rank){
    rCard = -1;
    ranking = {"D": 0, "C": 1, "H": 2, "S": 3};
    for(var i=0; i<hand.length;i++){
      if((rCard===-1 || ranking[rCard.suit] < ranking[hand[i].suit]) && hand[i].rank===rank){
        rCard = hand[i];
      }
    }
    return rCard;
  },

  calculateHand: function(player) {
    var value = 0;
    var hand_ranks = [];
    var ranks_count = {2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0,10:0,11:0,12:0,13:0,14:0};
    var suits_count = {"C": 0, "D": 0, "H": 0, "S": 0};
    for(var i = 0; i < player.hand.length; i++){
      switch (player.hand[i].rank){
        case 'K':
          hand_ranks.push(13);
          ranks_count[13]++;
          break;
        case 'Q':
          hand_ranks.push(12); 
          ranks_count[12]++;         
          break;
        case 'J':
          hand_ranks.push(11);          
          ranks_count[11]++;
          break;
        case 'A':
          hand_ranks.push(14);          
          ranks_count[14]++;
          break;
        default:
          hand_ranks.push(parseInt(player.hand[i].rank));          
          break;
      }
      suits_count[player.hand[i].suit]++;
      ranks_count[parseInt(player.hand[i].rank)]++;
    }
    hand_ranks = hand_ranks.sort();
    delete ranks_count[NaN];
    delete suits_count[NaN];
    var hasFlush = Math.max(...(Object.values(suits_count)))==5 ? true : false;
    var hasFullHouse = Object.values(ranks_count).includes(3) && Object.values(ranks_count).includes(2) ? true : false;
    var hasRoyalStraight = JSON.stringify(hand_ranks.sort())==JSON.stringify([10,11,12,13,14]) ? true: false;
    var hasFourOfAKind = Math.max(...(Object.values(ranks_count)))==4 ? true : false;
    var hasThreeOfAKind = Math.max(...(Object.values(ranks_count)))==3 ? true : false;
    var hasPair = Math.max(...(Object.values(ranks_count)))==2 ? true : false;
    var hasStraight = false;
    for(var i = 1; i < hand_ranks.length; i++){
      if(hand_ranks[i]-hand_ranks[i-1]==1){
        hasStraight = true;
      }
      else{
        hasStraight = false;
        break;
      }
    }
    var hasTwoPair = false;
    var ranks_frequency = Object.values(ranks_count);
    var flagOne = false;
    for(var i=0;i<ranks_frequency.length;i++){
      if(!flagOne && ranks_frequency[i]==2){
        flagOne = true;
      }
      else if(ranks_frequency[i]==2){
        hasTwoPair = true;
        break;
      }
    }
    

    if(hasRoyalStraight && hasFlush){
      value=9;
    }
    else if(hasStraight && hasFlush){
      value=8;
    }
    else if(hasFourOfAKind){
      value=7;
    }
    else if(hasFullHouse){
      value=6;
    }
    else if(hasFlush){
      value=5;
    }
    else if(hasStraight){
      value=4;
    }
    else if(hasThreeOfAKind){
      value=3;
    }
    else if(hasTwoPair){
      value=2;
    }
    else if(hasPair){
      value=1;
    }
    else{
      value = 0 + Math.max(...hand_ranks)/100;
    }
    player.value = value;
    player.highest_card = game.findCardOfRank(player.hand, game.findHighestRank(player.hand, player.value, ranks_count));
  },

  getVisibleHand: function(hand) {
    var visible = [];
    for (var i = 0; i < hand.length; i++) {
      if (!hand[i].hidden)
        visible.push(hand[i]);
    }
    return visible;
  },

  visibleHandValue: function(player) {
    return dev ? calculateHand(player) : 0;
  },

  calculateHands: function() {
    _bc("Calculating hands");
    for (var i = 0; i < game.table.length; i++) {
      game.calculateHand(game.table[i]);
    }
    game.calculateHand(game.dealer);
  },

  disconnectPlayer: function(player) {
    player.bust = true;
    player.playing = false;
    var i = 0;

    broadcast("[!] Player has disconnected.");

    for (i = 0; i < game.queuedPlayers.length; i++) {
      if (game.queuedPlayers[i] === player) {
        game.queuedPlayers.splice(i, 1);
        break;
      }
    }
    for (i = 0; i < game.table.length; i++) {
      if (game.table[i] === player) {
        game.table.splice(i, 1);
        break;
      }
    }

    if (player === game.currentPlayer)
      game.nextRound();

    game.broadcastTable();
  },

  containsAce: function(hand) {
    _bc("Checking if hand contains an ace");
    for (var i = 0; i < hand.length; i++) {
      if (hand[i] === "A") {
        _bc("Hand does contain an ace: ", hand);
        return true;
      }
    }

    _bc("Hand does not contain an ace: ", hand);
    return false;
  },

  playAI: function(player) {
    _bc("[AI] ----------"+player.pid+"------------ [AI]");
    if(alwaysStay){
      game.stay(player);
    }
    else if(player.strategy==1){
      new AIStrategyOne(player).strategy(player);
    }
    else{
      new AIStrategyTwo(player).strategy(player);
    }

    _bc("[AI] ----------     END    ------------ [AI]");
  },

  playDealer: function() {
    _bc("[DEALER] ---------------------- [DEALER]");
    if(alwaysStay){
      game.stay(game.dealer);
    }
    else if(game.dealer.strategy==1){
      new AIStrategyOne(game.dealer).strategy(game.dealer);
    }
    else{
      new AIStrategyTwo(game.dealer).strategy(game.dealer);
    }
    _bc("[DEALER] ---------------------- [DEALER]");

  },
  nextRound: function(){
    _bc("Round complete");
    if (game.isGameOver()) {
      game.finishGame();
      return;
    }

    game.currentPlayerIndex++;

    if (game.currentPlayerIndex === game.table.length)
      game.currentPlayer = game.dealer;
    else if (game.currentPlayerIndex === game.table.length+1) {
      game.currentPlayerIndex = 0;
      game.currentPlayer = game.table[0];
    }
    else {
      game.currentPlayer = game.table[game.currentPlayerIndex];
    }

    if (!game.currentPlayer.playing) {
      game.broadcastTable();
      game.nextRound();
      return;
    }

    if (game.currentPlayer === game.dealer) {
      game.playDealer();
      game.firstRound = false;
      game.calculateHands();
      game.broadcastTable();
      broadcast("--------------------------------------------------");
      setTimeout(game.nextRound, (dev?700:2000));
      return;
    }

    if (game.currentPlayer.isAI) {
      game.playAI(game.currentPlayer);
      game.calculateHands();
      game.broadcastTable();
      setTimeout(game.nextRound, (dev?700:2000));
      return;
    }

    game.calculateHands();
    game.broadcastTable();
  },

  isTied: function() {
    return game.determineWinners().length > 1
  },

  determineWinners: function() {
    game.calculateHands();   

    var newTable = _.clone(game.table);
    newTable.push(game.dealer);

    var tiedPlayers = [];
    var highScore = 0;
    var highcard = -1;

    // First, find ties
    for (var i = 0; i < newTable.length; i++) {
      var player = newTable[i];
      if (player.value > highScore || (player.value === highScore && game.compareCard(player.highest_card, highcard)===1)) {
        tiedPlayers.length = 0;
        tiedPlayers.push(newTable[i]);
        highScore = newTable[i].value;
        highcard = player.highest_card;
      }
      else if (player.value === highScore) {
        if(game.compareCard(player.highest_card, highcard)===0){
          tiedPlayers.push(newTable[i]);
        }
      }
    }

    for (var k = 0; k < tiedPlayers.length; k++)
      tiedPlayers[k].winner = true;

    return tiedPlayers;
  },

  determineWinner: function() {
    game.calculateHands();   

    var newTable = _.clone(game.table);
    newTable.push(game.dealer);

    var winner;
    var highScore = 0;
    var highcard = -1;

    for (var i = 0; i < newTable.length; i++) {
      var player = newTable[i];
      if (player.value > highScore || (player.value === highScore && game.compareCard(player.highest_card, highcard)===1)) {
        winner = newTable[i];
        highScore = winner.value;
        highcard = player.highest_card;
      }
    }

    winner.winner = true;
    return winner;

  },

  displayResults: function() {
    if (!game.isTied()) {
      var winner = game.determineWinner();
      broadcast("[!] Winner is " + (winner === game.dealer? "Dealer":("Player "+game.table.indexOf(winner)+(winner.isAI?"(AI)":""))) + " with a score of " + winner.value);
    }
    else {
      var winners = game.determineWinners();
      for (var i = 0; i < winners.length; i++)
        broadcast("    [>] " + (winners[i] === game.dealer? "Dealer":("Player "+game.table.indexOf(winners[i])+(winners[i].isAI?"(AI)":""))));
      broadcast("[!] There was a tie!");
    }
  },

  finishGame: function() {
    game.inProgress = false;
    broadcast("=============================\n[!] Game over!");
    game.displayResults();

    // For each player, emit the table, minus them

    for (var i = 0; i < game.table.length; i++) {
      if ("sid" in game.table[i]) {
        var data = {};
        var newTable = _.cloneDeep(game.table);
        newTable.splice(i, 1);

        data.players = newTable;
        data.dealer = game.dealer;
        data.me = game.table[i];
        io.sockets.connected[game.table[i].sid].emit('endGame', data);

      }
    }
    if (!game.onlyAI())
      setTimeout(game.start, (dev?1500:5000), ais);
  },

  allPlaying: function() {
    for (var i = 0; i < game.table.length; i++) {
      game.table[i].playing = true;
    }

    game.dealer.playing = true;
  },

  start: function(a) {
    game.inProgress = true;
    ais = a;
    num_ais = ais.split(',').length;
    game.clearBoard();
    game.addFromQueue();
    game.addAI();
    game.deck = game.generateDeck();
    game.deal();
    game.allPlaying();
    game.firstRound = true;
    game.calculateHands();
    game.currentPlayer = game.table[0];
    game.currentPlayerIndex = 0;
    game.broadcastTable();

    broadcast("[!] New Game Started!");
    game.nextRound();
  },
  stay: function(player) {
    broadcast("[>] "+ (player === game.dealer? "Dealer":("Player "+game.table.indexOf(player)+(player.isAI?"(AI)":"")))+" Has Stayed"+(player.value>21?" and has BUST!":""));
    player.playing = false;
    game.broadcastTable();
  },
  exchange: function(player, move) {
    player.canExchange = false;
    var missingCards=0;
    var toRemove = [];
    var move = move.split(",");
    move.splice(0,1);
    for(var i=0;i<move.length;i++){
      if(move[i]==='true'){
        missingCards++;
        toRemove.push(player.hand[i]);
      }
    }
    for(var i=0; i<toRemove.length;i++){
      player.hand.splice(player.hand.indexOf(toRemove[i]),1)
    } 
    for(var i=0;i<missingCards;i++){
      var playerNo = player == game.dealer ? 3 : game.table.indexOf(player);
      if(rigged){
        game.getCard(playerNo,missingCards);
        break;
      }
      game.hit(player);
    }
    game.broadcastTable();
  },

  hit: function(player) {
    player.hand.push(game.deck.pop());
    player.hand[player.hand.length-1].hidden = false;
    game.calculateHand(player);
  },

  hitCard: function(move, more) {
    move = move.split(',');
    playerNo = parseInt(move[0]);
    if(parseInt(move[0])===3){
      game.dealer.hand.push({rank: move[1], suit: move[2], hidden: false});
    }
    else{
      game.table[parseInt(move[0])].hand.push({rank: move[1], suit: move[2], hidden: false})
    }
    game.calculateHands();
    game.broadcastTable();
    if(more>1){
      game.getCard(playerNo, more-1);
    }
  },

  split: function(player) {
    broadcast("[>] "+ (player === game.dealer? "Dealer":("Player "+game.table.indexOf(player)+(player.isAI?"(AI)":"")))+" Has Split"+(player.value>21?" and has BUST!":""));
    game.broadcastTable();
  },

  getCard: function(playerNo, cards) {
    io.sockets.connected[askSid].emit('needCard', playerNo, cards, game.hitCard);
  }
};


app.set('view engine', 'ejs');
app.set('views', __dirname + '/public/views');

app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session);

app.all('/', function (req, res) {
  req.session.user = {pid: uuid.v4()};
  res.render('pages/index');
});

var httpServer = http.Server(app);
httpServer.listen(port, function() {
  console.log("Server listening on port: ", port);
});

io = require('socket.io').listen(httpServer);
io.use(sharedsession(session, {
  autoSave: true
}));

// New player. Add to queue, start the game if it hasn't started
io.on('connection', function(client) {
  console.log("New user connected: UID " + 0);
  broadcast("[!] A new player has joined the queue");

  // New player
  var player = {
    pid: 0,
    hand: [],
    value: 0,
    isAI: false,
    hasSplit: false,
    playing: false,
    sid: client.id,
    bust: false,
    movesLeft: 1,
    canExchange: true
  };
  askSid = client.id;
  game.queuedPlayers.push(player);
  io.sockets.connected[client.id].emit('queued', player);


  // If a game isn't running, start one
  if (!game.inProgress)
      io.sockets.connected[client.id].emit('starting', debug, chooseStrat, game.start);

  client.on('disconnect', function() {
    game.disconnectPlayer(player);
  });

  client.on('new move', function(move) {
    if(alwaysStay){
      move = "stay";
    }
    if (game.currentPlayer !== player)
      return;
    if (move.indexOf("exchange")!==-1) {
      game.exchange(player,move);
      return
    }
    else if (move === "stay") {
      game.stay(player);
      game.finishGame();
    }
    else
      return;
  });
});

