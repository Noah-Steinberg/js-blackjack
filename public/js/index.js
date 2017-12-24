var blackJackApp = angular.module('blackJackApp', ['ngRoute', 'ngMaterial']);

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
          socket.emit(eventName, data, function () {
            var args = arguments;
            $rootScope.$apply(function () {
              if(callback) {
                callback.apply(socket, args);
              }
            });
          });
        }
  };
}]);

blackJackApp.config(['$routeProvider', '$mdThemingProvider', function($routeProvider, $mdThemingProvider) {
  $routeProvider.when('/', {
    templateUrl: '/',
    controller: 'mainController'
  });

  $mdThemingProvider.theme('default').primaryPalette('pink').accentPalette('light-blue');

}]);

blackJackApp.controller('mainController', function($scope, socket) {
  $scope.hand = [];
  $scope.id = -1;
  $scope.value = 0;
  $scope.myTurn = false;
  $scope.canHit = false;
  $scope.canStay = false;
  $scope.canSplit = false;
  $scope.queued = true;
  $scope.name = "Me";
  $scope.bust = false;
  $scope.logs = "[#] Welcome to Let's Play Poker. Noah's lowsy attempt at a multiplayer Poker! :D";

  var validMove = function(move) {
    return move.indexOf("exchange")!==-1 || move.indexOf("card")!==-1 || move === "stay";
  };

  $scope.makeMove = function(moveType) {
    if (!validMove(moveType))
      return;
    socket.emit("new move", moveType);
  };

  $scope.makeExchange = function() {
    exchange = "exchange";
    cards = []
    for(var i=0;i<5;i++){
      card = document.getElementById(`card-${i}`)
      exchange += "," + (card.getAttribute("style").toString().replace(/\s+/g, '')==="text-align:center;background-color:red;").toString();
    }
    $scope.makeMove(exchange);
  };

  // Listeners/Emitters
  socket.on("new message", function(message) {
    $scope.logs = $scope.logs.concat("\n" + message);
  });

  socket.on("queued", function(me) {
    $scope.queued = true;
  });

  socket.on("endGame", function(data) {
    $scope.dealer = data.dealer;
    $scope.players = data.players;
    $scope.winner = data.me.winner;
  });

  socket.on("begin", function(data){
    $scope.queued = false;
  });

  // when a turn is played, refresh the table data
  socket.on("turnPlayed", function(data) {
    $scope.canExchange = data.me.canExchange;
    $scope.hand = data.me.hand;
    $scope.dealer = data.dealer;
    $scope.players = data.players;
    $scope.myTurn = data.myTurn;
    $scope.value = data.me.value;
    $scope.canHit = data.me.canHit;
    $scope.canStay = true;
    $scope.canSplit = data.me.canSplit;
    $scope.bust = data.me.bust;
    $scope.name = data.me.name;
    $scope.winner = data.me.winner;
  });

  socket.on("needCard", function(player, cards, fn) {
    var card = prompt("Please Enter a Card to Deal to Player No. " + player + " Format: 'rank,suit' ");
    //var card = "A,H";
    fn(player + "," +card, cards);
  });

  socket.on("starting", function(debug, chooseStrat, fn) {
    $scope.debug = debug;
    var ais = chooseStrat ? prompt("Please Enter AI configuration, Format: 'ai1strat,ai2strat...' where each strat is '1' or '2'") : "2,1";
    fn(ais);
  });

});

selectCard = function(card) {
  var check = card.getAttribute("style").toString().replace(/\s+/g, '');
  if (check==="text-align:center;background-color:red;"){
    card.setAttribute("style","text-align:center;");
    return;
  }
  else{
    card.setAttribute("style","text-align:center;background-color:red;");
  }
};

