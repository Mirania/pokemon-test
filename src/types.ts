export enum Category {
    PHYSICAL, SPECIAL, STATUS
}

export enum Type {
    NORMAL, GRASS, WATER, FIRE, ELECTRIC, GROUND, FLYING, ICE, ROCK
}

/** 
 * Damage multiplier, which can be 0, 0.5, 1 or 2. 
 * Row is the attacker, column is the defender.
 */
const matrix: number[][] = [
/*           Norm   Grass   Water   Fire    Elec    Grnd    Fly     Ice     Rock*/
/* Norm */  [1,     1,      1,      1,      1,      1,      1,      1,      0.5 ],
/* Grass */ [1,     0.5,    2,      0.5,    1,      2,      0.5,    1,      2   ],
/* Water */ [1,     0.5,    0.5,    2,      1,      2,      1,      1,      2   ],
/* Fire */  [1,     2,      0.5,    0.5,    1,      1,      1,      2,      0.5 ],
/* Elec */  [1,     0.5,    2,      1,      0.5,    0,      2,      1,      1   ],
/* Grnd */  [1,     0.5,    1,      2,      2,      1,      0,      1,      2   ],
/* Fly */   [1,     2,      1,      1,      0.5,    1,      1,      1,      0.5 ],
/* Ice */   [1,     2,      0.5,    1,      1,      2,      2,      0.5,    1   ],
/* Rock */  [1,     1,      1,      2,      1,      0.5,    2,      2,      1   ]
];

/** Damage multiplier when attacking a certain type. Returns 1 if either type is undefined. */
export function affinity(attacker: Type, defender: Type): number {
    if (attacker === undefined || defender === undefined) return 1;
    return matrix[attacker][defender];
}