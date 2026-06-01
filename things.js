
function chooseOne(l) {
  return l[Math.floor(Math.random() * l.length)];
}

types.Ore = (function() { 
  
  Ore.prototype.sendName = 'Rock';
  
  Ore.prototype.ore = true;
  
  function Ore() {
    this.id = typeof sim !== "undefined" && sim !== null ? sim.nid() : void 0;
    this.pos = v2.create();
    this.vel = v2.create();
    this.z = 0;
    this.dead = false;
    this.rot = 0;
    this.radius = 10;
    this.attached = null;
    this.life = 0;
    this.maxLife = 16 * 60 * 4;
    this.sold = false;
  }
  
  Ore.prototype.move = function() {
    if (this.market) return;
    if (this.attached === null) {
      let unitChoices = [];
      sim.findPlayerUnitsInRange(this.pos, this.radius + 500, (function(_this) {
        return function(u) {
          if (v2.distance(u.pos, _this.pos) < _this.radius + u.radius) {
            unitChoices.push(u);
            return true;
          }
        };
      })(this));
      if (unitChoices.length > 0) {
        this.attached = chooseOne(unitChoices);
        this.attached.mass += this.mass;
        v2.sub(this.attached.pos, this.pos, this.vel);
        v2.norm(this.vel);
        v2.scale(this.vel, 5);
      }
    } else {
      if (this.attached.dead) return this.attached = null;
      if (v2.distance(this.attached.pos, this.pos) > this.attached.radius + this.radius) {
        v2.sub(this.attached.pos, this.pos, this.vel);
        v2.norm(this.vel);
        v2.scale(this.vel, Math.max(v2.distance([0, 0], this.attached.vel) * 1.1));
      }
    }
    this.vel[0] *= 0.9;
    this.vel[1] *= 0.9;
    v2.add(this.pos, this.vel);
  };
  
  Ore.prototype.tick = function() {
    if (this.life > this.maxLife) {
      if (this.attached) this.attached.mass -= this.mass;
      return this.dead = true;
    }
    if (!this.market && this.attached) {
      for (let market of sim.markets) {
        if (v2.distance(market.pos, this.pos) < market.radius + 50) {
          this.market = market;
          this.attached.mass -= this.mass;
          break;
        }
      }
    }
    if (this.market) {
      this.pos[0] += (this.market.pos[0] - this.pos[0]) * 0.5;
      this.pos[1] += (this.market.pos[1] - this.pos[1]) * 0.5;
      this.vel = [0, 0];
      this.rot ++;
      this.sendColor = true;
      this.color[3] = this.color[3] * 0.6 - 10;
    }
    if (this.color[3] < 10) {
      this.dead = true;
      let exp = new types.ShipExplosion();
      exp.z = 1000;
      exp.pos = [this.pos[0], this.pos[1]];
      exp.vel = [0, 0];
      exp.rot = 0;
      exp.radius = 80;
      sim.things[exp.id] = exp;
      sim.players[this.attached.owner].money += Math.round(this.cost);
      sim.players[this.attached.owner].score += Math.round(this.cost / 15);
    }
    this.life ++;
  };
  
  return Ore;
  
})()
// unit
types.Asteroid = (function() {
            
  Asteroid.prototype.resource = true;
  
  Asteroid.prototype.sendName = 'Unit';
  
  function Asteroid() {
    this.spec = {parts: [{pos: [0, 0], type: "SymbolDecal1", dir: 0}]};
    this.id = typeof sim !== "undefined" && sim !== null ? sim.nid() : void 0;
    this.side = 'resource';
    this.z = Math.random();
    this.dead = false;
    this.pos = v2.create();
    this.vel = v2.create();
    this.rot = Math.random() * Math.PI * 2;
    this.warpIn = 100;
    this.burn = 0;
    this.shield = 0;
    this.type = 'default';
    this.timer = 0;
    this.maxTimer = Infinity;
  }
  
  Asteroid.prototype.init = function() {
    this.maxHP = this.hp;
    let rock = new types.Rock();
    rock.pos = this.pos;
    rock.z = this.z + 0.0001;
    rock.color = this.color;
    rock.sizeDivisor = 40;
    rock.rot = this.rot;
    rock.imageSize = Math.random();
    if (rock.imageSize < 0.5) rock.image = chooseOne(["img/rocks/mrock01.png", "img/rocks/mrock02.png", "img/rocks/mrock03.png", "img/rocks/mrock04.png", "img/rocks/mrock05.png", "img/rocks/mrock06.png"]);
    else {
      rock.image = chooseOne(["img/rocks/lrock01.png", "img/rocks/lrock02.png", "img/rocks/lrock03.png", "img/rocks/lrock04.png", "img/rocks/lrock05.png"]);
      rock.sizeDivisor = 60;
    }
    rock.size = [this.radius / rock.sizeDivisor, this.radius / rock.sizeDivisor];
    rock['static'] = false;
    if (this.type !== 'meteor') rock.onlySendDead = true;
    sim.things[rock.id] = rock;
    return this.rock = rock;
  };
  
  Asteroid.prototype.cloaked = () => false;
  
  Asteroid.prototype.applyEnergyDamage = function() {};
  
  Asteroid.prototype.applyDamage = function(damage) {
    this.hp -= damage;
    if (this.hp <= 0 && !this.dead) {
      this.dead = true;
      this.rock.dead = true;
      
      let ore = new types.Ore();
      ore.pos = this.pos;
      ore.vel = this.vel;
      ore.color = [this.oreColor[0], this.oreColor[1], this.oreColor[2], 255];
      ore.radius = this.radius * 0.7;
      ore.size = [ore.radius / this.rock.sizeDivisor, ore.radius / this.rock.sizeDivisor];
      ore.rot = this.rock.rot;
      ore.image = this.rock.image;
      ore.cost = this.cost;
      ore.mass = this.mass;
      sim.things[ore.id] = ore;
      
      if (this.spawnData && this.spawnPos) genAsteroid(this.spawnData, this.spawnPos, 1);
    }
  };
  
  Asteroid.prototype.postDeath = function() {
    let exp = new types.ShipExplosion();
    exp.z = 1000;
    exp.pos = [this.pos[0], this.pos[1]];
    exp.vel = [0, 0];
    exp.rot = 0;
    exp.radius = Math.max(this.radius / 10, 50);
    sim.things[exp.id] = exp;
    delete sim.asteroids[this.id];
  };
  
  Asteroid.prototype.move = function() {
    if (this.timer > this.maxTimer) {
      this.rock.dead = true;
      return this.dead = true;
    }
    this.timer ++;
    
    if (sim.step % 16 === 0) {
      if (this.burn > 4) {
        if (this.hp < 4) {
          this.burn = 0;
        }
        let burnTick = this.burn * 0.04;
        this.applyDamage(burnTick);
        this.burn -= burnTick;
      } else {
        this.burn = 0;
      }
    }
    switch(this.type) {
      case 'emp':
        if (!this.randTime) this.randTime = Math.floor(Math.random() * 160);
        if (!this.empField && sim.step > this.randTime) {
          this.empField = new types.EMPField();
          this.empField.pos = this.pos;
          this.empField.z = 10;
          this.empField.radius = 0;
          sim.things[this.empField.id] = this.empField;
        }
        if (this.dead) this.empField.dead = true;
      break;
      case 'meteor':
        if (!this.hitOnce) this.hitOnce = {};
        if (!this.calcVel) {
          this.vel2 = [0, 0];
          v2.sub(this.goToPos, this.pos, this.vel2);
          v2.norm(this.vel2);
          v2.scale(this.vel2, this.speed);
          this.calcVel = true;
        }
        v2.add(this.pos, this.vel2);
        if (!this.randRot) this.randRot = Math.random() - 0.5;
        this.rock.rot += this.randRot * 0.2;
        if (this.dieInSafezone && v2.distance([0, 0], this.pos) < sim.safezone.radius) {
          this.dead = true;
          this.rock.dead = true;
        }
        sim.findPlayerUnitsInRange(this.pos, this.radius + 500, (function(_this) {
        return function(u) {
          if ((!_this.hitOnce[u.id] || _this.repeatDamage) && v2.distance(u.pos, _this.pos) < _this.radius + u.radius) {
            if (u.side !== 'neutral') u.applyDamage(_this.dealDamage);
            _this.hitOnce[u.id] = true;
            v2.sub(u.pos, _this.pos, u.vel);
            v2.norm(u.vel);
            v2.scale(u.vel, _this.pushForce);
          }
        };
      })(this));
      break;
    }
  };
  
  return Asteroid;
  
})();

