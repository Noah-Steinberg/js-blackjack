

var blackJackApp = angular.module('blackJackApp', ['ngRoute', 'ngMaterial']);

function DialogController($scope, $mdDialog) {

  $scope.cancel = function() {
    $mdDialog.cancel();
  };
  $scope.choose = function(choose) {
    $mdDialog.hide(choose);
  };

}

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

blackJackApp.controller('mainController', function($scope, $mdDialog, socket) {
  $scope.player = {};
  $scope.dealer = {};
  $scope.started = false;
  $scope.cardBack = "cardBack_red2.png";
  $scope.winnings = 0;

  $scope.showHelp = function(ev) {
    $mdDialog.show({
      controller: DialogController,
      templateUrl: 'help.ejs',
      parent: angular.element(document.body),
      targetEvent: ev,
      clickOutsideToClose:true,
      fullscreen: $scope.customFullscreen // Only for -xs, -sm breakpoints.
    })
  };

  $scope.showResults = function(ev) {
    $mdDialog.show({
      controller: DialogController,
      scope: $scope.$new(),
      templateUrl: 'results.ejs',
      parent: angular.element(document.body),
      targetEvent: ev,
      clickOutsideToClose:true,
      fullscreen: $scope.customFullscreen // Only for -xs, -sm breakpoints.
    })
  };

  $scope.chooseCardBack = function(ev) {
    $mdDialog.show({
      controller: DialogController,
      templateUrl: 'chooseCardBack.ejs',
      parent: angular.element(document.body),
      targetEvent: ev,
      clickOutsideToClose:true,
      fullscreen: $scope.customFullscreen // Only for -xs, -sm breakpoints.
    })
    .then(function(cardBack) {
      $scope.cardBack = cardBack;
    });
  };

  $scope.login = function(ev) {
    //TODO
  };

  $scope.bet = function(amount) {
    console.log(`Attempting to bet ${amount}`);
    socket.emit("bet", amount);
  }

  $scope.resetBet = function(){
    console.log(`Resetting bet to 0`);
    socket.emit("resetBet");
  }

  $scope.insurance = function(){
    console.log(`Insuring player`);
    socket.emit("insurance");
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

  $scope.double = function() {
    console.log("Sending 'hit' request");
    socket.emit("double");
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
    winner = data['winner'];
    $scope.winnings = data['winnings'];
    $scope.inProgress = false;
    if(winner.includes(1)){
      console.log("dealer win");
      $scope.dealer.winner = true;
    }
    if(winner.includes(2)){
      console.log("player win");
      $scope.player.winner = true;
    }
    if(winner.includes(3)){
      console.log("player split hand win");
      $scope.player.splitWinner = true;
    }
    if(winner.includes(4)){
      console.log("player insurance win");
      $scope.player.insuranceWinner = true;
    }
    if(winner.includes(5)){
      console.log("push");
      $scope.push = true;
    }
    var audio = new Audio('assets/sounds/hit.ogg');
    audio.play();
    $scope.showResults();
    $scope.started = false;
  });

  // when an action is complete, refresh the data
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

  socket.on("updateBet", function(data) {
    if($scope.player.bet!=data.bet){
      var audio = new Audio('assets/sounds/bet.ogg');
      audio.play();
    }
    $scope.player = data;
  });

  socket.on("connected", function(debug, player) {
    console.log("Connection Established");
    $scope.debug = debug;
    $scope.inProgress = false;
    $scope.player = player;
    $scope.dealer = {};
  });

});
