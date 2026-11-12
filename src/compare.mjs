export function compareReports(left, right, { controlled = false } = {}) {
  const rules = [...new Set([...left.findings,...right.findings].map(f=>f.rule))].sort();
  return {format:'specter-comparison-v1',controlled,
    interpretation: controlled ? 'Caller labels these flows controlled; equivalence is not verified by Specter.' : 'Different captured transactions; counts do not establish an improvement or equivalent application intent.',
    rules:rules.map(rule=>({rule,left:left.findings.filter(f=>f.rule===rule).length,right:right.findings.filter(f=>f.rule===rule).length})),
    leftUnknowns:left.unknowns,rightUnknowns:right.unknowns,
    conclusion:'No privacy ranking or anonymity verdict.'};
}
