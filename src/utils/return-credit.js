const { minor } = require('./money');

// Allocate the document's discount across item groups by gross value. Largest
// remainder distributes cents deterministically; full returns total exactly
// the original net payable, even with duplicate lines at different prices.
function allocateCredits(lines, payable) {
  const groups = lines.map(line => ({ ...line, gross: minor(line.gross_total), qty: Number(line.ordered_qty) }));
  const gross = groups.reduce((sum, line) => sum + line.gross, 0);
  const net = minor(payable);
  if (gross === 0) return new Map(groups.map(line => [line.item_id, { ...line, credit: 0 }]));
  // BigInt prevents products of otherwise safe minor-unit amounts overflowing.
  const shares = groups.map(line => ({ ...line, credit: Number(BigInt(net) * BigInt(line.gross) / BigInt(gross)), remainder: BigInt(net) * BigInt(line.gross) % BigInt(gross) }));
  let remaining = net - shares.reduce((sum, line) => sum + line.credit, 0);
  const sorted = [...shares].sort((a, b) => a.remainder === b.remainder ? a.item_id - b.item_id : a.remainder > b.remainder ? -1 : 1);
  for (const line of sorted) if (remaining-- > 0) line.credit++;
  return new Map(shares.map(line => [line.item_id, line]));
}
function incrementalCredit(group, alreadyReturned, requested) {
  const before = Math.round(group.credit * Number(alreadyReturned) / group.qty);
  const after = Math.round(group.credit * (Number(alreadyReturned) + Number(requested)) / group.qty);
  return (after - before) / 100;
}
module.exports = { allocateCredits, incrementalCredit };
