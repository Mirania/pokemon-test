import { Pokemon, effective, Status, Team } from "./pokemon";
import { random, limit } from "./utils";
import { isHit, Move } from "./moves";
import { affinity, Category } from "./types";
import { Effect, createEffect, Trigger, Targeting } from "./effects";
import { movePicker, actionPicker, Action, switchPicker, canSwitch } from "./player";

export type EffectCommand = { effect: Effect, user?: Pokemon, target?: Pokemon };
export type MoveCommand = { move: Move, target: Pokemon };
export type SwitchCommand = { switchedOut: Pokemon, switchedIn: Pokemon };

export class Battle {
    battleSize: number;
    turnNumber: number;
    weather: Weather;
    partyAllies: Pokemon[]; // in party, not in battle
    activeAllies: Pokemon[]; // in battle
    partyEnemies: Pokemon[]; // in party, not in battle
    activeEnemies: Pokemon[]; // in battle
    effectQueue: EffectCommand[]; // may have undefined positions!
    moveQueue: MoveCommand[]; // may have undefined positions!
    switchQueue: SwitchCommand[]; // may have undefined positions!

    /** Battle size: 1 = 1v1, 2 = 2v2, etc. */
    constructor(allies: Pokemon[], enemies: Pokemon[], battleSize: number) {
        this.partyAllies = allies.slice(battleSize, allies.length);
        this.activeAllies = allies.slice(0, battleSize);
        this.partyEnemies = enemies.slice(battleSize, enemies.length);
        this.activeEnemies = enemies.slice(0, battleSize);
        this.weather = Weather.NONE;
        this.battleSize = battleSize;
        this.turnNumber = 1;
        this.effectQueue = [];
        this.moveQueue = [];
        this.switchQueue = [];
    }

    sortBySpeed(): Pokemon[] {
        return [...this.activePokemons()].sort((a,b) => {
            const aSpeed = effective(a.speed, a.speedStage) * 
                (a.status === Status.PARALYZED ? 0.5 : 1);
            const bSpeed = effective(b.speed, b.speedStage) *
                (b.status === Status.PARALYZED ? 0.5 : 1);
            if (aSpeed === bSpeed) return random() >= 0.5 ? -1 : 1; // tie
            return bSpeed - aSpeed;
        });
    }

    addEffect(effect: Effect, user?: Pokemon, target?: Pokemon): void {
        const addedEffect = createEffect(effect);
        const effectCommand = {effect: addedEffect, user, target};
        if (this.effectExists(addedEffect, user, target)) return;

        for (const target of this.getEffectTargets(effectCommand)) 
            addedEffect.onCreation?.(addedEffect, user, target, this);
        this.effectQueue.push(effectCommand);
    }

    effectExists(effect: Effect, user?: Pokemon, target?: Pokemon): boolean {
        // note: this works for effects without targets/users too
        // e.target === target ---> undefined === undefined ---> true
        return this.effectQueue.some(cmd => 
            cmd && cmd.effect.name === effect.name && cmd.user === user && cmd.target === target
        );
    }

    // effects can have 1 or many targets.
    // if no target is defined, effect is assumed to target everyone in the field.
    getEffectTargets(effectCommand: EffectCommand): Pokemon[] {
        if (!effectCommand) return [];
        let targets: Pokemon[];
        const targeting = effectCommand.effect.targeting;

        switch (targeting) {
            case Targeting.SELF:
                targets = [effectCommand.user];
                break;
            case Targeting.SINGLE:
                targets = this.isActive(effectCommand.target) ? [effectCommand.target] : [];
                break;
            case Targeting.ALLIES:
                targets = effectCommand.user.team === Team.ALLY ? this.activeAllies : this.activeEnemies;
                break;
            case Targeting.FOES:
                targets = effectCommand.user.team === Team.ALLY ? this.activeEnemies : this.activeAllies;
                break;
            case Targeting.ALL:
                targets = this.activePokemons();
        }

        // if target is self, doesn't matter if it's dead
        return targeting === Targeting.SELF ? targets : targets.filter(pkmn => pkmn.health > 0);
    }

    // it's ok to run all effects without checking outcome.
    // they are only applied under valid circumstances.
    applyEffect(effectCommand: EffectCommand, index: number, order: Pokemon[]): void {
        if (!effectCommand) return;
        const {effect, user} = effectCommand;

        for (const target of this.getEffectTargets(effectCommand)) {
            if (effect.duration <= 0) effect.onDeletion?.(effect, user, target, this);
            else effect.execute?.(effect, user, target, this);

            // enforce hp limits
            for (const user of this.activePokemons())
                user.health = Math.floor(limit(0, user.health, user.maxHealth));

            this.checkDeath(order);

            console.log(`${effect.name} effect on ${target.name}:`);
            this.printState();
        }

        // remove from effects list by emptying the position
        if (effect.duration <= 0) this.effectQueue[index] = undefined;
    }