types.EMPField = (function() {
  
  EMPField.prototype.image = 'img/point02.png';
  
  EMPField.prototype.color = [100, 0, 255, 80];
  
  EMPField.prototype.radius = 0;
  
  EMPField.prototype.sendName = 'Rock';
  
  EMPField.prototype.eDrain = 500 * 4;
  
  EMPField.prototype.maxRadius = 1000;
    
  function EMPField() {
    this.id = sim.nid();
    this.dead = false;
    this.pos = v2.create([0, 0]);
    this.vel = v2.create([0, 0]);
    this.size = [this.radius / 240, this.radius / 240];
    this.rot = 0;
    this.expandRate = 5;
    this.life = 0;
    this.maxLife = 16 * 10;
    this.color = [...this.color];
  }
    
  EMPField.prototype.tick = function() {
    if (this.life > this.maxLife) {
      this.sendColor = true;
      this.color[3] = this.color[3] * 0.9 - 5;
      if (this.color[3] < 10) {
        if (this.maxlifeDeath) return this.dead = true;
        this.color[3] = 80;
        this.life = 0;
        this.radius = 0;
      }
    }
    if (this.radius < this.maxRadius && !this.stopExpanding) this.radius += this.expandRate;
    else if (this.maxlifeDeath) {
      this.radius += Math.cos(this.life / 5) * 5;
      this.stopExpanding = true;
    }
    this.size = [this.radius / 240, this.radius / 240];
    if (this.life % 4 === 0) {
      sim.findPlayerUnitsInRange(this.pos, this.radius + 500, (function(_this) {
        return function(u) {
          if (v2.distance(u.pos, _this.pos) < _this.radius + u.radius) {
            u.applyEnergyDamage(_this.eDrain);
          }
        };
      })(this));
    }
    this.life ++;
  }
  
  return EMPField;
  
})();

