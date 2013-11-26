var iioMan;

var IO = {
	init: function() {
		IO.socket = io.connect();
		IO.bindEvents();
	},

	bindEvents: function() {
		IO.socket.on('connected', IO.onConnected);
		IO.socket.on('newGameCreated', IO.onNewGameCreated);
		IO.socket.on('playerJoinedRoom', IO.onPlayerJoined);
		IO.socket.on('beginNewGame', IO.onBeginNewGame);
		IO.socket.on('newMove', IO.onNewMove);
		IO.socket.on('gameOver', IO.onGameOver);
		IO.socket.on('error', IO.error);
		IO.socket.on('dc', IO.onDisconnection);
	},

	onDisconnection: function() {
		console.log('disconnection');

		iioMan.rmvAll();
		iio.stop(ConnectFour);
		$("#canvas").addClass("hidden");
		$('#turn').text('');
		$('#gameid').text('Other player disconnected :(');
		$('#me').text('');
		$('#other').text('');
		$('#setup').show();
		IO.socket.emit('unsubscribe', App.gameId);
	},

	onConnected: function() {
		console.log('connected');
		App.mySocketId = IO.socket.socket.sessionid;
	},

	onNewGameCreated: function(data) {
		console.log('new game created');
		App.Host.gameInit(data);
	},

	onPlayerJoined: function(data) {
		console.log('player joined');
		App[App.myRole].updateWaitingScreen(data);
	},

	onBeginNewGame: function(data) {
		console.log('begin new game');

		App.updateTurn(data.turn);
		
		$("#canvas").removeClass("hidden");
		iio.start(ConnectFour, 'canvas');
	},

	onNewMove: function(data) {
		console.log('new move');

		App.updateTurn(data.turn);

		App.drawMove(data);
	},

	onGameOver: function(data) {
		console.log('game over');
		//App[App.myRole].endGame(data);
		if(data.type === 'win') {

			App.drawWinLine(App.grid.getCellCenter(data.sx, data.sy), App.grid.getCellCenter(data.ex, data.ey));
			if(data.winner === App.mySocketId)
				alert("You win!");
			else
				alert("Other dude or dudette won :(");
		} else if(data.type === 'draw')
			alert(data.message);
	},

	error: function(data) {
		alert(data.message);

		if(data.type === "room_dne" || data.type === "room_full")
			$('#setup').show();
	}
};

var App = {
	gameId: '',
	myRole: '', // player / host
	mySocketId: '',
	currentRound: 0,
	myTurn: false,
	grid: {},
	hostSocketId: '',

	init: function() {
		App.cacheElements();
		App.showInitScreen();
		App.bindEvents();
	},

	cacheElements: function() {
		//jquery element shortcuts
		App.$doc = $(document);
	},

	bindEvents: function() {
		// click events etc
		App.$doc.on('click', '#btnCreateGame', App.Host.onCreateClick);

		App.$doc.on('click', '#btnJoinGame', App.Player.onJoinClick);

		App.$doc.on('click', '#canvas', App.makeMove);

	},

	showInitScreen: function() {
	
	},

	drawWinLine: function(s, e) {
		var line = new iio.Line(s,e);
		line.setLineWidth(5);
		iioMan.addObj(line);
	},

	drawMove: function(data) {
		var gridPoint = App.grid.getCellCenter(data.x, data.y);
		var piece = new iio.Circle(gridPoint, 32);

		if(data.id === App.hostSocketId)
			piece.setFillStyle('#9900CC');
		else
			piece.setFillStyle('black');

		iioMan.addObj(piece);
	},

	updateTurn: function(turnId) {
		var $turn = $('#turn');

		if(turnId === App.mySocketId) { //it's my turn
			$turn.text("It's your turn");
			$turn.removeClass("red");
			$turn.addClass("green");
			App.myTurn = true;
		} else { //it's the other guys turn
			$turn.text("It's not your turn");
			$turn.removeClass("green");
			$turn.addClass("red");
			App.myTurn = false;
		}
	},

	makeMove: function(event) {
		var point = iioMan.getEventPosition(event);
		var gridPoint = App.grid.getCellAt(point);

		//console.log(gridPoint);
		gridPoint.gameId = App.gameId;

		if(App.myTurn) IO.socket.emit('playerMove', gridPoint);
	},

	Host: {
		players: [],
		numPlayersInRoom: 0,

		onCreateClick: function() {
			IO.socket.emit('hostCreateNewGame');
			$('#setup').hide();
		}, 

		gameInit: function(data) {
			App.gameId = data.gameId;
			App.mySocketId = data.mySocketId;
			App.myRole = 'Host';
			App.Host.numPlayersInRoom = 1;
			App.hostSocketId = data.mySocketId;

			console.log("Game started with ID: " + App.gameId + " by host: " + App.mySocketId);
			App.Host.displayNewGameScreen();
		},

		displayNewGameScreen: function() {
			$('#gameid').text(App.gameId);
			$('#me').text("I am the Host: " + App.mySocketId);
		}, 

		updateWaitingScreen: function(data) {
			$('#other').text('Other guy is the player: ' + data.mySocketId);

			App.Host.players.push(data);

			IO.socket.emit('hostRoomFull', App.gameId);
		}
	},

	Player: {
		onJoinClick: function() {
			var data = {
				gameId: $('#inputGameId').val(),
			};

			IO.socket.emit('playerJoinGame', data);

			App.myRole = 'Player';

			$('#setup').hide();
		}, 

		updateWaitingScreen: function(data) {
			if(IO.socket.socket.sessionid === data.mySocketId) {
				App.myRole = 'Player';
				App.gameId = data.gameId;
				App.hostSocketId = data.host;

				$('#gameid').text(App.gameId);
				$('#me').text("I am the " + App.myRole + ": " + App.mySocketId);
				$('#other').text('Other guy is the host: ' + data.host);
			}
		}
	}
};

IO.init();
App.init();

function ConnectFour(iioAppManager) {
	iioMan = iioAppManager;
	iioMan.setFramerate(30, function() {
		//stuff
	});

	App.grid = new iio.Grid(0,0, 7, 6, 80, 80);
	iioMan.addObj(App.grid);
};