import { Battle } from "./battle";
import { Pokemon, Team } from "./pokemon";

interface AbilityData {
    name: string,
    turn?: number,
    /** When battle begins or Pokemon is switched in. */
    onSwitchIn?: (ability: Ability, user: Pokemon, battle: Battle) => void,
    /** Performed at the beginning of every turn. */
    onTurnBeginning?: (ability: Ability, user: Pokemon, battle: Battle) => void,
    /** Performed at the end of every turn. */
    onTurnEnding?: (ability: Ability, user: Pokemon, battle: Battle) => void,
    /** When Pokemon is switched out. */
    onSwitchOut?: (ability: Ability, user: Pokemon, battle: Battle) => void,
    /** When Pokemon dies. */
    onDeath?: (ability: Ability, user: Pokemon, battle: Battle) => void,
}

/** Any additional information an effect may want to store. */
export type Ability = AbilityData & { [field: string]: any };

export function createAbility(skeleton: Ability): Ability {
    return { ...skeleton };
}

/** This is slow and should mostly be used for debugging. */
export function getAbility(name: string): Ability {
    const result = abilities.find(value => value.name === name);
    if (!result) throw `'${name}' is not a valid ability.`;
    return result;
}

export const abilities: Ability[] = [
    {
        name: "Intimidate",
        onSwitchIn(ability, user, battle) {
            const targets = user.team === Team.ALLY ? battle.activeEnemies : battle.activeAllies;
            for (const target of targets) {
                target.attackStage--;
                console.log(`${target.name}'s attack fell!`);
            }
        }
    },
    {
        name: "Speed Boost",
        onTurnEnding(ability, user, battle) {
            user.speedStage++;
            console.log(`${user.name}'s speed rose!`);
        }
    }
];