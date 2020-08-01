export enum Category {
    PHYSICAL, SPECIAL, STATUS
}

export enum Type {
    NORMAL, GRASS, WATER, FIRE, ELECTRIC, GROUND, FLYING, ICE
}

/** 
 * Damage multiplier, which can be 0, 0.5, 1 or 2. 
 * Row is the attacker, column is the defender.
 */
const matrix: number[][] = [
/*           Norm   Grass   Water   Fire    Elec    Grnd    Fly     Ice */
/* Norm */  [1,     1,      1,      1,      1,      1,      1,      1   ],
/* Grass */ [1,     0.5,    2,      0.5,    1,      2,      0.5,    1   ],
/* Water */ [1,     0.5,    0.5,    2,      1,      2,      1,      1   ],
/* Fire */  [1,     2,      0.5,    0.5,    1,      1,      1,      2   ],
/* Elec */  [1,     0.5,    2,      1,      0.5,    0,      2,      1   ],
/* Grnd */  [1,     0.5,    1,      2,      2,      1,      0,      1   ],
/* Fly */   [1,     2,      1,      1,      0.5,    1,      1,      1   ],
/* Ice */   [1,     2,      0.5,    1,      1,      2,      2,      0.5 ]
];

/** Damage multiplier when attacking a certain type. */
export function affinity(attacker: Type, defender: Type) {
    return matrix[attacker][defender];
}