import { Pokemon, Status, Team } from "./pokemon";
import { Battle } from "./battle";
import { randomInt, random } from "./utils";
import { createMove, moves, Move } from "./moves";
import { Category } from "./types";

interface EffectData {
    name: string,
    duration: number,
    behaviour: Behaviour,
    /** Whether effect should disappear if target is switched out. */
    endOnSwitch: boolean,
    turn?: number,
    /** Source of the effect. */
    user?: Pokemon,
    /** Target of the effect. */
    target?: Pokemon,
    /** When effect is first applied. */
    onCreation?: (effect: Effect, battle: Battle) => void,
    /** Performed every turn. */
    execute?: (effect: Effect, battle: Battle) => void,
    /** When effect is removed or is or is on its final turn. */
    onDeletion?: (effect: Effect, battle: Battle) => void
}

/** Any additional information an effect may want to store. */
export type Effect = EffectData & { [field: string]: any };

export function createEffect(skeleton: Effect, user?: Pokemon, target?: Pokemon): Effect {
    return { ...skeleton, target, user };
}

/** This is slow and should mostly be used for debugging. */
export function getEffect(name: string): Effect {
    const result = effects.find(value => value.name === name);
    if (!result) throw `'${name}' is not a valid effect.`;
    return result;
}

export enum Behaviour {
    START_OF_TURN, END_OF_TURN, ON_DEATH, ON_SWITCH_IN, ON_SWITCH_OUT
}

export const effects: Effect[] = [
    {
        name: "Freeze",
        duration: undefined, // needs to be dynamically computed
        behaviour: Behaviour.START_OF_TURN,
        endOnSwitch: false,
        onCreation(effect, battle) {
            effect.duration = randomInt(1, 4);
            effect.target.status = Status.FROZEN;
            effect.target.canAttack = false;
            console.log(`${effect.target.name} became frozen!`);
        },
        execute(effect, battle) {
            console.log(`${effect.target.name} is frozen solid.`);
        },
        onDeletion(effect, battle) {
            effect.target.status = Status.NONE;
            effect.target.canAttack = true;
            console.log(`${effect.target.name} has defrosted.`)
        }
    },
    {
        name: "Burn",
        duration: Infinity,
        behaviour: Behaviour.END_OF_TURN,
        endOnSwitch: false,
        onCreation(effect, battle) {
            console.log(`${effect.target.name} is now burning!`);
            effect.target.status = Status.BURNED;
        },
        execute(effect, battle) {
            console.log(`${effect.target.name} is suffering from a burn.`);
            effect.target.health -= effect.target.maxHealth / 16;
        }
    },
    {
        name: "Toxic Poison",
        turn: 1,
        duration: Infinity,
        behaviour: Behaviour.END_OF_TURN,
        endOnSwitch: false,
        onCreation(effect, battle) {
            console.log(`${effect.target.name} became poisoned!`);
            effect.target.status = Status.TOXIC;
        },
        execute(effect, battle) {
            console.log(`${effect.target.name} is suffering from poison.`);
            effect.target.health -= effect.target.maxHealth / 8 * effect.turn;
        }
    },
    {
        name: "Confusion",
        duration: undefined,
        behaviour: Behaviour.START_OF_TURN,
        endOnSwitch: true,
        selfHit: undefined,
        onCreation(effect, battle) {
            console.log(`${effect.target.name} became confused!`);
            effect.duration = randomInt(2, 5);
            effect.selfHit = createMove(moves[7]);
        },
        execute(effect, battle) {
            console.log(`${effect.target.name} is confused.`);
            effect.target.canAttack = true;

            if (random() < 1/3) {
                console.log(`${effect.target.name} hurt itself in its confusion!`);
                (effect.selfHit as Move).execute(effect.selfHit, effect.user, effect.target, battle);
                effect.target.canAttack = false;
            }
        },
        onDeletion(effect, battle) {
            console.log(`${effect.target.name} recovered from its confusion.`);
            effect.target.canAttack = true;
        }
    },
    {
        name: "Destiny Bond",
        duration: 0,
        behaviour: Behaviour.ON_DEATH,
        endOnSwitch: true,
        onCreation(effect, battle) {
            console.log(`${effect.user.name} wants to take its foe down with it!`);
        },
        onDeletion(effect, battle) {
            const {move, user} = effect.user.lastHitBy;
            if (move.category !== Category.STATUS && user.team === Team.ENEMY) {
                console.log(`${effect.user.name}'s Destiny Bond took down ${effect.target.name}!`);
                effect.target.health = 0;
            }
        }
    },
];