    switchPokemon(switchedOut: Pokemon, switchedIn: Pokemon, order: Pokemon[]): Pokemon {
        // apply ability (on switch out)
        switchedOut.ability.onSwitchOut?.(switchedOut.ability, switchedOut, this);

        // apply effects (on switch out)
        for (let i = 0; i < this.effectQueue.length; i++) {
            const effectCommand = this.effectQueue[i];
            if (effectCommand?.effect.trigger === Trigger.ON_SWITCH_OUT)
                this.applyEffect(effectCommand, i, order);
        }

        this.checkDeath(order);
        
        // clear effects that should be cleared on switching out
        for (let i=0; i<this.effectQueue.length; i++) {
            const effectCommand = this.effectQueue[i];
            if (effectCommand?.effect.endOnSwitch && effectCommand?.target === switchedOut)
                this.effectQueue[i] = undefined;
        }

        if (switchedOut.team === Team.ALLY) {
            console.log(`You withdrew ${switchedOut.name}!`);
            console.log(`Go, ${switchedIn.name}!`);
        } else {
            console.log(`${switchedOut.name} was withdrawn!`);
            console.log(`${switchedIn.name} was sent out!`);
        }
        
        // swap spots between field and party
        const activeList = switchedOut.team === Team.ALLY ? this.activeAllies : this.activeEnemies;
        const partyList = switchedOut.team === Team.ALLY ? this.partyAllies : this.partyEnemies;
        activeList[activeList.indexOf(switchedOut)] = switchedIn;
        partyList[partyList.indexOf(switchedIn)] = switchedOut;
        order[order.indexOf(switchedOut)] = switchedIn;

        // apply ability (on switch in)
        switchedIn.ability.onSwitchIn?.(switchedIn.ability, switchedIn, this);

        // apply effects (on switch in)
        for (let i = 0; i < this.effectQueue.length; i++) {
            const effectCommand = this.effectQueue[i];
            if (effectCommand?.effect.trigger === Trigger.ON_SWITCH_IN)
                this.applyEffect(effectCommand, i, order);
        }

        this.checkDeath(order);

        // update move targets so they do not fail
        for (const moveCommand of this.moveQueue) {
            if (moveCommand && moveCommand.target === switchedOut) moveCommand.target = switchedIn;
        }

        return switchedIn;
    }

    init(): void {
        const order = this.sortBySpeed();

        for (const user of order) {
            user.ability.onSwitchIn?.(user.ability, user, this);
        }

        this.printState();

        let state: Outcome;
        do {
            console.log(`---- Turn ${this.turnNumber++} ----------------------`);
        } while ((state = this.turn()) === Outcome.UNDECIDED);

        if (state === Outcome.WIN) console.log("You win!");
        else if (state === Outcome.LOSS) console.log("You're out of Pokemons!");
        else console.log("Got away safely!");
    }

