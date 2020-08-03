import { Pokemon, Team, noMoves } from "./pokemon";
import { Move, createMove, moves, MoveTargeting } from "./moves";
import { Battle, MoveCommand, SwitchCommand } from "./battle";
import { randomElement } from "./utils";
const prompt = require('prompt-sync')({sigint: true}) as (question: string) => string;

export enum Action {
    FIGHT = "Fight", SWITCH = "Switch", ITEM = "Item", RUN = "Run"
}

export function actionPicker(user: Pokemon): Action {
    const optionList = [Action.FIGHT, Action.SWITCH, Action.RUN];
    let choice: Action;

    if (user.team === Team.ALLY) {
        console.log("Select your action (indexes 0-2):");

        for (let i=0; i<optionList.length; i++)
            console.log(`${i} - ${optionList[i]}`);
        do {
            choice = optionList[prompt("> ")];
        } while (!choice);
    } else {
        // AI's selection
        choice = Action.FIGHT;
    }

    return choice;
}

export function movePicker(user: Pokemon, battle: Battle): MoveCommand {
    let move: Move, target: Pokemon;

    // move selection
    if (noMoves(user)) {
        // forced use of Struggle
        console.log(`${user.name} has no moves left!`);
        move = createMove(moves[0]);
    } else if (user.team === Team.ALLY) {
        // player's selection
        console.log(`Select your move (indexes 0-${user.moves.length - 1}):`);

        for (let i=0; i<user.moves.length; i++) {
            const option = user.moves[i];
            console.log(`${i} - ${option.name} (${option.points}/${option.maxPoints ?? "??"})`);
        }

        do {
            move = user.moves[prompt("> ")];
            if (move && move.points <= 0) console.log("That move has no power left!");
        } while (!move || move.points <= 0);
    } else {
        // AI's selection
        move = randomElement(user.moves.filter(move => move.points > 0));
    }

    // target selection - may end up undefined
    // only single and adjacent require an explicit target
    if (move.targeting === MoveTargeting.SINGLE || move.targeting === MoveTargeting.ADJACENT) {
        if (battle.battleSize <= 0) {
            // immediate selection, no choices to be made
            const optionList = user.team === Team.ALLY ? battle.activeEnemies : battle.activeAllies;
            target = optionList[0];
        } else if (user.team === Team.ALLY) {
            // player's selection
            const optionList = battle.activePokemons().filter(pkmn => pkmn !== user && pkmn.health >= 0);
            console.log(`Select your target (indexes 0-${optionList.length - 1}):`);

            for (let i=0; i<optionList.length; i++) {
                const option = optionList[i];
                const id = `${option.name}${option.gender}`;
                const hp = `${option.health}/${option.maxHealth}`;
                console.log(`${i} - ${id} [${hp}] ${option.status}`);
            }
            do {
                target = optionList[prompt("> ")];
            } while (!target);
        } else {
            // AI's selection
            target = randomElement(battle.activeAllies);
        }
    }

    return { move, user, target };
}

export function canSwitch(switchedOut: Pokemon, battle: Battle): boolean {
    const partyList = switchedOut.team === Team.ALLY ? battle.partyAllies : battle.partyEnemies;
    return partyList.filter(pkmn => pkmn.health > 0).length > 0;
}

export function switchPicker(switchedOut: Pokemon, battle: Battle): SwitchCommand {
    let switchedIn: Pokemon;

    const partyList = switchedOut.team === Team.ALLY ? battle.partyAllies : battle.partyEnemies;
    const queuedSwitches = battle.switchQueue.map(cmd => cmd?.switchedIn) ?? [];
    const availableList = partyList.filter(pkmn => pkmn.health > 0 && !queuedSwitches.includes(pkmn));

    if (switchedOut.team === Team.ALLY) {
        console.log(`Select your Pokemon (indexes 0-${availableList.length - 1}):`);

        for (let i=0; i<availableList.length; i++) {
            const option = availableList[i];
            const id = `${option.name}${option.gender}`;
            const hp = `${option.health}/${option.maxHealth}`;
            console.log(`${i} - ${id} [${hp}] ${option.status}`);
        }
        do {
            switchedIn = availableList[prompt("> ")];
        } while (!switchedIn);
    } else {
        // AI's selection
        switchedIn = randomElement(availableList);
    }

    return { switchedOut, switchedIn };
}