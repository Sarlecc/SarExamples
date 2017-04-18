//new property level
Object.defineProperty(Game_Enemy.prototype, 'level', {
    get: function() {
        return this._level;
    },
    configurable: true
});

Game_Enemy.prototype.initMembers = function() {
    Game_Battler.prototype.initMembers.call(this);
    this._enemyId = 0;
    this._letter = '';
    this._plural = false;
    this._screenX = 0;
    this._screenY = 0;
    // new initialized variables
    this._classId = 0;
    this._level = 0;
    this._exp = {};
    this._skills = [];
    this._equips = [];
};

Game_Enemy.prototype.setup = function(enemyId, x, y) {
    var enemy = $dataEnemies[enemyId];
    this._classId = enemy.classId; // Will need a place in the editor to set class
    this._level   = enemy.initialLevel; // Will need a place in the editor to set initial level
    
    this._enemyId = enemyId;
    this._screenX = x;
    this._screenY = y;
    
    this.initExp();
    this.initEquips(enemy.equips);
    
    this.recoverAll();
};

//new function expForLevel
Game_Enemy.prototype.expForLevel = function(level) {
    var c = this.currentClass();
    var basis = c.expParams[0];
    var extra = c.expParams[1];
    var acc_a = c.expParams[2];
    var acc_b = c.expParams[3];
    return Math.round(basis*(Math.pow(level-1, 0.9+acc_a/250))*level*
            (level+1)/(6+Math.pow(level,2)/50/acc_b)+(level-1)*extra);
};

//new function initExp
Game_Enemy.prototype.initExp = function() {
    this._exp[this._classId] = this.currentLevelExp();
};

//new function currentExp
Game_Enemy.prototype.currentExp = function() {
    return this._exp[this._classId];
};

//new function currentLevelExp
Game_Enemy.prototype.currentLevelExp = function() {
    return this.expForLevel(this._level);
};

//new function nextLevelExp
Game_Enemy.prototype.nextLevelExp = function() {
    return this.expForLevel(this._level + 1);
};

//new function nextRequiredExp
Game_Enemy.prototype.nextRequiredExp = function() {
    return this.nextLevelExp() - this.currentExp();
};

//new function maxLevel
Game_Enemy.prototype.maxLevel = function() {
    return this.enemy().maxLevel;
};

//new function isMaxLevel
Game_Enemy.prototype.isMaxLevel = function() {
    return this._level >= this.maxLevel();
};

//new function initSkills
Game_Enemy.prototype.initSkills = function() {
    this._skills = [];
    this.currentClass().learnings.forEach(function(learning) {
        if (learning.level <= this._level) {
            this.learnSkill(learning.skillId);
        }
    }, this);
};

//new function initEquips
Game_Enemy.prototype.initEquips = function(equips) {
    var slots = this.equipSlots();
    var maxSlots = slots.length;
    this._equips = [];
    for (var i = 0; i < maxSlots; i++) {
        this._equips[i] = new Game_Item();
    }
    for (var j = 0; j < equips.length; j++) {
        if (j < maxSlots) {
            this._equips[j].setEquip(slots[j] === 1, equips[j]);
        }
    }
    this.releaseUnequippableItems(true);
    this.refresh();
};

//new function equipSlots
Game_Enemy.prototype.equipSlots = function() {
    var slots = [];
    for (var i = 1; i < $dataSystem.equipTypes.length; i++) {
        slots.push(i);
    }
    if (slots.length >= 2 && this.isDualWield()) {
        slots[1] = 1;
    }
    return slots;
};

//new function equips
Game_Enemy.prototype.equips = function() {
    return this._equips.map(function(item) {
        return item.object();
    });
};

//new function weapons
Game_Enemy.prototype.weapons = function() {
    return this.equips().filter(function(item) {
        return item && DataManager.isWeapon(item);
    });
};

//new function armors
Game_Enemy.prototype.armors = function() {
    return this.equips().filter(function(item) {
        return item && DataManager.isArmor(item);
    });
};

//new function hasWeapon
Game_Enemy.prototype.hasWeapon = function(weapon) {
    return this.weapons().contains(weapon);
};

//new function hasArmor
Game_Enemy.prototype.hasArmor = function(armor) {
    return this.armors().contains(armor);
};

//new function isEquipChangeOk
Game_Enemy.prototype.isEquipChangeOk = function(slotId) {
    return (!this.isEquipTypeLocked(this.equipSlots()[slotId]) &&
            !this.isEquipTypeSealed(this.equipSlots()[slotId]));
};

