import { Pokemon, Status, effective, effectiveAccuracy } from "./pokemon";
import { Battle, Weather } from "./battle";
import { random, limit } from "./utils";
import { Type, Category, affinity } from "./types";
import { effects } from "./effects";

interface MoveData {
    name: string,
    type: Type,
    category: Category,
    power: number,
    accuracy: number,
    points: number,
    maxPoints?: number,
    /** Use a move. */
    execute: (move: Move, user: Pokemon, target: Pokemon, battle: Battle) => void,
    /* On move being used. */
    onUse?: (move: Move, user: Pokemon, target: Pokemon, battle: Battle) => void,
    /** On move connecting. */
    onHitting?: (move: Move, user: Pokemon, target: Pokemon, battle: Battle) => void
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

export function calcDamage(move: Move, user: Pokemon, target: Pokemon, battle: Battle): number {
    const crit = isCrit(user.critStage);
    const attack = move.category === Category.PHYSICAL
        ? effective(user.attack, crit ? Math.max(0, user.attackStage) : user.attackStage)
        : effective(user.spAttack, crit ? Math.max(0, user.spAttackStage) : user.spAttackStage);
    const defense = move.category === Category.PHYSICAL
        ? effective(target.defense, crit ? Math.min(0, target.defenseStage) : target.defenseStage)
        : effective(target.spDefense, crit ? Math.min(0, target.spDefenseStage) : target.spDefenseStage);
    const weather = weatherAffinity(move, battle);
    const rng = random(0.85, 1);
    const stab = (move.type === user.primaryType || move.type === user.secondaryType) ? 1.5 : 1;
    const multPrimary = affinity(move.type, target.primaryType);
    const multSecondary = affinity(move.type, target.secondaryType);
    const burn = move.category === Category.PHYSICAL && user.status === Status.BURNED ? 0.5 : 1;

    return (((((2 * user.level / 5) + 2) * move.power * attack / defense) / 50) + 2) * 
        weather * (crit ? 1.5 : 1) * rng * stab * multPrimary * multSecondary * burn;
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

export const moves: Move[] = [
    {
        name: "Struggle",
        type: Type.NORMAL,
        category: Category.PHYSICAL,
        power: 50,
        accuracy: 100,
        points: Infinity,
        execute(move, user, target, battle) {
            const damage = calcDamage(move, user, target, battle);
            target.health -= damage;
            move.damageDealt = damage;
        },
        damageDealt: undefined,
        onHitting(self, user, target, battle) {
            console.log(`${user.name} received some recoil damage.`);
            user.health -= self.damageDealt * 0.25;
        }
    },
    {
        name: "Scratch",
        type: Type.NORMAL,
        category: Category.PHYSICAL,
        power: 40,
        accuracy: 100,
        points: 35,
        execute(move, user, target, battle) {
            target.health -= calcDamage(move, user, target, battle);
        }
    },
    {
        name: "Ember",
        type: Type.FIRE,
        category: Category.SPECIAL,
        power: 40,
        accuracy: 100,
        points: 35,
        execute(move, user, target, battle) {
            target.health -= calcDamage(move, user, target, battle);
        }
    },
    {
        name: "Blaze Kick",
        type: Type.FIRE,
        category: Category.PHYSICAL,
        power: 85,
        accuracy: 90,
        points: 10,
        execute(move, user, target, battle) {
            user.critStage += 2;
            target.health -= calcDamage(move, user, target, battle);
            user.critStage -= 2;
        }
    },
    {
        name: "Will-o-Wisp",
        type: Type.FIRE,
        category: Category.STATUS,
        power: 0,
        accuracy: 85,
        points: 15,
        execute(move, user, target, battle) {
            if (target.status === Status.NONE)
                battle.addEffect(effects[1], user, target);
            else console.log("But it failed!");
        }
    },
    {
        name: "Blizzard",
        type: Type.ICE,
        category: Category.SPECIAL,
        power: 110,
        accuracy: 70,
        points: 5,
        execute(move, user, target, battle) {
            target.health -= calcDamage(move, user, target, battle);
            if (target.status === Status.NONE && random() <= 1)
                battle.addEffect(effects[0], user, target);
        }
    },
    {
        name: "Dizzy Punch",
        type: Type.NORMAL,
        category: Category.PHYSICAL,
        power: 70,
        accuracy: 100,
        points: 10,
        execute(move, user, target, battle) {
            target.health -= calcDamage(move, user, target, battle);
            if (random() <= 1)
                battle.addEffect(effects[3], user, target);
        }
    },
    {
        name: "Confusion Hit",
        type: undefined,
        category: Category.PHYSICAL,
        power: 40,
        accuracy: Infinity,
        points: Infinity,
        execute(move, user, target, battle) {
            target.health -= calcDamage(move, user, target, battle);
        }
    }
];