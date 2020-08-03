import { Pokemon, Team, Gender, createPokemon } from "./pokemon";
import { Battle } from "./battle";
import { Type } from "./types";
import { moves, getMove } from "./moves";
import { abilities } from "./abilities";

let team: Pokemon[] = [
    createPokemon({
        name: "Ally",
        gender: Gender.MALE,
        level: 85,
        health: 200,
        attack: 100,
        defense: 100,
        spAttack: 100,
        spDefense: 100,
        speed: 91,
        primaryType: Type.NORMAL,
        ability: abilities[1],
        moves: [moves[8], moves[1]],
        team: Team.ALLY
    }),
    createPokemon({
        name: "Ally2",
        gender: Gender.MALE,
        level: 85,
        health: 200,
        attack: 100,
        defense: 100,
        spAttack: 100,
        spDefense: 100,
        speed: 90,
        primaryType: Type.NORMAL,
        ability: abilities[1],
        moves: [moves[8], getMove("Surf")],
        team: Team.ALLY
    }),
    createPokemon({
        name: "Ally3",
        gender: Gender.MALE,
        level: 85,
        health: 200,
        attack: 100,
        defense: 100,
        spAttack: 100,
        spDefense: 100,
        speed: 91,
        primaryType: Type.NORMAL,
        ability: abilities[1],
        moves: [moves[8], moves[1]],
        team: Team.ALLY
    }),
    createPokemon({
        name: "Ally4",
        gender: Gender.MALE,
        level: 85,
        health: 200,
        attack: 100,
        defense: 100,
        spAttack: 100,
        spDefense: 100,
        speed: 90,
        primaryType: Type.NORMAL,
        ability: abilities[1],
        moves: [moves[0], getMove("Surf")],
        team: Team.ALLY
    })
];

let enemy: Pokemon[] = [
    createPokemon({
        name: "Enemy2",
        gender: Gender.MALE,
        level: 85,
        health: 250,
        attack: 100,
        defense: 100,
        spAttack: 100,
        spDefense: 100,
        speed: 10,
        primaryType: Type.FIRE,
        ability: abilities[0],
        moves: [getMove("Stealth Rock")],
        team: Team.ENEMY
    })
];

new Battle(team, enemy, 2).init();