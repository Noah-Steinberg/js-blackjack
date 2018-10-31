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
  $scope.player = {};
  $scope.dealer = {};
  $scope.hideSplitButton = {'visibility': 'visible'};
  $scope.hideSplitHand = {'visibility': 'hidden'};
  $scope.started = false;
  $scope.HNDchips = 0;
  $scope.FTYchips = 0;
  $scope.TFchips = 0;
  $scope.FVchips = 0;

  $scope.bet = function(amount) {
    console.log(`Attempting to bet ${amount}`);
    socket.emit("bet", amount);
  }

  $scope.resetBet = function(amount){
    console.log(`Resetting bet to 0`);
    socket.emit("resetBet");
  }

  $scope.splitHand = function() {
    console.log("Sending 'split' request");
    socket.emit("split")
  };

  $scope.hit = function() {
    console.log("Sending 'hit' request");
    socket.emit("hit");
  };

  $scope.stay = function() {
    console.log("Sending 'stay' request");
    socket.emit("stay");
  };

  $scope.hitSplit = function() {
    console.log("Sending 'hit' request for split hand");
    socket.emit("hitSplit");
  };

  $scope.staySplit = function() {
    console.log("Sending 'stay' request for split hand");
    socket.emit("staySplit");
  };

  $scope.newGame = function() {
    console.log("Sending 'new game' request");
    socket.emit("newGame");
  };

  socket.on("endGame", function(data) {
    console.log(`Recieved end game signal. Winner is:`)
    console.log(data);
    $scope.inProgress = false;
    if(data.includes(1)){
      console.log("dealer");
      $scope.dealer.winner = true;
    }
    if(data.includes(2)){
      console.log("player");
      $scope.player.winner = true;
    }
    if(data.includes(3)){
      console.log("player split hand");
      $scope.player.splitWinner = true;
    }
  });

  // when an action is complete, refresh the data
  socket.on("refresh", function(data) {
    $scope.started = true;
    console.log(`Recieved game state update:`)
    console.log(data);
    $scope.inProgress = true;
    $scope.dealer = data.dealer;
    $scope.player = data.me;
    if($scope.player.canSplit){
      $scope.hideSplitButton = {'visibility': 'visible'};
      $scope.hideSplitHand = {'visibility': 'hidden'};
    }
    if($scope.player.split.length > 0){
      $scope.hideSplitButton = {'visibility': 'hidden'};
      $scope.hideSplitHand = {'visibility': 'visible'};
    }
  });
  socket.on("updateBet", function(data) {
    $scope.player = data;
    bet = $scope.player.bet;
    $scope.HNDchips = Math.floor(bet/100);
    bet = bet % 100;

    $scope.FTYchips = Math.floor(bet/50);
    bet = bet % 50;

    $scope.TFchips = Math.floor(bet/25);
    bet = bet % 25;

    $scope.FVchips = Math.floor(bet/25);
    bet = bet % 25;
  });

  socket.on("connected", function(debug, player) {
    console.log("Connection Established");
    $scope.debug = debug;
    $scope.inProgress = false;
    $scope.player = player;
  });

});
