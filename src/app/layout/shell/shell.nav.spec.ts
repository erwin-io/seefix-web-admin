import { NAV } from './shell.component';

describe('side menu order', () => {
  it('shows Campus Map right after Review Queue (owner hotfix 13)', () => {
    const labels = NAV.map((n) => n.label);
    expect(labels.indexOf('Campus Map')).toBe(labels.indexOf('Review Queue') + 1);
    expect(labels).toEqual(['Dashboard', 'Action Center', 'Review Queue', 'Campus Map', 'Reports', 'Work Orders', 'Procurement', 'Users', 'AI Knowledge']);
  });
});
