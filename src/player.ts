import { Pokemon, Team, noMoves } from "./pokemon";
import { Move, createMove, moves } from "./moves";
import { Battle } from "./battle";
import { randomElement } from "./utils";
const prompt = require('prompt-sync')({sigint: true}) as (question: string) => string;

export function movePicker(user: Pokemon, battle: Battle): Move {
    if (noMoves(user)) {
        console.log(`${user.name} has no moves left!`);
        return createMove(moves[0]);
    }

    if (user.team === Team.ALLY) {
        let choice: Move;
        console.log(`Select your move (indexes 0-${user.moves.length-1}):`);
        for (let i=0; i<user.moves.length; i++) {
            const move = user.moves[i];
            console.log(`${i} - ${move.name} (${move.points}/${move.maxPoints ?? "??"})`);
        }
        do {
            choice = user.moves[prompt("> ")];
            if (choice?.points <= 0) console.log("That move has no power left!");
        } while (!choice || choice.points <= 0);
    } else randomElement(user.moves);
}