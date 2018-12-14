//Setting up the angular library
var blackJackApp = angular.module('blackJackApp', ['ngRoute', 'ngMaterial']);

//Handles all logic for the pop-up dialogs
function DialogController($scope, $mdDialog) {

  $scope.cancel = function() {
    $mdDialog.cancel();
  };
  $scope.choose = function(choose) {
    $mdDialog.hide(choose);
  };
  $scope.acknowledge = function(){
    $mdDialog.hide();
  }

}

//Sets up the socket to communicate with the webserver
blackJackApp.factory('socket', ['$rootScope', function ($rootScope) {
  var socket = io.connect();

  return {
    on: function (eventName, callback) {
          function wrapper() {
            var args = arguments;
              $rootScope.$apply(function () {
                callback.apply(socket, args);
            });
          }

          socket.on(eventName, wrapper);

          return function () {
            socket.removeListener(eventName, wrapper);
          };
        },

  emit: function (eventName, data, callback) {
          console.log(data);
          console.log(callback);
          socket.emit(eventName, data, callback);
        }
  };
}]);

//Configures and runs the angular app for the client
blackJackApp.config(['$routeProvider', '$mdThemingProvider', function($routeProvider, $mdThemingProvider) {
  $routeProvider.when('/', {
    templateUrl: '/',
    controller: 'mainController'
  });

  $mdThemingProvider.theme('default').primaryPalette('grey').accentPalette('blue');

}]);