//new function changeEquip
Game_Enemy.prototype.changeEquip = function(slotId, item) {
    if (this.tradeItemWithTroop(item, this.equips()[slotId]) &&
            (!item || this.equipSlots()[slotId] === item.etypeId)) {
        this._equips[slotId].setObject(item);
        this.refresh();
    }
};

//new function forceChangeEquip
Game_Enemy.prototype.forceChangeEquip = function(slotId, item) {
    this._equips[slotId].setObject(item);
    this.releaseUnequippableItems(true);
    this.refresh();
};

//new function tradeItemWithTroop TODO see if this function could be useful
/*Game_Troop would at least need the following functions
 * hasItem(arg)
 * gainItem(arg, arg2)
 * loseItem(arg, arg2)
 */
Game_Enemy.prototype.tradeItemWithTroop = function(newItem, oldItem) {
    if (newItem && !$gameTroop.hasItem(newItem)) {
        return false;
    } else {
        $gameTroop.gainItem(oldItem, 1);
        $gameTroop.loseItem(newItem, 1);
        return true;
    }
};

//new function changeEquipById
Game_Enemy.prototype.changeEquipById = function(etypeId, itemId) {
    var slotId = etypeId - 1;
    if (this.equipSlots()[slotId] === 1) {
        this.changeEquip(slotId, $dataWeapons[itemId]);
    } else {
        this.changeEquip(slotId, $dataArmors[itemId]);
    }
};

//new function isEquipped
Game_Enemy.prototype.isEquipped = function(item) {
    return this.equips().contains(item);
};

//new function discardEquip
Game_Enemy.prototype.discardEquip = function(item) {
    var slotId = this.equips().indexOf(item);
    if (slotId >= 0) {
        this._equips[slotId].setObject(null);
    }
};

//new function releaseUnequippableItems
Game_Enemy.prototype.releaseUnequippableItems = function(forcing) {
    for (;;) {
        var slots = this.equipSlots();
        var equips = this.equips();
        var changed = false;
        for (var i = 0; i < equips.length; i++) {
            var item = equips[i];
            if (item && (!this.canEquip(item) || item.etypeId !== slots[i])) {
                if (!forcing) {
                    this.tradeItemWithTroop(null, item);
                }
                this._equips[i].setObject(null);
                changed = true;
            }
        }
        if (!changed) {
            break;
        }
    }
};

//new function clearEquipments
Game_Enemy.prototype.clearEquipments = function() {
    var maxSlots = this.equipSlots().length;
    for (var i = 0; i < maxSlots; i++) {
        if (this.isEquipChangeOk(i)) {
            this.changeEquip(i, null);
        }
    }
};

//new function isSkillWtypeOk
Game_Enemy.prototype.isSkillWtypeOk = function(skill) {
    var wtypeId1 = skill.requiredWtypeId1;
    var wtypeId2 = skill.requiredWtypeId2;
    if ((wtypeId1 === 0 && wtypeId2 === 0) ||
            (wtypeId1 > 0 && this.isWtypeEquipped(wtypeId1)) ||
            (wtypeId2 > 0 && this.isWtypeEquipped(wtypeId2))) {
        return true;
    } else {
        return false;
    }
};

//new function isWtypeEquipped
Game_Enemy.prototype.isWtypeEquipped = function(wtypeId) {
    return this.weapons().some(function(weapon) {
        return weapon.wtypeId === wtypeId;
    });
};

//adds releaseUnequippableItems to refresh function
Game_Enemy.prototype.refresh = function() {
    this.releaseUnequippableItems(false);
    Game_Battler.prototype.refresh.call(this);
};

//new function currentClass
Game_Enemy.prototype.currentClass = function() {
    return $dataClasses[this._classId];
};

//new function isClass
Game_Enemy.prototype.isClass = function(gameClass) {
    return gameClass && this._classId === gameClass.id;
};

//changed function traitObjects
Game_Enemy.prototype.traitObjects = function() {
    var objects = Game_Battler.prototype.traitObjects.call(this);
    objects = objects.concat([this.enemy(), this.currentClass()]);
    var equips = this.equips();
    for (var i = 0; i < equips.length; i++) {
        var item = equips[i];
        if (item) {
            objects.push(item);
        }
    }
    return objects;
};