    turn(): Outcome {
        if (this.weather !== Weather.NONE) console.log(`It's ${this.weather}.`);

        // possible early exit (already won/lost)
        const outcome = this.checkVictory();
        if (outcome !== Outcome.UNDECIDED) return outcome;

        const order = this.sortBySpeed();

        // option selection - fight, run, etc.
        this.moveQueue = [];
        this.switchQueue = [];
        for (const user of order) {
            // user is forced to switch
            if (user.health <= 0) {
                const switchCommand = switchPicker(user, this);
                this.switchQueue.push(switchCommand);
                this.moveQueue.push(movePicker(switchCommand.switchedIn, this));
                continue;
            }

            // user is free to choose what to do
            let action = actionPicker(user);

            while (action === Action.SWITCH && !canSwitch(user, this)) {
                console.log("No other Pokemons are in a condition to fight!");
                action = actionPicker(user);
            }

            switch (action) {
                case Action.FIGHT:
                    this.moveQueue.push(movePicker(user, this));
                    this.switchQueue.push(undefined); // create an empty position in the list
                    break;
                case Action.SWITCH:
                    this.moveQueue.push(undefined); // create an empty position in the list
                    this.switchQueue.push(switchPicker(user, this));
                    break;
                case Action.RUN:
                    // early exit
                    return Outcome.ESCAPED;
            }
        }

        // begin turn
        for (let i=0; i<order.length; i++) {
            // if there's a switch pending, do it, otherwise proceed as normal
            const user = this.switchQueue[i] 
                ? this.switchPokemon(this.switchQueue[i].switchedOut, this.switchQueue[i].switchedIn, order) 
                : order[i];
            if (user.health <= 0) continue;

            // apply abilities (start of turn)
            // no checkDeath here. abilities are not expected to KO someone. this can change later
            user.ability.onTurnBeginning?.(user.ability, user, this);

            // apply effects (start of turn)
            for (let i = 0; i < this.effectQueue.length; i++) {
                const effectCommand = this.effectQueue[i];
                if (effectCommand?.target === user && effectCommand?.effect.trigger === Trigger.START_OF_TURN)
                    this.applyEffect(effectCommand, i, order);
            }

            // possible early exit (already won/lost)
            const outcome = this.checkVictory();
            if (outcome !== Outcome.UNDECIDED) return outcome;

            // attempt to perform a move
            if (user.canAttack && this.moveQueue[i]) {
                const {move, target} = this.moveQueue[i];
                
                console.log(`${user.name} used ${move.name}!`);
                move.points--;

                move.onUse?.(move, user, target, this);
                if (isHit(move, user, target)) {
                    this.printEffectiveness(move, target);
                    if (target && target.health > 0) {
                        move.execute(move, user, target, this);
                        target.lastHitBy = {move, attacker: user};
                    }
                    else console.log("But it failed!");
                } else {
                    move.onMiss?.(move, user, target, this);
                    console.log("But it missed!");
                }

                // enforce hp/move limits
                move.points = Math.floor(limit(0, move.points, move.maxPoints ?? move.points));
                user.health = Math.floor(limit(0, user.health, user.maxHealth));
                target.health = Math.floor(limit(0, target.health, target.maxHealth));

                this.checkDeath(order);
                this.printState();

                // possible early exit (already won/lost)
                const outcome = this.checkVictory();
                if (outcome !== Outcome.UNDECIDED) return outcome;
            }
        }

        // apply effects (end of turn)
        for (let i = 0; i < this.effectQueue.length; i++) {
            const effectCommand = this.effectQueue[i];
            if (!effectCommand) continue;

            const {effect} = effectCommand;
            if (effectCommand?.effect.trigger === Trigger.END_OF_TURN)
                this.applyEffect(effectCommand, i, order);

            if (effect.turn !== undefined) effect.turn++;
            effect.duration--;
        }

        // apply abilities (end of turn)
        for (const user of order) {
            if (user.health > 0) {
                user.ability.onTurnEnding?.(user.ability, user, this);
                if (user.ability.turn) user.ability.turn++;
            }
        }

        return this.checkVictory();
    }

    checkDeath(order: Pokemon[]): void {
        for (let i=0; i<order.length; i++) {
            const user = order[i];

            // if 0 hp but not fainted, we haven't yet processed onDeath events for them
            if (user.health <= 0 && user.status !== Status.FAINTED) {
                console.log(`${user.name} fainted!`);    
                user.status = Status.FAINTED;

                // apply effects (on death)
                for (let i = 0; i < this.effectQueue.length; i++) {
                    const effectCommand = this.effectQueue[i];
                    if (effectCommand?.user === user && effectCommand?.effect.trigger === Trigger.ON_DEATH)
                        this.applyEffect(effectCommand, i, order);
                }

                // apply abilities (on death)
                user.ability.onDeath?.(user.ability, user, this);  
            }
        }
    }

    isActive(pokemon: Pokemon): boolean {
        return pokemon.health >= 0 && this.activePokemons().includes(pokemon);
    }

    activePokemons(): Pokemon[] {
        return [...this.activeAllies, ...this.activeEnemies];
    }

    printEffectiveness(move: Move, target: Pokemon): void {
        if (move.category === Category.STATUS) return;

        const multiplier = affinity(move.type, target.primaryType) * affinity(move.type, target.secondaryType);

        if (multiplier === 0) console.log("But it had no effect!");
        else if (multiplier >= 2) console.log("It's super effective!");
    }

    checkVictory(): Outcome {
        if ([...this.partyAllies, ...this.activeAllies].every(pkmn => pkmn.health <= 0))
            return Outcome.LOSS;
        if ([...this.partyEnemies, ...this.activeEnemies].every(pkmn => pkmn.health <= 0))
            return Outcome.WIN;
        
        return Outcome.UNDECIDED;
    }

    printState(): void {
        for (const pokemon of this.activePokemons()) {
            const id = `${pokemon.name}${pokemon.gender} Lv. ${pokemon.level}`;
            const hp = `${Math.floor(pokemon.health)}/${Math.floor(pokemon.maxHealth)}`;
            console.log(`${id}${" ".repeat(20 - id.length)} [${hp}] ${pokemon.status}`);
        }
    }
}

enum Outcome {
    WIN, UNDECIDED, LOSS, ESCAPED
}

export enum Weather {
    HAIL = "hailing", SUNNY = "very sunny", RAIN = "raining", 
    SANDSTORM = "a dry sandstorm", NONE = ""
}