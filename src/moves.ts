import { Pokemon, Status, effective, effectiveAccuracy } from "./pokemon";
import { Battle, Weather } from "./battle";
import { random, limit } from "./utils";
import { Type, Category, affinity } from "./types";
import { effects, getEffect } from "./effects";

interface MoveData {
    name: string,
    type: Type,
    category: Category,
    targeting: MoveTargeting,
    power: number,
    accuracy: number,
    points: number,
    maxPoints?: number,
    /** Use a move. */
    execute: (move: Move, user: Pokemon, target: Pokemon, battle: Battle, targetCount: number) => void,
    /* On move being used. */
    onUse?: (move: Move, user: Pokemon, target: Pokemon, battle: Battle, targetCount: number) => void,
    /** On move missing. */
    onMiss?: (move: Move, user: Pokemon, target: Pokemon, battle: Battle, targetCount: number) => void
}

/** Any additional information a move may want to store. */
export type Move = MoveData & { [field: string]: any };

export function createMove(skeleton: Move): Move {
    return { ...skeleton, maxPoints: skeleton.points };
}

/** This is slow and should mostly be used for debugging. */
export function getMove(name: string): Move {
    const result = moves.find(value => value.name === name);
    if (!result) throw `'${name}' is not a valid move.`;
    return result;
}

export function isHit(move: Move, user: Pokemon, target: Pokemon): boolean {
    const stage = limit(-6, user.accuracyStage - target.evasionStage, 6);
    return move.accuracy/100 * effectiveAccuracy(stage) >= random();
}

export function calcDamage(move: Move, user: Pokemon, target: Pokemon, battle: Battle, targets: number): number {
    const crit = isCrit(user.critStage);
    const attack = move.category === Category.PHYSICAL
        ? effective(user.attack, crit ? Math.max(0, user.attackStage) : user.attackStage)
        : effective(user.spAttack, crit ? Math.max(0, user.spAttackStage) : user.spAttackStage);
    const defense = move.category === Category.PHYSICAL
        ? effective(target.defense, crit ? Math.min(0, target.defenseStage) : target.defenseStage)
        : effective(target.spDefense, crit ? Math.min(0, target.spDefenseStage) : target.spDefenseStage);
    const multTarget = (move.targeting === MoveTargeting.ADJACENT && targets > 1) ? 0.75 : 1;
    const weather = weatherAffinity(move, battle);
    const rng = random(0.85, 1);
    const stab = (move.type === user.primaryType || move.type === user.secondaryType) ? 1.5 : 1;
    const multPrimary = affinity(move.type, target.primaryType);
    const multSecondary = affinity(move.type, target.secondaryType);
    const burn = move.category === (Category.PHYSICAL && user.status === Status.BURNED) ? 0.5 : 1;

    const total = (((((2 * user.level / 5) + 2) * move.power * attack / defense) / 50) + 2) * 
        multTarget * weather * (crit ? 1.5 : 1) * rng * stab * multPrimary * multSecondary * burn;

    // don't overkill
    return Math.min(total, target.health);
}

function weatherAffinity(move: Move, battle: Battle): number {
    if ((move.type === Type.FIRE && battle.weather === Weather.SUNNY) ||
        (move.type === Type.WATER && battle.weather === Weather.RAIN)) {
            console.log(`${move.name} is empowered by the weather.`);
            return 1.5;
    } else if ((move.type === Type.FIRE && battle.weather === Weather.RAIN) ||
        (move.type === Type.WATER && battle.weather === Weather.SUNNY)) {
            console.log(`${move.name} is weakened by the weather.`);
            return 0.5;
    } else return 1;
}

function isCrit(stage: number): boolean {
    let crit: boolean;
    if (stage <= 0) crit = random() <= 1/24;
    else if (stage === 1) crit = random() <= 1/8;
    else if (stage === 2) crit = random() <= 1/2;
    else crit = true;

    if (crit) console.log("Critical hit!");
    return crit;
}

/**
 * Single - targets someone. "target" should be determined on effect creation.
 * Requires **user** and **target**.
 * 
 * Self - targets self. "target" is equal to "user". Requires **user**.
 * 
 * Adjacent - targets all enemies or allies around the primary "target",
 * excluding self ("user"). Requires **user** and **target**.
 * 
 * Allies - targets active allies. "target" is an active ally. Requires **user**.
 * 
 * Foes - targets active foes. "target" is an active foe. Requires **user**.
 * 
 * All - targets all actives. "target" is an active entity.
 */
export enum MoveTargeting {
    SINGLE, SELF, ADJACENT, ALLIES, FOES, ALL
}

