var config = require("./config.json");
var WebSocket = require("ws");
require("./fix");
var Istrolid = require("./istrolid.js");

const allowedCmds = [
  "playerJoin",
  "mouseMove",
  "playerSelected",
  "setRallyPoint",
  "buildRq",
  "stopOrder",
  "holdPositionOrder",
  "followOrder",
  "selfDestructOrder",
  "moveOrder"
];

global.sim = new Sim();
Sim.prototype.cheatSimInterval = -10;
Sim.prototype.lastSimInterval = 0;
require('./things.js');
require('./istroverse.js');

global.Server = function() {
  var wss = new WebSocket.Server({ port: process.env.PORT || config.port });
  var root = null;

  var players = {};
  var welcome = new Set();

  var lastInfoTime = 0;

  this.send = (player, data) => {
    let packet = sim.zJson.dumpDv(data);
    let client = player.ws;
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(packet);
    }
  };

  this.sendToRoot = data => {
    root.sendData(data);
  };

  this.stop = () => {
    console.log("stopping server");
    wss.close();
    clearInterval(interval);
  };

  this.say = msg => {
    root.sendData([
      "message",
      {
        text: msg,
        channel: config.name,
        color: "FFFFFF",
        name: 'Server',
        server: true
      }
    ]);
  };

  var connectToRoot = () => {
    root = new WebSocket(config.root_addr);

    root.on("open", () => {
      console.log("connected to root");
      sendInfo();
      lastInfoTime = now();

      root.send(JSON.stringify(["registerBot"]));
    });

    root.on("message", msg => {
      const data = JSON.parse(msg);
      if (data[0] === "message") {
        onMessage(data[1]);
      }
    });

    root.on("close", () => {
      console.log("cannot connect to root, retrying");
      setTimeout(connectToRoot, 5000);
    });

    root.on("error", e => {
      console.log("connection to root failed");
    });

    root.sendData = data => {
      if (root.readyState === WebSocket.OPEN) {
        root.send(JSON.stringify(data));
      }
    };
  };

  var sendInfo = () => {
    // Send server info
    let info = {
      name: config.name,
      address: "wss://" + config.addr /*+ ":" + config.port*/,
      observers: sim.players.filter(p => p.connected && !p.ai).length,
      players: sim.players
        .filter(p => p.connected && !p.ai)
        .map(p => {
          return {
            name: p.name,
            side: p.side,
            ai: false
          };
        }),
      type: "[Mod]",
      version: 0,
      state: sim.state
    };
    root.sendData(["setServer", info]);
  };

  connectToRoot();

  wss.on("connection", (ws, req) => {
    console.log("connection from", req.connection.remoteAddress);

    let id = req.headers["sec-websocket-key"];

    ws.on("message", msg => {
      let packet = new DataView(new Uint8Array(msg).buffer);
      let data = sim.zJson.loadDv(packet);
      //console.log(data);
      if (data[0] === "playerJoin") {
        let player = sim.playerJoin(...data);
        player.ws = ws;
        players[id] = player;
        sim.clearNetState();
        if (!welcome.has(player.name)) {
          welcome.add(player.name);
          sim.say('Welcome to Istroverse, ' + player.name + '. This is a custom server featuring a custom gamemode. To learn more, say !help.');
        }
      } else if (allowedCmds.includes(data[0])) {
        sim[data[0]].apply(sim, [players[id], ...data.slice(1)]);
      }
    });

    ws.on("close", e => {
      if (players[id]) {
        players[id].connected = false;
        delete players[id];
      }
    });
  });
  
  let announced = { collapse: false };
  var interval = setInterval(() => {
    let rightNow = now();
    if (sim.lastSimInterval + 1000 / 16 + sim.cheatSimInterval <= rightNow) {
      sim.lastSimInterval = rightNow;

      if (!sim.paused) {
        sim.simulate();
        sim.hasActivePlayers = sim.players.filter(p => p.connected && !p.ai).length > 0;    
        
        if (sim.step % (16 * 60 * 2) === 0 && sim.step < 16 * 60 * 117) window.randomEvent();
        
        if (sim.step === 16 * 60 * 104 && sim.hasActivePlayers === true) sim.say('[WARNING] The safezone will collapse in one minute!');
        if (sim.step === 16 * 60 * 105) events['Safezone Collapse']();
        
        if (sim.step === 16 * 60 * 117 && sim.hasActivePlayers === true) sim.say('[WARNING] A black hole will warp to spawn in one minute!');
        if (sim.step === 16 * 60 * 118) events['Black Hole']();
        
        if (sim.step === 16 * 60 * 119 && sim.hasActivePlayers === true) sim.say('The Istroverse will reset in one minute.');
        if (sim.step >= 16 * 60 * 120) {
          if (sim.hasActivePlayers === true) sim.say('Resetting server...');
          process.exit(0);
        }
      } else {
        sim.startingSim();
      }

      let packet = sim.send();
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN ) {
          client.send(packet);
        }
      });
    }
    if (rightNow - lastInfoTime > 15000) {
      sendInfo();
      lastInfoTime = rightNow;
    }
  }, 17);
};

global.server = new Server();

function onMessage(data) {
  let { text, name, channel } = data;
  if (channel !== config.name) return;
  
  if (text === '!help') {
    sim.say('Istroverse is a FFA gamemode all about mining asteroids, it\'s the safest way to get cash (!asteroids for more info). The other, less safe way to earn money is to destroy enemy ships and collect their scrap. Mined asteroids and scrap must be hauled to marketplaces to be sold, these are marked by the dotted circles. The large purple circle is the safe zone, within it, no enemies can harm you. At the 1 hour & 45 minute mark, the safe zone collapses. The game ends at the 2 hour mark. Type !commands to see commands.');
  }
  else if (text === '!asteroids') {
    sim.say('Asteroids will drop ore upon death, the value of the ore depends on the asteroid type and it\'s size. F-right-click an asteroid with a ship selected to target it. To see an asteroids hp and price, look at it\'s stats with [i].');
  } 
  else if (text === '!time') {
    sim.say(Math.round(sim.step / 16 / 60) + ' minutes has elapsed since game began.');
  }
  else if (text === '!commands' || text === '!command') {
    sim.say('Commands: !help | !asteroids | !time | !commands')
  }
  
  else if (text === '!restart' && name === 'kvx') {
    //sim.say('Restarting...');
    //process.exit(0);
  }
  else if (text === '!event' && name === 'kvx') {
   // window.randomEvent();
  }
  else if (text === '!gimme' && name === 'kvx') {
    //sim.players.filter(p => { return p.name === 'kvx'; })[0].money += 10000;
  }
  else if (text.startsWith('!step') && name === 'kvx') {
    //let n = parseInt(text.split(' ')[1]);
    //sim.say('sim.step set to ' + n);
    //sim.step = n;
  }
}