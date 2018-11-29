

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
          console.log(data);
          console.log(callback);
          socket.emit(eventName, data, callback);
        }
  };
}]);

blackJackApp.config(['$routeProvider', '$mdThemingProvider', function($routeProvider, $mdThemingProvider) {
  $routeProvider.when('/', {
    templateUrl: '/',
    controller: 'mainController'
  });

  $mdThemingProvider.theme('default').primaryPalette('grey').accentPalette('blue');

}]);

blackJackApp.controller('mainController', function($scope, $mdDialog, socket) {
  $scope.player = {};
  $scope.dealer = {};
  $scope.started = false;
  $scope.cardBack = "cardBack_red2.png";
  $scope.winnings = 0;

  $scope.showIntro = function(ev) {
    $mdDialog.show({
      controller: DialogController,
      templateUrl: 'alerts/intro.ejs',
      parent: angular.element(document.body),
      targetEvent: ev,
      clickOutsideToClose:true,
      fullscreen: $scope.customFullscreen // Only for -xs, -sm breakpoints.
    })
  };

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

  $scope.login = function(ev) {
    //TODO
  };

  callback = function(message, alert_user=false){
    if(alert_user){
      $scope.message = message;
      $scope.showMessage();
    }
    else{
      console.log(message);
    }
  };

  $scope.bet = function(amount) {
    if($scope.inProgress){
      return;
    }
    console.log(`Attempting to bet ${amount}`);
    socket.emit("bet", amount, callback);
  };

  $scope.resetBet = function(){
    console.log(`Resetting bet to 0`);
    socket.emit("resetBet", undefined, callback);
  };

  $scope.insurance = function(){
    console.log(`Insuring player`);
    socket.emit("insurance", undefined, callback);
  }

  $scope.splitHand = function() {
    console.log("Sending 'split' request");
    socket.emit("split", undefined, callback);
  };

  $scope.hit = function(split) {
    console.log("Sending 'hit' request");
    socket.emit("hit", split, callback);
  };

  $scope.stay = function(split) {
    console.log("Sending 'stay' request");
    socket.emit("stay", split, callback);
  };

  $scope.double = function() {
    console.log("Sending 'double' request");
    socket.emit("double", undefined, callback);
  };

  $scope.newGame = function() {
    console.log("Sending 'new game' request");
    socket.emit("newGame");
  };

  socket.on("endGame", function(data) {
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

  $scope.showIntro();
});
