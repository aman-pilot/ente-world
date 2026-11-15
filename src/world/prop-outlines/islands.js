// Public island ids, rather than theme names, control the rule.
export const hasPropOutlines = id => id === 'home' || id === 'sunset';
export const propObstacles = props => props.flatMap(p=>[p.footprint,p.bodyFootprint].filter(Boolean));