types.Safezone = (function() {
    
  Safezone.prototype.image = "img/point02.png";
  
  Safezone.prototype.maxHP = 1000;
    
  Safezone.prototype.color = [255, 0, 255, 100];
  
  Safezone.prototype.radius = 5000;
  
  Safezone.prototype.sendName = 'Rock';
  
  function Safezone() {
    this.id = sim.nid();
    this.dead = false;
    this.hp = this.maxHP;
    this.pos = v2.create([0, 0]);
    this.vel = v2.create([0, 0]);
    this.size = [this.radius / 240, this.radius / 240];
    this.rot = 0;
  }
    
  Safezone.prototype.tick = function() {
    let i, thing, dist;
    for (i in sim.things) {
      thing = sim.things[i];
      if (thing.unit && thing.side !== 'resource') {
        dist = v2.distance(this.pos, thing.pos);
        if (dist < this.radius) {
          if (thing.safeCooldown > 0) {
            v2.sub(thing.pos, this.pos, thing.vel);
            v2.norm(thing.vel);
            v2.scale(thing.vel, thing.maxSpeed);
            continue;
          }
          thing.side = 'neutral';
        }
        else thing.side = thing.owner;
      }
    }
    if (this.collapse === true && this.radius > 1000) {
      this.radius += (990 - this.radius) * 0.1;
      this.size = [this.radius / 240, this.radius / 240];
    }
  };
  
  return Safezone;
  
})();

types.BlackHole = (function() {
    
  BlackHole.prototype.image = "img/fire02.png";
      
  BlackHole.prototype.color = [0, 0, 0, 255];
  
  BlackHole.prototype.radius = 0;
  
  BlackHole.prototype.sendName = 'Rock';
  
  function BlackHole() {
    this.id = sim.nid();
    this.dead = false;
    this.pos = v2.create([0, 0]);
    this.vel = v2.create([0, 0]);
    this.size = [this.radius / 240, this.radius / 240];
    this.rot = 0;
    this.z = 2;
  }
    
  BlackHole.prototype.tick = function() {
    let i, thing, dist;
    for (i in sim.things) {
      thing = sim.things[i];
      if (thing.unit || thing.resource || thing.ore || thing.sizeDivisor) {
        dist = v2.distance(this.pos, thing.pos);
        if (dist < this.radius) thing.dead = true;
        if (thing.unit) {
          let theta = v2.angle(thing.pos) + Math.PI * 0.5;
          thing.vel[0] += Math.cos(theta) * 1 / dist * this.radius;
          thing.vel[1] += Math.sin(theta) * 1 / dist * this.radius;
        }
      }
    }
    this.radius += 4;
    this.size = [this.radius / 25, this.radius / 25];
  };
  
  return BlackHole;
  
})();

function chooseNumber(n) {
  var i, j;
  i = Math.floor(Math.random() * n) + 1;
  j = i.toString();
  if (j.length === 1) {
    return "0" + j;
  }
  return j;
};

types.Unit.prototype.postDeath = function() {
  var j, len, part, ref;
  ref = this.parts;
  for (j = 0, len = ref.length; j < len; j++) {
    part = ref[j];
    if (typeof part.postDeath === "function") {
      part.postDeath();
    }
  }
  if (typeof this.onDeath === "function") this.onDeath();
  if (this.dropOre === false) return sim.deaths += 1;
  if (!this.dropOre) this.dropOre = {};
  let ore = new types.Ore();
  ore.pos = this.dropOre.pos || this.pos;
  ore.color = this.dropOre.color || [120, 120, 120, 255];
  ore.radius = this.dropOre.radius || 80;
  ore.size = this.dropOre.size || [1, 1];
  ore.rot = this.dropOre.rot || Math.random() * Math.PI * 2
  ore.image = this.dropOre.image || 'img/debree/bigdebree' + (chooseNumber(12)) + '.png';
  ore.cost = this.dropOre.cost || this.cost * 0.3;
  ore.mass = this.dropOre.mass || 0
  ore.maxLife = this.dropOre.maxLife || 16 * 60 * 2;
  sim.things[ore.id] = ore;
  return sim.deaths += 1;
};