export const moves: Move[] = [
    {
        name: "Struggle",
        type: Type.NORMAL,
        category: Category.PHYSICAL,
        targeting: MoveTargeting.SINGLE,
        power: 50,
        accuracy: 100,
        points: Infinity,
        execute(move, user, target, battle, targetCount) {
            const damage = calcDamage(move, user, target, battle, targetCount);
            target.health -= damage;
            
            console.log(`${user.name} received some recoil damage.`);
            user.health -= damage * 0.25;
        }
    },
    {
        name: "Scratch",
        type: Type.NORMAL,
        category: Category.PHYSICAL,
        targeting: MoveTargeting.SINGLE,
        power: 40,
        accuracy: 100,
        points: 35,
        execute(move, user, target, battle, targetCount) {
            target.health -= calcDamage(move, user, target, battle, targetCount);
        }
    },
    {
        name: "Ember",
        type: Type.FIRE,
        category: Category.SPECIAL,
        targeting: MoveTargeting.SINGLE,
        power: 40,
        accuracy: 100,
        points: 35,
        execute(move, user, target, battle, targetCount) {
            target.health -= calcDamage(move, user, target, battle, targetCount);
        }
    },
    {
        name: "Blaze Kick",
        type: Type.FIRE,
        category: Category.PHYSICAL,
        targeting: MoveTargeting.SINGLE,
        power: 85,
        accuracy: 90,
        points: 10,
        execute(move, user, target, battle, targetCount) {
            user.critStage += 2;
            target.health -= calcDamage(move, user, target, battle, targetCount);
            user.critStage -= 2;

            if (target.status === Status.NONE && random() <= 0.1)
                battle.addEffect(getEffect("Burn"), user, target);
        }
    },
    {
        name: "Will-o-Wisp",
        type: Type.FIRE,
        category: Category.STATUS,
        targeting: MoveTargeting.SINGLE,
        power: 0,
        accuracy: 85,
        points: 15,
        execute(move, user, target, battle, targetCount) {
            if (target.status === Status.NONE)
                battle.addEffect(getEffect("Burn"), user, target);
            else console.log("But it failed!");
        }
    },
    {
        name: "Blizzard",
        type: Type.ICE,
        category: Category.SPECIAL,
        targeting: MoveTargeting.ADJACENT,
        power: 110,
        accuracy: 70,
        points: 5,
        execute(move, user, target, battle, targetCount) {
            target.health -= calcDamage(move, user, target, battle, targetCount);
            if (target.status === Status.NONE && random() <= 0.1)
                battle.addEffect(getEffect("Freeze"), user, target);
        }
    },
    {
        name: "Dizzy Punch",
        type: Type.NORMAL,
        category: Category.PHYSICAL,
        targeting: MoveTargeting.SINGLE,
        power: 70,
        accuracy: 100,
        points: 20,
        execute(move, user, target, battle, targetCount) {
            target.health -= calcDamage(move, user, target, battle, targetCount);
            if (random() <= 1) battle.addEffect(getEffect("Confusion"), user, target);
        }
    },
    {
        name: "Confusion Hit",
        type: undefined,
        category: Category.PHYSICAL,
        targeting: MoveTargeting.SELF,
        power: 40,
        accuracy: Infinity,
        points: Infinity,
        execute(move, user, target, battle, targetCount) {
            target.health -= calcDamage(move, user, target, battle, targetCount);
        }
    },
    {
        name: "Destiny Bond",
        type: undefined,
        category: Category.STATUS,
        targeting: MoveTargeting.SELF,
        power: 0,
        accuracy: Infinity,
        points: 5,
        execute(move, user, target, battle, targetCount) {
            battle.addEffect(getEffect("Destiny Bond"), user, target);
        }
    },
    {
        name: "Stealth Rock",
        type: Type.ROCK,
        category: Category.STATUS,
        targeting: MoveTargeting.SELF,
        power: 0,
        accuracy: Infinity,
        points: 20,
        execute(move, user, target, battle, targetCount) {
            if (battle.effectExists(getEffect("Stealth Rock"), user)) {
                console.log("But it failed!");
                return;
            }

            console.log(`Sharp rocks levitate around ${user.name}'s foes!`);
            battle.addEffect(getEffect("Stealth Rock"), user);
        }
    },
    {
        name: "Surf",
        type: Type.WATER,
        category: Category.SPECIAL,
        targeting: MoveTargeting.ADJACENT,
        power: 95,
        accuracy: 100,
        points: 15,
        execute(move, user, target, battle, targetCount) {
            target.health -= calcDamage(move, user, target, battle, targetCount);
        }
    }
];