# js-poker-game
This a poker game created using socket.io and angular js.
There is a selenium testing example available at java-poker-test
Noah Steinberg 100975796

Program Execution format:

	"node app.js" for default settings
	"node app.js true true example.txt" to load starting hands from 'example.txt' and to turn debug mode and rigged mode on.

	Debug mode allows seeing of cards (ai will still view cards as 'hidden' for purpose of strategy),
		scores, manual input of cards, etc. (for testing strategy)
	Rigged mode forces all players to stay. (for testing final value calculations)

	When forcing input of cards, it does not use the deck, and can therefore cheat further.

	Parameters must be added in given order, as each one is dependent on the previous ones being set.

	See example.txt for card file formatting.
	Furthermore, if manually inputting card values, please be aware of how the UI does not ask for all players cards sequentially.
		For example (when asking for AI cards) It may ask for Player 1's Card, Player 3's Card, Player 2's, then another one for Player 1.

	For the number of players, you can have as many as you want, but keep in mind that any more than 4 total players may 
		result in unexpected/crash behaviour if the deck runs out of cards.

	Dealer always follows AIstrategy 2, and goes last out of the AIs.


Using the program:
	Simply click 'exchange' to exchange your cards and then 'stay' to see the results.
	Manual card input will appear as a prompt for the most recent user to join the game.
	Overall: Avoid debug and rigged mode with more than 1 human player