//Sets up the controller for all frontend actions
blackJackApp.controller('mainController', function($scope, $mdDialog, socket) {
  $scope.player = {};
  $scope.dealer = {};
  $scope.started = false;
  $scope.cardBack = "cardBack_red2.png";
  $scope.winnings = 0;

  //Show the introduction to the player
  $scope.showIntro = function(ev) {
    $mdDialog.show({
      controller: DialogController,
      templateUrl: 'alerts/intro.ejs',
      parent: angular.element(document.body),
      scope: $scope.$new(),
      targetEvent: ev,
      clickOutsideToClose:true,
      fullscreen: $scope.customFullscreen // Only for -xs, -sm breakpoints.
    }).then(function(cheating){
      $scope.cheating = cheating;
    });
  };

  //Prompts the player to ask if they want to bet insurance
  $scope.insurance = function(ev) {
    $mdDialog.show({
      controller: DialogController,
      templateUrl: 'alerts/insurance.ejs',
      parent: angular.element(document.body),
      scope: $scope.$new(),
      targetEvent: ev,
      fullscreen: $scope.customFullscreen // Only for -xs, -sm breakpoints.
    }).then(function(insuring){
      socket.emit('insurance', insuring);
    });
  };

  //Shows the help dialog to the player
  $scope.showHelp = function(ev) {
    $mdDialog.show({
      controller: DialogController,
      templateUrl: 'alerts/help.ejs',
      parent: angular.element(document.body),
      targetEvent: ev,
      clickOutsideToClose:true,
      fullscreen: $scope.customFullscreen // Only for -xs, -sm breakpoints.
    })
  };
  //Displays some message to the player
  $scope.showMessage = function(ev) {
    $mdDialog.show({
      controller: DialogController,
      scope: $scope.$new(),
      templateUrl: 'alerts/message.ejs',
      parent: angular.element(document.body),
      targetEvent: ev,
      clickOutsideToClose:true,
      fullscreen: $scope.customFullscreen // Only for -xs, -sm breakpoints.
    })
  };
  // Shows the results of the hand to the user
  $scope.showResults = function(ev) {
    $mdDialog.show({
      controller: DialogController,
      scope: $scope.$new(),
      templateUrl: 'alerts/results.ejs',
      parent: angular.element(document.body),
      targetEvent: ev,
      clickOutsideToClose:true,
      fullscreen: $scope.customFullscreen // Only for -xs, -sm breakpoints.
    })
  };
  //Lets the user know they are out of money
  $scope.outOfMoney = function(ev) {
    $mdDialog.show({
      controller: DialogController,
      scope: $scope.$new(),
      templateUrl: 'alerts/outofmoney.ejs',
      parent: angular.element(document.body),
      targetEvent: ev,
      clickOutsideToClose:true,
      fullscreen: $scope.customFullscreen // Only for -xs, -sm breakpoints.
    })
    .then(function() {
      location.reload();
    });
  };
  //When cheating is enabled, this allows the player to select the cards that are dealt
  $scope.chooseCard = function(ev) {
    $mdDialog.show({
      controller: DialogController,
      templateUrl: 'alerts/chooseCard.ejs',
      scope: $scope.$new(),
      parent: angular.element(document.body),
      targetEvent: ev,
      multiple: true,
      fullscreen: $scope.customFullscreen // Only for -xs, -sm breakpoints.
    })
    .then(function(card) {
      console.log(card);
      if($scope.inProgress){
        console.log("Sending 'hit' request");
        socket.emit("hit", {split: $scope.chooseSplit, card: {rank: card[0], suit: card[1], hidden: false}}, callback);
      }
      else{
        $scope.startingCards.push({rank: card[0], suit: card[1], hidden: false});
        if($scope.startingCards.length < 4){
          switch($scope.startingCards.length) {
            case 1:
              $scope.message = `Choose Dealer's 'face up' card`
              $scope.chooseCard();
              break;
            case 2:
              $scope.message = `Choose Player's first card`
              $scope.chooseCard();
              break;
            case 3:
              $scope.message = `Choose Player's second card`
              $scope.chooseCard();
              break;
          }
        }
        else{
          console.log("Sending 'newgame' request");
          socket.emit("newGame", {cheating: $scope.cheating, cards: $scope.startingCards});
        }
      }
    });
  };
  //Allows the player to customize the card back that the player uses
  $scope.chooseCardBack = function(ev) {
    $mdDialog.show({
      controller: DialogController,
      templateUrl: 'alerts/chooseCardBack.ejs',
      parent: angular.element(document.body),
      targetEvent: ev,
      clickOutsideToClose:true,
      fullscreen: $scope.customFullscreen // Only for -xs, -sm breakpoints.
    })
    .then(function(cardBack) {
      $scope.cardBack = cardBack;
    });
  };
  //IN the future will allow the user to login to an account
  $scope.login = function(ev) {
    //TODO
  };
  //SEts up a function for displaying server responses when required
  callback = function(message, alert_user=false){
    if(alert_user){
      $scope.message = message;
      $scope.showMessage();
    }
    else{
      console.log(message);
    }
  };
  //Sends a message to the server to increase the players bet
  $scope.bet = function(amount) {
    if($scope.inProgress){
      return;
    }
    else if($scope.player.balance===0 && $scope.player.bet===0){
      $scope.outOfMoney();
    }
    else{
      console.log(`Attempting to bet ${amount}`);
      socket.emit("bet", amount, callback);
    }
  };
  //Sends a message to the server to reset the players bet to 0
  $scope.resetBet = function(){
    console.log(`Resetting bet to 0`);
    socket.emit("resetBet", undefined, callback);
  };
  //SEnds a message to the server to split the players hand
  $scope.splitHand = function() {
    console.log("Sending 'split' request");
    socket.emit("split", undefined, callback);
  };
  //SEnds a message to the server to give the player a new card for their hand.
  //IF cheating is enabled, the player selects the card the server will add to their hand
  $scope.hit = function(split) {
    card = undefined;
    if($scope.cheating){
      $scope.message = split ? `Choose a Card for Players Split Hand` : `Choose a Card for Players Hand`
      $scope.chooseSplit = split;
      $scope.chooseCard();
    }
    else{
      console.log("Sending 'hit' request");
      socket.emit("hit", {split: split, card: card}, callback);
    }
  };
  //Sends a message to the server to 'stay' for that hand
  $scope.stay = function(split) {
    console.log("Sending 'stay' request");
    socket.emit("stay", split, callback);
  };
  //SEnds a message to the server that the player wants to bet 'double'
  $scope.double = function() {
    console.log("Sending 'double' request");
    socket.emit("double", undefined, callback);
  };
  //Sends a message to the server to start a new game
  //If cheating is enabled, the player selects the starting hands for themselves and the dealer
  $scope.newGame = function() {
    $scope.startingCards = undefined;
    if($scope.cheating){
      $scope.startingCards=[];
      $scope.message = `Choose Dealer's 'face down' card`
      $scope.chooseCard();
    }
    else{
      console.log("Sending 'new game' request");
      socket.emit("newGame", {cheating: $scope.cheating, cards: $scope.startingCards});
    }
    
  };
  //Ends the current hand and displays the result to the player
  socket.on("endGame", function(data) {
    console.log("Ending current game");
    $scope.winners = data.winners;
    $scope.losers = data.losers;
    $scope.ties = data.ties;
    $scope.winnings = data.winnings;
    var audio = new Audio('assets/sounds/hit.ogg');
    audio.play();
    $scope.showResults();
    $scope.started=false;
    $scope.inProgress=false;
  });

  //When an action is complete, the server sends a refresh request along with the data 
  socket.on("refresh", function(data) {
    var audio = new Audio('assets/sounds/hit.ogg');
    if(!$scope.started){
      audio.play();
      $scope.player = {};
      $scope.dealer = {};
      $scope.push = false;
      $scope.winnings = 0;
    }
    else if($scope.player!=={} && ($scope.player.hand.cards.length < data.me.hand.cards.length || 
      $scope.player.split.cards.length < data.me.split.cards.length)){
        audio.play();
    }

    $scope.started = true;
    console.log(`Recieved game state update:`)
    console.log(data);
    $scope.inProgress = true;
    $scope.dealer = data.dealer;
    $scope.player = data.me;
  });
  //Reflects the changes to the players bet on the screen
  socket.on("updateBet", function(data) {
    if($scope.player.bet!=data.bet){
      var audio = new Audio('assets/sounds/bet.ogg');
      audio.play();
    }
    $scope.player = data;
  });
  //EStablishes the connection to the server
  socket.on("connected", function(debug, player) {
    console.log("Connection Established");
    $scope.debug = debug;
    $scope.inProgress = false;
    $scope.player = player;
    $scope.dealer = {};
    $scope.showIntro();
  });
  //Informs the player that they have the option to insure against a dealers blackjack
  socket.on("insure", function(){
    $scope.insurance();
  });
});