//new function attackElements
Game_Enemy.prototype.attackElements = function() {
    var set = Game_Battler.prototype.attackElements.call(this);
    if (this.hasNoWeapons() && !set.contains(this.bareHandsElementId())) {
        set.push(this.bareHandsElementId());
    }
    return set;
};

//new function hasNoWeapons
Game_Enemy.prototype.hasNoWeapons = function() {
    return this.weapons().length === 0;
};

//new function bareHandsElementId
Game_Enemy.prototype.bareHandsElementId = function() {
    return 1;
};

//new function paramMax
Game_Enemy.prototype.paramMax = function(paramId) {
    if (paramId === 0) {
        return 99999;    // MHP
    }
    return Game_Battler.prototype.paramMax.call(this, paramId);
};

//new function paramBase
Game_Enemy.prototype.paramBase = function(paramId) {
    return this.currentClass().params[paramId][this._level];
};

//new function paramPlus
Game_Enemy.prototype.paramPlus = function(paramId) {
    var value = Game_Battler.prototype.paramPlus.call(this, paramId);
    var equips = this.equips();
    for (var i = 0; i < equips.length; i++) {
        var item = equips[i];
        if (item) {
            value += item.params[paramId];
        }
    }
    return value;
};

//Overwritten exp
Game_Enemy.prototype.exp = function() {
    return this.enemy().exp + this.extraExp();
};

//Overwritten gold
Game_Enemy.prototype.gold = function() {
    return this.enemy().gold + this.extraGold();
};

//new function extraExp
Game_Enemy.prototype.extraExp = function() {
    return this.enemy().extraExp; //this could be a formula for example
};

//new function extraGold
Game_Enemy.prototype.extraGold = function() {
    return this.enemy().extraGold; // this could be a formula for example
};

//new function changeExp
Game_Enemy.prototype.changeExp = function(exp) {
    this._exp[this._classId] = Math.max(exp, 0);
    var lastLevel = this._level;
    var lastSkills = this.skills();
    while (!this.isMaxLevel() && this.currentExp() >= this.nextLevelExp()) {
        this.levelUp();
    }
    while (this.currentExp() < this.currentLevelExp()) {
        this.levelDown();
    }
    this.refresh();
};

//new function levelUp
Game_Enemy.prototype.levelUp = function() {
    this._level++;
    this.currentClass().learnings.forEach(function(learning) {
        if (learning.level === this._level) {
            this.learnSkill(learning.skillId);
        }
    }, this);
};

//new function levelDown
Game_Enemy.prototype.levelDown = function() {
    this._level--;
};

//new function findNewSkills
//NOTE that currently enemies have conditions for skills how would that work with the new system??
Game_Enemy.prototype.findNewSkills = function(lastSkills) {
    var newSkills = this.skills();
    for (var i = 0; i < lastSkills.length; i++) {
        var index = newSkills.indexOf(lastSkills[i]);
        if (index >= 0) {
            newSkills.splice(index, 1);
        }
    }
    return newSkills;
};

//new function gainExp
//NOTE that actors currently don't give exp so then how will enemies gain the exp?
Game_Enemy.prototype.gainExp = function(exp) {
    var newExp = this.currentExp() + Math.round(exp * this.finalExpRate());
    this.changeExp(newExp);
};

//new function finalExpRate
Game_Enemy.prototype.finalExpRate = function() {
    return this.exr;
};

//new function changeLevel
Game_Enemy.prototype.changeLevel = function(level, show) {
    level = level.clamp(1, this.maxLevel());
    this.changeExp(this.expForLevel(level), show);
};

//new function learnSkill
Game_Enemy.prototype.learnSkill = function(skillId) {
    if (!this.isLearnedSkill(skillId)) {
        this._skills.push(skillId);
        this._skills.sort(function(a, b) {
            return a - b;
        });
    }
};

//new function forgetSkill
Game_Enemy.prototype.forgetSkill = function(skillId) {
    var index = this._skills.indexOf(skillId);
    if (index >= 0) {
        this._skills.splice(index, 1);
    }
};

//new function isLearnedSkill
Game_Enemy.prototype.isLearnedSkill = function(skillId) {
    return this._skills.contains(skillId);
};

//new function changeClass
Game_Enemy.prototype.changeClass = function(classId, keepExp) {
    if (keepExp) {
        this._exp[classId] = this._exp();
    }
    this._classId = classId;
    this.changeExp(this._exp[this._classId] || 0, false);
    this.refresh();
};
