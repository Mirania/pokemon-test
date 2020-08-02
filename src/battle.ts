import { Pokemon, noMoves, effective, Status, Team } from "./pokemon";
import { random, randomElement, limit } from "./utils";
import { isHit, Move, moves, createMove } from "./moves";
import { affinity, Category } from "./types";
import { Effect, createEffect, Behaviour } from "./effects";
import { movePicker, actionPicker, Action, switchPicker, canSwitch } from "./player";

export class Battle {
    battleSize: number;
    turnNumber: number;
    weather: Weather;
    effects: Effect[];
    partyAllies: Pokemon[]; // in party, not in battle
    activeAllies: Pokemon[]; // in battle
    partyEnemies: Pokemon[]; // in party, not in battle
    activeEnemies: Pokemon[]; // in battle

    /** Battle size: 1 = 1v1, 2 = 2v2, etc. */
    constructor(allies: Pokemon[], enemies: Pokemon[], battleSize: number) {
        this.partyAllies = allies.slice(battleSize, allies.length);
        this.activeAllies = allies.slice(0, battleSize);
        this.partyEnemies = enemies.slice(battleSize, enemies.length);
        this.activeEnemies = enemies.slice(0, battleSize);
        this.weather = Weather.NONE;
        this.effects = [];
        this.battleSize = battleSize;
        this.turnNumber = 1;
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
        const addedEffect = createEffect(effect, user, target);
        if (this.effectExists(addedEffect)) return;

        addedEffect.onCreation?.(addedEffect, this);
        this.effects.push(addedEffect);
    }

    effectExists(effect: Effect): boolean {
        return this.effects.some(e => e.name === effect.name && e.target === effect.target);
    }

    // it's ok to run all effects without checking outcome.
    // they are only applied under valid circumstances.
    applyEffect(effect: Effect, index: number, order: Pokemon[]): void {
        // effects can have 1 or many targets.
        // if no target is defined, effect is assumed to target everyone in the field.
        if (!effect.target || (this.isActive(effect.target) && 
            effect.target.health > 0 || effect.behaviour === Behaviour.ON_DEATH)) {
            if (effect.duration === 0) {
                effect.onDeletion?.(effect, this);
                this.effects.splice(index, 1);
            } else effect.execute?.(effect, this);

            // enforce hp limits
            for (const user of this.activePokemons())
                user.health = Math.floor(limit(0, user.health, user.maxHealth));

            this.checkDeath(order);

            console.log(`${effect.name} effect:`);
            this.printState();
        }
    }

    switchPokemon(switchedOut: Pokemon): void {
        const {switchedIn} = canSwitch(switchedOut, this) ? switchPicker(switchedOut, this) : undefined;
        const activeList = switchedOut.team === Team.ALLY ? this.activeAllies : this.activeEnemies;
        const partyList = switchedOut.team === Team.ALLY ? this.partyAllies : this.partyEnemies;
        activeList[activeList.indexOf(switchedOut)] = switchedIn;
        partyList.push(switchedOut);
        
        const order = this.sortBySpeed();

        switchedIn.ability.onSwitchIn?.(switchedIn.ability, switchedIn, this);

        // apply effects (on switch in)
        for (let i = 0; i < this.effects.length; i++) {
            const effect = this.effects[i];
            if (effect.behaviour === Behaviour.ON_SWITCH_IN)
                this.applyEffect(effect, i, order);
        }
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

        const order = this.sortBySpeed();

        // clear queues and select actions before turn begins
        const moveQueue: {move: Move, target: Pokemon}[] = [];
        const switchQueue: {switchedIn: Pokemon}[] = [];
        for (const user of order) {
            moveQueue.push(movePicker(user, this));
            // user is forced to switch
            /*if (user.health <= 0) {
                moveQueue.push();
                switchQueue.push(canSwitch(user, this) ? switchPicker(user, this) : undefined);
                continue;
            }

            const action = actionPicker();

            // early exit
            if (action === Action.RUN) return Outcome.ESCAPED;

            

            //while (action === Action.SWITCH && !canSwitch())

            // keep correct orders even if some do not choose that action
            moveQueue.push(action === Action.FIGHT ? movePicker(user, this) : undefined);
            if ()
            switchQueue.push(action === Action.SWITCH ? switchPicker(user, this) : undefined);*/
        }

        // begin turn
        for (let i=0; i<order.length; i++) {
            const user = order[i];
            if (user.health <= 0) continue;

            // apply abilities (start of turn)
            // no checkDeath here. abilities are not expected to KO someone. this can change later
            user.ability.onTurnBeginning?.(user.ability, user, this);

            // apply effects (start of turn)
            for (let i = 0; i < this.effects.length; i++) {
                const effect = this.effects[i];
                if (effect.target === user && effect.behaviour === Behaviour.START_OF_TURN)
                    this.applyEffect(effect, i, order);
            }

            // possible early exit (already won/lost)
            const outcome = this.checkVictory();
            if (outcome !== Outcome.UNDECIDED) return outcome;

            // attempt to perform a move
            if (user.canAttack) {
                const {move, target} = moveQueue[i];
                
                console.log(`${user.name} used ${move.name}!`);
                move.points--;

                move.onUse?.(move, user, target, this);
                if (isHit(move, user, target)) {
                    this.printEffectiveness(move, target);
                    if (target && target.health > 0) {
                        move.execute(move, user, target, this);
                        target.lastHitBy = {move, user};
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
        for (let i = 0; i < this.effects.length; i++) {
            const effect = this.effects[i];
            if (effect.behaviour === Behaviour.END_OF_TURN)
                this.applyEffect(effect, i, order);

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
                for (let i = 0; i < this.effects.length; i++) {
                    const effect = this.effects[i];
                    if (effect.user === user && effect.behaviour === Behaviour.ON_DEATH)
                        this.applyEffect(effect, i, order);
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