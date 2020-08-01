import { Pokemon, Team, Gender, createPokemon } from "./pokemon";
import { Battle } from "./battle";
import { Type } from "./types";
import { moves } from "./moves";
import { abilities } from "./abilities";

let team: Pokemon[] = [
    createPokemon({
        name: "Ally",
        gender: Gender.MALE,
        level: 85,
        health: 250,
        attack: 100,
        defense: 100,
        spAttack: 100,
        spDefense: 100,
        speed: 10,
        primaryType: Type.NORMAL,
        ability: abilities[1],
        moves: [moves[6]],
        team: Team.ALLY
    })
];

let enemy: Pokemon[] = [
    createPokemon({
        name: "Enemy",
        gender: Gender.MALE,
        level: 85,
        health: 250,
        attack: 100,
        defense: 100,
        spAttack: 100,
        spDefense: 100,
        speed: 10,
        primaryType: Type.NORMAL,
        secondaryType: Type.GRASS,
        ability: abilities[0],
        moves: [moves[2], moves[1]],
        team: Team.ENEMY
    })
];

new Battle(team, enemy, 1).init();