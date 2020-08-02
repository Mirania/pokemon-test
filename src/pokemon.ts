import { Move, createMove } from "./moves";
import { Type } from "./types";
import { limit } from "./utils";
import { Ability, createAbility } from "./abilities";

export interface PokemonData {
    name: string,
    gender: Gender,
    level: number,
    /** 1 to no upper limit. */
    health: number,
    /** Base stat. */
    attack: number,
    /** Base stat. */
    defense: number,
    /** Base stat. */
    spAttack: number,
    /** Base stat. */
    spDefense: number,
    /** Base stat. */
    speed: number,
    primaryType: Type,
    secondaryType?: Type,
    ability: Ability,
    moves: Move[],
    team: Team,
}

export type Pokemon = PokemonData & {
    /** 1 to no upper limit. */
    maxHealth: number,
    /** Stat stage. */
    attackStage: number,
    /** Stat stage. */
    defenseStage: number,
    /** Stat stage. */
    spAttackStage: number,
    /** Stat stage. */
    spDefenseStage: number,
    /** Stat stage. */
    speedStage: number,
    /** Stat stage. */
    accuracyStage: number,
    /** Stat stage. */
    evasionStage: number,
    /** Stat stage. */
    critStage: number,
    status: Status,
    canAttack: boolean,
    lastHitBy: {move: Move, user: Pokemon}
}

export function createPokemon(data: PokemonData): Pokemon {
    return {
        name: data.name,
        gender: data.gender,
        level: data.level,
        health: data.health,
        maxHealth: data.health,
        attack: data.attack,
        defense: data.defense,
        spAttack: data.spAttack,
        spDefense: data.spDefense,
        speed: data.speed,
        primaryType: data.primaryType,
        secondaryType: data.secondaryType,
        ability: createAbility(data.ability),
        moves: data.moves.map(move => createMove(move)),
        team: data.team,
        attackStage: 0,
        defenseStage: 0,
        spAttackStage: 0,
        spDefenseStage: 0,
        speedStage: 0,
        accuracyStage: 0,
        evasionStage: 0,
        critStage: 0,
        status: Status.NONE,
        canAttack: true,
        lastHitBy: undefined
    };
}

/** For Attack, Defense, Special, Sp. Attack, Sp. Defense, and Speed. */
export function effective(stat: number, stage: number): number {
    stage = limit(-6, stage, 6);

    let num = 2, den = 2;
    if (stage < 0) den -= stage;
    else if (stage > 0) num += stage;

    return limit(1, stat * num/den, 999);
}

export function effectiveAccuracy(stage: number): number {
    stage = limit(-6, stage, 6);

    let num = 3, den = 3;
    if (stage < 0) den -= stage;
    else if (stage > 0) num += stage;

    return num/den;
}

export function noMoves(user: Pokemon): boolean {
    return user.moves.every(move => move.points <= 0);
}

export enum Team {
    ALLY, ENEMY
}

export enum Gender {
    MALE = "♂", FEMALE = "♀", NONE = ""
}

export enum Status {
    BURNED = "BRN", POISONED = "PSN", FROZEN = "FRZ", PARALYZED = "PRZ", 
    SLEEPING = "SLP", FAINTED = "FNT", TOXIC = "TOX", NONE = ""
}