// Require the packages we will use:
var http = require("http"),
	socketio = require("socket.io"),
	fs = require("fs");
 
// Listen for HTTP connections.  This is essentially a miniature static file server that only serves our one file, client.html:
var app = http.createServer(function(req, resp){
	// This callback runs when a new connection is made to our HTTP server.
 
	fs.readFile("client.html", function(err, data){
		// This callback runs when the client.html file has been read from the filesystem.
 
		if(err) return resp.writeHead(500);
		resp.writeHead(200);
		resp.end(data);
	});
});
app.listen(3456);
 
// Do the Socket.IO magic:
var io = socketio.listen(app);

var chatRoomList = {};

var userList = {};

io.sockets.on("connection", function(socket){
	// This callback runs when a new Socket.IO connection is established.
 
	socket.on('message_to_server', function(data) {
		// This callback runs when the server receives a new message from the client.
 
		console.log("message: "+data["message"]); // log it to the Node.JS output
		io.sockets.emit("message_to_client",{roomname: data["roomname"], username : data["username"], message:data["message"]}) // broadcast the message to other users
	});
	
	socket.on('privateMessage', function(data) {
		// This callback runs when the server receives a new private message from the client.
 
		console.log("message: "+data["message"]); // log it to the Node.JS output
		io.sockets.emit("privateMessageResult",{roomname: data["roomname"], username : data["username"], message:data["message"], receiver:data["receiver"]}) // broadcast the message to other users
	});
	
	socket.on("join", function(name){
		//beta 0.7
		if (name != null) {
			if (name in userList) {
				//console.log("Repeat Username: " + name);
				//console.log("userList" + userList);
				socket.emit("repeatUsername", name);
			} else{
				userList[name] = true;
				//console.log("New user: " + name);
				//console.log("userList" + userList);
				socket.emit("loginSuccess", name);
				var roomListForUser = {};
				for (var i in chatRoomList){	
					if (chatRoomList[i].password != "") {
						roomListForUser[i] = {"host": chatRoomList[i].host, "password": true, "users":chatRoomList[i].users};
					} else{
						roomListForUser[i] = {"host": chatRoomList[i].host, "password": false, "users":chatRoomList[i].users};
					}
				}
				socket.emit("updateChatRoomList", roomListForUser);
			}
		}	
	});
	
	//socket.on("updateRoomlists", function(name){
	//	socket.emit(name, chatRoomList);
	//});
	

	socket.on("onlyUpdataChatRoomList", function(name){
		//beta 0.7
		if (name != null) {
			var roomListForUser = {};
			for (var i in chatRoomList){
				if (chatRoomList[i].password != "") {
					roomListForUser[i] = {"host": chatRoomList[i].host, "password": true, "users":chatRoomList[i].users};
				} else{
					roomListForUser[i] = {"host": chatRoomList[i].host, "password": false, "users":chatRoomList[i].users};
				}
			}
			socket.emit("updateChatRoomList", roomListForUser);
		}
	});
	
	//beta 0.7
	socket.on("compareChatRoomRights", function(data){
		//console.log(data["username"]+" try to get in " +data["roomname"]);
		//console.log(chatRoomList[data["roomname"]].banList);
		//console.log(chatRoomList[data["roomname"]].banList.indexOf(data["username"]));
		//beta 0.8
		var host = "";
		if (chatRoomList[data["roomname"]].password == "") {
			if (chatRoomList[data["roomname"]].banList.indexOf(data["username"]) != -1) {
				socket.emit("chatRoomRightsConfirm", {message: "User in the BanList.", rights: false, roomname: data["roomname"]});
			} else {
				socket.emit("chatRoomRightsConfirm", {message: "Access approved.", rights: true, roomname: data["roomname"]});
				if (data["username"] == chatRoomList[data["roomname"]].host) {
					host = " host ";
				}
				io.sockets.emit("SystemAnnouncement", {message: host + data["username"] +" joins the chat room.", type: "In&Out", roomname: data["roomname"]});
			}
		} else{
			//beta 0.7
			if (data["password"] == chatRoomList[data["roomname"]].password) {
				
				if (chatRoomList[data["roomname"]].banList.indexOf(data["username"]) != -1) {
					socket.emit("chatRoomRightsConfirm", {message: "User in the BanList.", rights: false, roomname: data["roomname"]});
				} else {
					socket.emit("chatRoomRightsConfirm", {message: "Access approved.", rights: true, roomname: data["roomname"]});
					if (data["username"] == chatRoomList[data["roomname"]].host) {
						host = "Host ";
					}
					io.sockets.emit("SystemAnnouncement", {message: host + data["username"] +" joins the chat room.", type: "In&Out", roomname: data["roomname"]});
				}				
			} else {
				socket.emit("chatRoomRightsConfirm", {message: "Password Invalid.", rights: false, roomname: data["roomname"]});
			}
		}
	
	});
	
	
	socket.on("userLogout", function(name){
		delete userList[name];
		//deta 0.7
		for (var i in chatRoomList) {
			var index = chatRoomList[i].users.indexOf(name);
			if (index > -1) {
				chatRoomList[i].users.splice(index, 1);
				//beta 0.8
				var roomname = i;
			}
		}
		socket.emit("logoutSuccess", name);
		//beta 0.8
		var users = chatRoomList[roomname].users;
		var host = chatRoomList[roomname].host;
		var banList = chatRoomList[roomname].banList;		
		socket.broadcast.emit("sidebarResult", host, users, banList);
	});
	
	//io.sockets.emit("checkUserAlive", userList);
	
	socket.on("newRoom", function(host, roomname, pwd){
		if (roomname in chatRoomList) {
			socket.emit("newRoomResult", false, "This name is already taken", roomname);
		}else{
			chatRoomList[roomname] = {"host" : host, "password" : pwd, "users": [], "banList": []};
			//chatRoomList[roomname].users.push(host);
			console.log(chatRoomList);
			io.sockets.emit("newRoomResult", true, "Successful", roomname, host);
			//beta 0.8
			io.sockets.emit("SystemAnnouncement", {message: "Host " + host +" joins the chat room.", "type": "In&Out", "roomname": roomname});
		}
	});
	
	socket.on("getInChatRoom", function(roomname, username){
		if (!(username in chatRoomList[roomname].users)) {
			chatRoomList[roomname].users.push(username);
		}
		
		io.sockets.emit("updateCurrentRoomUserList", roomname);
	});
	
	socket.on("leaveRoom", function(username, roomname){
		//beta 0.7
		if (chatRoomList.hasOwnProperty(roomname)) {
			var index = chatRoomList[roomname].users.indexOf(username);
			if (index > -1) {
				chatRoomList[roomname].users.splice(index, 1);
			}
			io.sockets.emit("leaveResult", roomname);
			var host ="";
			if (username == chatRoomList[roomname].host) {
				host = "Host ";
			}
			io.sockets.emit("SystemAnnouncement", {message: host + username +" leaves the chat room.", type: "In&Out", "roomname": roomname});
		}
		
	});
	
	socket.on("destroyRoom", function(roomname, username){
		if (username != chatRoomList[roomname].host) {
			socket.emit("destroyRoomResult", false, "You are not allowed to do so");
		}else if (username == chatRoomList[roomname].host && chatRoomList[roomname].users.length == 1) {
			var host = chatRoomList[roomname].host;
			delete chatRoomList[roomname];
			io.sockets.emit("destroyRoomResult", true, "Successful", host);
		}else{
			socket.emit("destroyRoomResult", false, "You need to kick out current users first");
		}
	});

	
	socket.on("sidebarList", function(roomname){
		var users = chatRoomList[roomname].users;
		var host = chatRoomList[roomname].host;
		var banList = chatRoomList[roomname].banList;
		socket.emit("sidebarResult", host, users, banList);
	});
	
	socket.on("kick", function(userSelected, roomname){
		//beta 0.7
		if (chatRoomList.hasOwnProperty(roomname)) {
		var index = chatRoomList[roomname].users.indexOf(userSelected);
		if (index > -1) {
			chatRoomList[roomname].users.splice(index, 1);
		}
		io.sockets.emit("kickResult", userSelected, roomname);
		//beta 1.0
		io.sockets.emit("SystemAnnouncement", {message: userSelected +" has been kicked out.", type: "In&Out", "roomname": roomname});
		}
	});
	
	socket.on("ban", function(userSelected, roomname){
		//beta 0.7
		if (chatRoomList.hasOwnProperty(roomname)) {
		
		var index = chatRoomList[roomname].users.indexOf(userSelected);
		if (index > -1) {
			chatRoomList[roomname].users.splice(index, 1);
		}
		chatRoomList[roomname].banList.push(userSelected);
		io.sockets.emit("banResult", userSelected, roomname);
		//beta 1.0
		io.sockets.emit("SystemAnnouncement", {message: userSelected +" has been banned.", type: "In&Out", "roomname": roomname});
		}
	});
	
	socket.on("unban", function(userSelected, roomname){
		//beta 0.7
		if (chatRoomList.hasOwnProperty(roomname)) {
		
		var index = chatRoomList[roomname].banList.indexOf(userSelected);
		if (index > -1) {
			chatRoomList[roomname].banList.splice(index, 1);
		}
		io.sockets.emit("unbanResult", userSelected, roomname);
		}
	});
});

