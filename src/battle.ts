import { Pokemon, noMoves, effective, Status } from "./pokemon";
import { random, randomElement, limit } from "./utils";
import { isHit, Move, moves, createMove } from "./moves";
import { affinity, Category } from "./types";
import { Effect, createEffect, Behaviour } from "./effects";

export class Battle {
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

        if (addedEffect.onCreation) addedEffect.onCreation(addedEffect, this);
        this.effects.push(addedEffect);
    }

    effectExists(effect: Effect): boolean {
        return this.effects.some(e => e.name === effect.name && e.target === effect.target);
    }

    applyEffect(effect: Effect, index: number, order: Pokemon[]): void {
        // effects can have 1 or many targets.
        // if no target is defined, effect is assumed to target everyone in the field.
        if (!effect.target || (this.isActive(effect.target) && effect.target.health > 0)) {
            if (effect.duration === 0) {
                if (effect.onDeletion) effect.onDeletion(effect, this);
                this.effects.splice(index, 1);
            } else if (effect.execute) effect.execute(effect, this);

            this.checkDeath(order);

            // enforce hp limits
            for (const user of this.activePokemons())
                user.health = Math.floor(limit(0, user.health, user.maxHealth));

            this.printState();
        }
    }

    init(): void {
        const order = this.sortBySpeed();

        for (const user of order) {
            if (user.ability.onSwitchIn) user.ability.onSwitchIn(user.ability, user, this);
        }

        let state: Outcome;
        do {
            console.log(`---- Turn ${this.turnNumber++} ----------------------`);
        } while ((state = this.turn()) === Outcome.UNDECIDED);

        if (state === Outcome.WIN) console.log("You win!");
        else console.log("You're out of Pokemons!");
    }

    turn(): Outcome {
        const order = this.sortBySpeed();

        for (const user of order) {
            if (user.health <= 0) continue;

            // apply abilities (start of turn)
            // no checkDeath here. abilities are not expected to KO someone. this can change later
            if (user.ability.onTurnBeginning) user.ability.onTurnBeginning(user.ability, user, this);

            // apply effects (start of turn)
            for (let i = 0; i < this.effects.length; i++) {
                const effect = this.effects[i];
                if (effect.target === user && effect.behaviour === Behaviour.START_OF_TURN)
                    this.applyEffect(effect, i, order);

                // possible early exit (already won/lost)
                const outcome = this.outcome();
                if (outcome !== Outcome.UNDECIDED) return outcome;
            }

            // attempt to perform a move
            if (user.canAttack) {
                const actives = this.activePokemons();
                let move = createMove(randomElement(user.moves)); // copy of original object
                let target = user === actives[0] ? actives[1] : actives[0];

                if (move.points <= 0) {
                    console.log(`Cannot use ${move.name} right now!`);
                    move = noMoves(user) ? moves[0] : randomElement(user.moves);
                }
                
                console.log(`${user.name} used ${move.name}!`);
                move.points--;

                if (move.onUse) move.onUse(move, user, target, this);
                if (isHit(move, user, target)) {
                    this.printEffectiveness(move, target);
                    move.execute(move, user, target, this);
                    if (move.onHitting) move.onHitting(move, user, target, this);
                } else {
                    console.log("But it missed!");
                }

                this.checkDeath(order);

                // enforce hp/move limits
                move.points = Math.floor(limit(0, move.points, move.maxPoints ?? move.points));
                user.health = Math.floor(limit(0, user.health, user.maxHealth));
                target.health = Math.floor(limit(0, target.health, target.maxHealth));

                this.printState();

                // possible early exit (already won/lost)
                const outcome = this.outcome();
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

            // possible early exit (already won/lost)
            const outcome = this.outcome();
            if (outcome !== Outcome.UNDECIDED) return outcome;
        }

        // apply abilities (end of turn)
        for (const user of order) {
            if (user.health > 0) {
                if (user.ability.onTurnEnding) user.ability.onTurnEnding(user.ability, user, this);
                if (user.ability.turn) user.ability.turn++;
            }
        }

        return this.outcome();
    }

    checkDeath(order: Pokemon[]): void {
        for (let i=0; i<order.length; i++) {
            const user = order[i];

            if (user.health <= 0) {
                console.log(`${user.name} fainted!`);
                if (user.ability.onDeath) user.ability.onDeath(user.ability, user, this);
                user.status = Status.FAINTED;
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

    outcome(): Outcome {
        if ([...this.partyAllies, ...this.activeAllies].every(pkmn => pkmn.health <= 0))
            return Outcome.LOSS;
        if ([...this.partyEnemies, ...this.activeEnemies].every(pkmn => pkmn.health <= 0))
            return Outcome.WIN;
        
        return Outcome.UNDECIDED;
    }

    printState(): void {
        for (const pokemon of this.activePokemons()) {
            const id = `${pokemon.name}${pokemon.gender} Lv. ${pokemon.level}`;
            const hp = `[${pokemon.health}/${pokemon.maxHealth}]`;
            console.log(`${id}${" ".repeat(20 - id.length)} ${hp} ${pokemon.status}`);
        }
    }
}

enum Outcome {
    WIN, UNDECIDED, LOSS
}

export enum Weather {
    HAIL = "hailing", SUNNY = "very sunny", RAIN = "raining", 
    SANDSTORM = "a dry sandstorm", NONE = ""
}