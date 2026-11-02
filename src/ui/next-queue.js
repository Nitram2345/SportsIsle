// "Nächste" queue: items still to do (units, then idle facilities) in their natural order,
// minus those skipped this turn, which go to the back in the order they were skipped.
// current = what is selected now; pressing "Nächste" while it is still to do skips it.
export function nextInQueue(todo, skipped, current) {
  const s = skipped.filter(k => todo.includes(k) && k !== current);
  if (current && todo.includes(current)) s.push(current);
  const order = [...todo.filter(k => !s.includes(k)), ...s];
  const pick = order[0] ?? null;
  return { pick, skipped: s.filter(k => k !== pick) };
}
