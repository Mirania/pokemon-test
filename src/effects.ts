import { Pokemon, Status, Team } from "./pokemon";
import { Battle } from "./battle";
import { randomInt, random } from "./utils";
import { createMove, moves, Move } from "./moves";
import { Category, affinity, Type } from "./types";

interface EffectData {
    name: string,
    duration: number,
    trigger: Trigger,
    targeting: EffectTargeting,
    /** Whether effect should disappear if target is switched out. */
    endOnSwitch: boolean,
    turn?: number,
    /** When effect is first applied. */
    onCreation?: (effect: Effect, user: Pokemon, target: Pokemon, battle: Battle) => void,
    /** Performed every turn. */
    execute?: (effect: Effect, user: Pokemon, target: Pokemon, battle: Battle) => void,
    /** When effect is removed or is or is on its final turn. */
    onDeletion?: (effect: Effect, user: Pokemon, target: Pokemon, battle: Battle) => void
}

/** Any additional information an effect may want to store. */
export type Effect = EffectData & { [field: string]: any };

export function createEffect(skeleton: Effect): Effect {
    return { ...skeleton };
}

/** This is slow and should mostly be used for debugging. */
export function getEffect(name: string): Effect {
    const result = effects.find(value => value.name === name);
    if (!result) throw `'${name}' is not a valid effect.`;
    return result;
}

/**
 * Single - targets someone. "target" should be determined on effect creation.
 * Requires **target**.
 * 
 * Self - targets self. "target" is equal to "user". Requires **user**.
 * 
 * Allies - targets active allies. "target" is an active ally.
 * 
 * Foes - targets active foes. "target" is an active foe.
 * 
 * All - targets all actives. "target" is an active entity.
 */
export enum EffectTargeting {
    SINGLE, SELF, ALLIES, FOES, ALL
}

export enum Trigger {
    START_OF_TURN, END_OF_TURN, ON_DEATH, ON_SWITCH_IN, ON_SWITCH_OUT
}

export const effects: Effect[] = [
    {
        name: "Freeze",
        duration: undefined, // needs to be dynamically computed
        trigger: Trigger.START_OF_TURN,
        targeting: EffectTargeting.SINGLE,
        endOnSwitch: false,
        onCreation(effect, user, target, battle) {
            effect.duration = randomInt(1, 4);
            target.status = Status.FROZEN;
            target.canAttack = false;
            console.log(`${target.name} became frozen!`);
        },
        execute(effect, user, target, battle) {
            console.log(`${target.name} is frozen solid.`);
        },
        onDeletion(effect, user, target, battle) {
            target.status = Status.NONE;
            target.canAttack = true;
            console.log(`${target.name} has defrosted.`)
        }
    },
    {
        name: "Burn",
        duration: Infinity,
        trigger: Trigger.END_OF_TURN,
        targeting: EffectTargeting.SINGLE,
        endOnSwitch: false,
        onCreation(effect, user, target, battle) {
            console.log(`${target.name} is now burning!`);
            target.status = Status.BURNED;
        },
        execute(effect, user, target, battle) {
            console.log(`${target.name} is suffering from a burn.`);
            target.health -= target.maxHealth / 16;
        }
    },
    {
        name: "Toxic Poison",
        turn: 1,
        duration: Infinity,
        trigger: Trigger.END_OF_TURN,
        targeting: EffectTargeting.SINGLE,
        endOnSwitch: false,
        onCreation(effect, user, target, battle) {
            console.log(`${target.name} became poisoned!`);
            target.status = Status.TOXIC;
        },
        execute(effect, user, target, battle) {
            console.log(`${target.name} is suffering from poison.`);
            target.health -= target.maxHealth / 8 * effect.turn;
        }
    },
    {
        name: "Confusion",
        duration: undefined,
        trigger: Trigger.START_OF_TURN,
        targeting: EffectTargeting.SINGLE,
        endOnSwitch: true,
        selfHit: undefined,
        onCreation(effect, user, target, battle) {
            console.log(`${target.name} became confused!`);
            effect.duration = randomInt(2, 5);
            effect.selfHit = createMove(moves[7]);
        },
        execute(effect, user, target, battle) {
            console.log(`${target.name} is confused.`);
            target.canAttack = true;

            if (random() < 1/3) {
                console.log(`${target.name} hurt itself in its confusion!`);
                (effect.selfHit as Move).execute(effect.selfHit, target, target, battle);
                target.canAttack = false;
            }
        },
        onDeletion(effect, user, target, battle) {
            console.log(`${target.name} recovered from its confusion.`);
            target.canAttack = true;
        }
    },
    {
        name: "Destiny Bond",
        duration: 1,
        trigger: Trigger.ON_DEATH,
        targeting: EffectTargeting.SELF,
        endOnSwitch: true,
        onCreation(effect, user, target, battle) {
            console.log(`${target.name} wants to take its foe down with it!`);
        },
        onDeletion(effect, user, target, battle) {
            const {move, attacker} = target.lastHitBy;
            if (move.category !== Category.STATUS && attacker.team === Team.ENEMY) {
                console.log(`${target.name}'s Destiny Bond took down ${attacker.name}!`);
                attacker.health = 0;
            }
        }
    },
    {
        name: "Stealth Rock",
        duration: Infinity,
        trigger: Trigger.ON_SWITCH_IN,
        targeting: EffectTargeting.FOES,
        endOnSwitch: false,
        onCreation(effect, user, target, battle) {
            console.log(`Sharp rocks levitate around ${user.name}'s foes!`);
        },
        execute(effect, user, target, battle) {
            console.log(`Sharp rocks dig into ${target.name}!`);

            const mult = affinity(Type.ROCK, target.primaryType) *
                affinity(Type.ROCK, target.secondaryType);
            
            target.health -= target.maxHealth * 0.125 * mult;
        }
    }
];