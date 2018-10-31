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
  $scope.player = {}
  $scope.dealer = {}
  $scope.hideSplitButton = {'visibility': 'hidden'};
  $scope.hideSplitHand = {'visibility': 'hidden'};

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
    console.log(`Recieved game state update:`)
    console.log(data);
    $scope.inProgress = true;
    $scope.dealer = data.dealer;
    $scope.player = data.me;
    if($scope.player.canSplit){
      $scope.hideSplitButton = {'visibility': 'visible'};
    }
    if($scope.player.split.length > 0){
      $scope.hideSplitButton = {'visibility': 'hidden'};
      $scope.hideSplitHand = {'visibility': 'visible'};
    }
  });

  socket.on("connected", function(debug) {
    console.log("Connection Established");
    $scope.debug = debug;
    $scope.inProgress = false;
  });

});
