import { Pokemon, Status } from "./pokemon";
import { Battle } from "./battle";
import { randomInt } from "./utils";

interface EffectData {
    duration: number,
    turn?: number,
    /** Source of the effect. */
    user?: Pokemon,
    /** Target of the effect. */
    target?: Pokemon,
    /** When effect is first applied. */
    onCreation?: (effect: Effect, battle: Battle) => void,
    /** Performed every turn. */
    execute?: (effect: Effect, battle: Battle) => void,
    /** When effect is removed or its duration ends. */
    onDeletion?: (effect: Effect, battle: Battle) => void
}

/** Any additional information an effect may want to store. */
export type Effect = EffectData & { [field: string]: any };

export function createEffect(skeleton: Effect, user?: Pokemon, target?: Pokemon): Effect {
    return { ...skeleton, user, target };
}

enum Behaviour {
    PERSISTENT, END_ON_SWITCH
}

export const effects: Effect[] = [
    // frozen
    {
        duration: undefined, // needs to be dynamically computed
        onCreation(effect, battle) {
            effect.duration = randomInt(2, 6);
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
    // burn
    {
        duration: Infinity,
        onCreation(effect, battle) {
            console.log(`${effect.target.name} is now burning!`);
            effect.target.status = Status.BURNED;
        },
        execute(effect, battle) {
            console.log(`${effect.target.name} is suffering from a burn.`);
            effect.target.health -= effect.target.maxHealth / 16;
        }
    },
    // toxic
    {
        turn: 1,
        duration: Infinity,
        onCreation(effect, battle) {
            console.log(`${effect.target.name} became poisoned!`);
            effect.target.status = Status.TOXIC;
        },
        execute(effect, battle) {
            console.log(`${effect.target.name} is suffering from poison.`);
            effect.target.health -= effect.target.maxHealth / 8 * effect.turn;
        }
    }
];