var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);

var c4games = {};

io.set('log level',1);
server.listen(1234);

app.use(express.compress());
app.use(express.static(__dirname)); // public folder with cache

app.get('/c4', function(req, res) {
	res.sendfile('c4.html');
});

io.sockets.on('connection', function(socket) {
	console.log("friend joined", socket.id);

	socket.emit('connected', { message: "You are connected" });

	socket.on('hostCreateNewGame', hostCreateNewGame);
	socket.on('hostRoomFull', hostPrepareGame);
	//socket.on('hostNextRound', hostNextRound);

	socket.on('playerJoinGame', playerJoinGame);
	socket.on('playerMove', playerMove);

	socket.on('disconnect', disconnection);
	socket.on('unsubscribe', leaveRoom);
});

function leaveRoom(gameId) {
	this.leave(gameId);
};

function disconnection() {
	//console.log('disconnect')
	var sock = this;

	//someone dc'd, tell each of the rooms they're in that they're gone and to end game
	//console.log(sock.manager.rooms);
	for(var key in sock.manager.rooms) {
		if(sock.manager.rooms.hasOwnProperty(key)) {
			if(key !== '') {
				io.sockets.in(key.substring(1)).emit('dc');
			}
		}
	}
};

function hostCreateNewGame() {
	var gameId = ID();
	//console.log(this.id + ' creating new game ' + gameId);

	this.emit('newGameCreated', { gameId: gameId, mySocketId: this.id });

	c4games[gameId] = {};
	c4games[gameId].gameId = gameId;
	c4games[gameId].host = this.id;

	this.join(gameId); // join game room
};

function hostPrepareGame(gameId) {
	//console.log('prepare game');
	var socket = this;
	var data = { // not used?
		host: socket.id,
		gameId: gameId
	};

	var grid = makeArray(6,7, "empty");

	//console.log("Grid:", grid.length, grid[0].length)

	c4games[gameId].grid = grid;
	c4games[gameId].turn = this.id; //host
	c4games[gameId].moves = 0;

	data.turn = this.id;

	//console.log("Players joined ", gameId);
	io.sockets.in(gameId).emit('beginNewGame', data);
};

function playerJoinGame(data) {
	var socket = this;
	//console.log('Player ' + socket.id + ' attempting to join game: ' + data.gameId);

	var room = io.sockets.manager.rooms["/" + data.gameId];

	if(room != undefined) {
		if(room.length > 1) {
			this.emit('error', { message: "This game is full.", type: "room_full" });
			return;
		}
		data.mySocketId = socket.id;
		data.host = room[0];

		c4games[data.gameId].player = socket.id;

		socket.join(data.gameId);

		//console.log('Player ' + socket.id + ' joining game: ' + data.gameId)
		//console.log(room)

		io.sockets.in(data.gameId).emit('playerJoinedRoom', data);
	} else {
		this.emit('error', { message: "This game does not exist.", type: "room_dne" });
	}
};

function playerMove(data) {
	var sock = this;

	if(data.x < 0 || data.x > 6 || data.y < 0 || data.y > 5) {
		this.emit('error', { message: "Your move was invalid.", type: "move_bad" });
		return;
	}

	var game = c4games[data.gameId];

	if(game.turn !== sock.id) {
		sock.emit('error', { message: "It isn't your turn.", type: "move_bad" });
		return;
	}

	var check = true;
	var h = 6;

	while(check && h) {
		h--;
		if(game.grid[data.x][h] === 'empty') check = false;

	}

	if(check) return;

	game.grid[data.x][h] = sock.id;
	//console.log(data.x, h, sock.id);

	var turn = sock.id === game.host ? game.player : game.host;

	game.turn = turn;

	var out = {
		x: data.x,
		y: h,
		id: sock.id,
		turn: turn
	};

	game.moves++;

	io.sockets.in(data.gameId).emit('newMove', out);

	checkWin(game, data.x, h, sock.id);
};

function checkWin(game, x, y, id) {
	var win = false;

	function isMatch(dx, dy) {
		if(win == true) return false; //game is already won, no need to check

		for(i=0; i<4; i++) {
			var cx = x+i*dx; var cy = y+i*dy;

			if(cx < 0 || cx > 6 || cy < 0 || cy > 5)
				return false;

			if(game.grid[cx][cy] !== id)
				return false;
		}

		// if we get to here it means that they all match
		var data = {
			sx: x,
			sy: y,
			ex: x+3*dx,
			ey: y+3*dy,
			winner: id,
			message: "Player " + id + " wins!",
			type: "win" 
		};

		console.log("winner " + id, game.gameId);
		io.sockets.in(game.gameId).emit('gameOver', data)
		return true;
	}

	game.grid.forEach(function(ele, i) {
		ele.forEach(function(e,j) {
			x = i; y = j;
			if(isMatch(1,0) || // right
			isMatch(-1,0) || // left
			isMatch(0,1) || // down
			isMatch(-1,-1) || // nw
			isMatch(1,-1) || // ne
			isMatch(-1,1) || // sw
			isMatch(1,1)) { //se
				win = true;
			}
		});
	});
 
	if(!win && game.move === 42) {
		io.sockets.in(game.gameId).emit('gameOver', { message: "Game ends with a draw!", type: "draw" });
	}
	
};

function ID() {
	return '_' + Math.random().toString(36).substr(2,9);
};

makeArray = function(w, h, val) {
	var arr = [];

	for(i=0; i<h; i++) {
		arr[i] = [];
		for(j=0; j<w; j++) {
			arr[i][j] = val;
		}
	}

	return arr;
};